'use strict';

const { fetchOHLCV } = require('../services/forexService');
const { calculateAll } = require('../services/indicatorService');
const groqService = require('../services/groqService');
const openaiService = require('../services/openaiService');
const geminiService = require('../services/geminiService');
const openrouterService = require('../services/openrouterService');
const mistralService = require('../services/mistralService');
const cohereService = require('../services/cohereService');
const { generateDualPrediction } = require('../services/dualAIService');
const { generatePrediction: claudePredict } = require('../services/claudeService');
const { normaliseClaude } = require('../services/dualAIService');
const { generateMultiAIPrediction } = require('../services/multiAIEngine');
const { pool } = require('../config/database');
const { extractIP, parseUserAgent, geoLookup } = require('../services/geoService');

const WATCHED_PAIRS = [
  // Forex
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  // Metals
  'XAU/USD', 'XAG/USD',
  // Crypto
  'BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD',
  // Stocks
  'AAPL', 'NVDA', 'TSLA', 'MSFT',
  // Indices & Commodities
  'SPX', 'OIL/USD',
];
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const RATE_LIMIT_MAX = 20;
const AI_PROVIDER_TIMEOUT_MS = 30000; // 30 seconds per AI provider call

// Allowed symbols and timeframes for predict endpoint
const ALLOWED_SYMBOLS = new Set([
  // Forex
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'XAU/USD',
  'USD/CAD', 'USD/CHF', 'NZD/USD', 'EUR/GBP', 'EUR/JPY',
  'GBP/JPY', 'XAG/USD',
  // Additional Metals
  'XPT/USD', 'XPD/USD',
  // Crypto
  'BTC/USD', 'ETH/USD', 'BNB/USD', 'SOL/USD', 'ADA/USD',
  'XRP/USD', 'DOGE/USD', 'DOT/USD', 'AVAX/USD', 'MATIC/USD',
  // Stocks
  'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'NFLX', 'AMD', 'INTC',
  // Indices
  'SPX', 'DJI', 'NDX', 'FTSE', 'DAX', 'NIKKEI',
  // Commodities
  'OIL/USD', 'NATGAS/USD', 'WHEAT/USD', 'CORN/USD',
]);
const ALLOWED_TIMEFRAMES = new Set(['15min', '1h', '4h', '1day']);

// Maximum file size (in bytes) that can be safely base64-encoded for Gemini (7.5 MB)
const MAX_IMAGE_BYTES_FOR_GEMINI = 7.5 * 1024 * 1024;

/**
 * Wraps a promise with a timeout.  Rejects with an error if the promise does
 * not settle within `ms` milliseconds.
 */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI provider timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ─── Rate-limit helper ────────────────────────────────────────────────────────

async function checkRateLimit(redis, userId) {
  if (!redis) return { allowed: true, remaining: RATE_LIMIT_MAX };

  const key = `ratelimit:predict:${userId}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW);
  }

  const ttl = await redis.ttl(key);
  const remaining = Math.max(0, RATE_LIMIT_MAX - current);

  return {
    allowed: current <= RATE_LIMIT_MAX,
    remaining,
    resetInSeconds: ttl,
  };
}

// ─── Rule-based fallback prediction ──────────────────────────────────────────

function buildRuleBasedReasoning(indicators, direction) {
  const rsiLabel =
    indicators.rsi < 30 ? 'oversold' : indicators.rsi > 70 ? 'overbought' : 'neutral';
  const macdLabel = (indicators.macd?.histogram || 0) > 0 ? 'positive (bullish)' : 'negative (bearish)';
  const ema50Label = indicators.currentPrice > (indicators.ema?.ema50 || 0) ? 'above' : 'below';
  return (
    `Rule-based analysis: RSI at ${indicators.rsi} (${rsiLabel}). ` +
    `MACD histogram is ${macdLabel}. ` +
    `Price is ${ema50Label} the 50 EMA. ` +
    `Overall indicator confluence suggests a ${direction} bias with moderate conviction.`
  );
}

function ruleBased(symbol, indicators) {
  let bullishPoints = 0;
  let bearishPoints = 0;

  if (indicators.rsi < 30) bullishPoints += 2;
  else if (indicators.rsi > 70) bearishPoints += 2;
  else if (indicators.rsi < 45) bearishPoints += 1;
  else if (indicators.rsi > 55) bullishPoints += 1;

  if ((indicators.macd?.histogram || 0) > 0) bullishPoints += 2;
  else bearishPoints += 2;

  if (indicators.currentPrice > (indicators.ema?.ema20 || 0)) bullishPoints++;
  else bearishPoints++;
  if (indicators.currentPrice > (indicators.ema?.ema50 || 0)) bullishPoints++;
  else bearishPoints++;
  if (indicators.currentPrice > (indicators.ema?.ema200 || 0)) bullishPoints++;
  else bearishPoints++;

  const total = bullishPoints + bearishPoints;
  const score = total === 0 ? 50 : (bullishPoints / total) * 100;

  let direction;
  let confidence;
  if (score >= 65) {
    direction = 'BUY';
    confidence = Math.min(75, Math.round(score));
  } else if (score <= 35) {
    direction = 'SELL';
    confidence = Math.min(75, Math.round(100 - score));
  } else {
    direction = 'HOLD';
    confidence = 50;
  }

  const atr = indicators.atr || indicators.currentPrice * 0.003;
  const entryPrice = indicators.currentPrice;
  const stopLoss =
    direction === 'BUY' ? entryPrice - atr * 1.5 : entryPrice + atr * 1.5;
  const takeProfit =
    direction === 'BUY' ? entryPrice + atr * 3 : entryPrice - atr * 3;

  return {
    direction,
    confidence,
    entryPrice: parseFloat(entryPrice.toFixed(5)),
    stopLoss: parseFloat(stopLoss.toFixed(5)),
    takeProfit: parseFloat(takeProfit.toFixed(5)),
    riskRewardRatio: 2.0,
    reasoning: buildRuleBasedReasoning(indicators, direction),
    keyRisks: 'No AI model was available; this is a mechanical rule-based signal. Use caution and verify with your own analysis.',
    marketBias: direction === 'BUY' ? 'BULLISH' : direction === 'SELL' ? 'BEARISH' : 'NEUTRAL',
    timeHorizon: 'Short-term (1–4 hours)',
    disclaimer: 'For educational purposes only. Not financial advice.',
    aiProvider: 'rule-based',
  };
}

// ─── Persist prediction to DB ─────────────────────────────────────────────────

async function savePrediction(userId, symbol, timeframe, prediction) {
  try {
    const result = await pool.query(
      `INSERT INTO predictions
         (user_id, symbol, timeframe, direction, confidence, entry_price,
          stop_loss, take_profit, reasoning, ai_provider, raw_response)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, created_at`,
      [
        userId,
        symbol,
        timeframe,
        prediction.direction,
        prediction.confidence,
        prediction.entryPrice,
        prediction.stopLoss,
        prediction.takeProfit,
        prediction.reasoning,
        prediction.aiProvider,
        JSON.stringify(prediction),
      ]
    );
    return result.rows[0];
  } catch (err) {
    console.error('[AIController] savePrediction error:', err.message);
    return null;
  }
}

// ─── Controllers ─────────────────────────────────────────────────────────────

// POST /ai/predict
async function predict(req, res) {
  const { symbol = 'EUR/USD', timeframe = '1h', provider } = req.body;
  const userId = req.user.id;
  const redis = req.app.locals.redis;

  // Validate symbol and timeframe
  const normalizedSymbol = typeof symbol === 'string' ? symbol.toUpperCase() : '';
  if (!ALLOWED_SYMBOLS.has(normalizedSymbol)) {
    return res.status(400).json({ error: `Invalid symbol. Allowed symbols: ${[...ALLOWED_SYMBOLS].join(', ')}.` });
  }
  if (!ALLOWED_TIMEFRAMES.has(timeframe)) {
    return res.status(400).json({ error: `Invalid timeframe. Allowed timeframes: ${[...ALLOWED_TIMEFRAMES].join(', ')}.` });
  }

  // Validate provider if supplied
  const VALID_PROVIDERS = new Set(['groq', 'openai', 'gemini', 'openrouter', 'mistral', 'cohere', 'claude', 'anthropic', 'dual', 'dual_ai', 'auto', 'multi', 'consensus', 'all']);
  const normalizedProvider = typeof provider === 'string' ? provider.toLowerCase() : 'auto';
  if (provider && !VALID_PROVIDERS.has(normalizedProvider)) {
    return res.status(400).json({ error: `Invalid provider. Allowed providers: ${[...VALID_PROVIDERS].join(', ')}.` });
  }

  // Check if user is restricted from using AI predictions
  if (req.user.is_restricted) {
    return res.status(403).json({ error: 'Your account has been restricted. AI predictions are unavailable. Please contact support.' });
  }

  // Rate limit
  const rateCheck = await checkRateLimit(redis, userId);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Rate limit exceeded. You can make ${RATE_LIMIT_MAX} predictions per hour. Resets in ${rateCheck.resetInSeconds}s.`,
    });
  }

  try {
    let prediction = null;
    let isMock = false;
    let indicators = null;

    // ── Provider-specific routing ─────────────────────────────────────────────

    if (normalizedProvider === 'multi' || normalizedProvider === 'consensus' || normalizedProvider === 'all') {
      // Multi-AI: All 5 providers in parallel — weighted consensus
      prediction = await withTimeout(
        generateMultiAIPrediction(symbol, timeframe),
        AI_PROVIDER_TIMEOUT_MS * 5
      );
      // Fetch indicators separately for the response
      const fetched = await fetchOHLCV(symbol, timeframe, 100);
      isMock = fetched.isMock;
      indicators = calculateAll(fetched.candles);
    } else if (normalizedProvider === 'dual' || normalizedProvider === 'dual_ai') {
      // Dual AI: Claude + Groq in parallel (dualAIService fetches data internally)
      prediction = await withTimeout(
        generateDualPrediction(symbol, timeframe),
        AI_PROVIDER_TIMEOUT_MS * 2
      );
      // Fetch indicators separately for the response (dualAIService uses its own copy)
      const fetched = await fetchOHLCV(symbol, timeframe, 100);
      isMock = fetched.isMock;
      indicators = calculateAll(fetched.candles);
    } else if (normalizedProvider === 'claude' || normalizedProvider === 'anthropic') {
      // Claude standalone
      const fetched = await fetchOHLCV(symbol, timeframe, 100);
      isMock = fetched.isMock;
      indicators = calculateAll(fetched.candles);
      const claudeRaw = await withTimeout(
        claudePredict(symbol, timeframe),
        AI_PROVIDER_TIMEOUT_MS
      );
      prediction = normaliseClaude(claudeRaw, symbol, indicators);
    } else {
      // 1. Fetch candle data
      const fetched = await fetchOHLCV(symbol, timeframe, 100);
      isMock = fetched.isMock;
      const candles = fetched.candles;

      // 2. Calculate indicators
      indicators = calculateAll(candles);

      // 3. Try requested provider first, then fall back sequentially
      const ALL_PROVIDERS = [
        ['groq', groqService],
        ['openai', openaiService],
        ['gemini', geminiService],
        ['openrouter', openrouterService],
        ['mistral', mistralService],
        ['cohere', cohereService],
      ];

      // If a specific single provider was requested, try it first
      let orderedProviders = ALL_PROVIDERS;
      if (normalizedProvider && normalizedProvider !== 'auto') {
        const requested = ALL_PROVIDERS.find(([name]) => name === normalizedProvider);
        const rest = ALL_PROVIDERS.filter(([name]) => name !== normalizedProvider);
        if (requested) orderedProviders = [requested, ...rest];
      }

      const errors = [];
      for (const [name, service] of orderedProviders) {
        try {
          prediction = await withTimeout(
            service.getAIPrediction(symbol, timeframe, indicators, candles),
            AI_PROVIDER_TIMEOUT_MS
          );
          prediction.aiProvider = name;
          break;
        } catch (err) {
          errors.push(`${name}: ${err.message}`);
          console.warn(`[AIController] ${name} failed: ${err.message}`);
        }
      }

      // 4. Final fallback: rule-based
      if (!prediction) {
        console.warn('[AIController] All AI providers failed — using rule-based fallback. Errors:', errors);
        prediction = ruleBased(symbol, indicators);
      }
    }

    // 5. Persist
    const saved = await savePrediction(userId, symbol, timeframe, prediction);

    // Log tool_use activity with geo data and update last_active (non-blocking)
    const actIP = extractIP(req);
    const actUA = req.headers['user-agent'] || null;
    const { device_type, browser, os } = parseUserAgent(actUA);
    geoLookup(actIP, redis).then((geo) => {
      pool.query(
        `INSERT INTO user_activity
           (user_id, action, symbol, timeframe,
            prediction_direction, prediction_confidence,
            ip_address, country, country_code, city, region, isp,
            latitude, longitude, user_agent, device_type, browser, os, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          userId, 'tool_use', symbol, timeframe,
          prediction.direction,
          prediction.confidence,
          actIP, geo.country, geo.country_code, geo.city, geo.region, geo.isp,
          geo.latitude, geo.longitude, actUA, device_type, browser, os,
          JSON.stringify({ tool: 'ai_predict', symbol, timeframe }),
        ]
      ).catch((err) => console.error('[AI] Failed to log tool_use:', err.message));
    }).catch(() => {});

    pool.query(
      'UPDATE users SET last_active = NOW() WHERE id = $1',
      [userId]
    ).catch((err) => console.error('[AI] Failed to update last_active:', err.message));

    return res.json({
      predictionId: saved?.id || null,
      symbol,
      timeframe,
      isMockData: isMock,
      indicators,
      prediction,
      rateLimit: {
        remaining: rateCheck.remaining,
        resetInSeconds: rateCheck.resetInSeconds,
      },
      createdAt: saved?.created_at || new Date().toISOString(),
    });
  } catch (err) {
    console.error('[AIController] predict error:', err.message);
    return res.status(500).json({ error: 'Failed to generate prediction. Please try again.' });
  }
}

// GET /ai/history?symbol=EUR/USD&limit=20&offset=0
async function getHistory(req, res) {
  const { symbol, limit = 20, offset = 0 } = req.query;
  const userId = req.user.id;
  const pageLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const pageOffset = Math.max(parseInt(offset, 10) || 0, 0);

  try {
    const baseParams = [userId];
    let baseWhere = 'WHERE user_id = $1';

    if (symbol) {
      baseParams.push(symbol.toUpperCase());
      baseWhere += ` AND symbol = $${baseParams.length}`;
    }

    // Total count query
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM predictions ${baseWhere}`,
      baseParams
    );
    const totalCount = parseInt(countResult.rows[0].total, 10);

    // Data query
    const dataParams = [...baseParams, pageLimit, pageOffset];
    const dataQuery = `
      SELECT id, symbol, timeframe, direction, confidence,
             entry_price, stop_loss, take_profit, reasoning,
             ai_provider, created_at
      FROM predictions
      ${baseWhere}
      ORDER BY created_at DESC
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const result = await pool.query(dataQuery, dataParams);

    // PostgreSQL returns NUMERIC columns as strings; parse them to numbers so
    // that the frontend can safely call .toFixed() without a TypeError crash.
    const predictions = result.rows.map((row) => ({
      ...row,
      confidence: row.confidence != null ? parseFloat(row.confidence) : null,
      entry_price: row.entry_price != null ? parseFloat(row.entry_price) : null,
      stop_loss: row.stop_loss != null ? parseFloat(row.stop_loss) : null,
      take_profit: row.take_profit != null ? parseFloat(row.take_profit) : null,
    }));

    return res.json({
      predictions,
      count: totalCount,
      limit: pageLimit,
      offset: pageOffset,
    });
  } catch (err) {
    console.error('[AIController] getHistory error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve prediction history.' });
  }
}

// GET /ai/signals
async function getSignals(req, res) {
  const redis = req.app.locals.redis;
  const cacheKey = 'signals:all';

  try {
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json({ ...JSON.parse(cached), fromCache: true });
      }
    }

    const signals = await Promise.all(
      WATCHED_PAIRS.map(async (symbol) => {
        try {
          const { candles, isMock } = await fetchOHLCV(symbol, '1h', 100);
          const indicators = calculateAll(candles);

          // Lightweight signal generation (rule-based, no AI cost)
          const signal = ruleBased(symbol, indicators);

          return {
            symbol,
            direction: signal.direction,
            confidence: signal.confidence,
            currentPrice: indicators.currentPrice,
            rsi: indicators.rsi,
            macdHistogram: indicators.macd?.histogram,
            marketBias: signal.marketBias,
            isMock,
          };
        } catch (err) {
          console.error(`[AIController] getSignals error for ${symbol}:`, err.message);
          return { symbol, direction: 'HOLD', confidence: 50, error: err.message };
        }
      })
    );

    const payload = {
      signals,
      generatedAt: new Date().toISOString(),
      disclaimer: 'For educational purposes only. Not financial advice.',
    };

    if (redis) {
      await redis.setEx(cacheKey, 300, JSON.stringify(payload)); // 5-minute cache
    }

    return res.json(payload);
  } catch (err) {
    console.error('[AIController] getSignals error:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve market signals.' });
  }
}

// Image analysis prompt shared across providers
const IMAGE_ANALYSIS_PROMPT = `You are a professional forex/trading chart analyst. Analyze this trading chart or signal screenshot and provide a structured JSON response with the following fields:
{
  "symbol": "detected currency pair or asset (e.g. EUR/USD) or 'Unknown'",
  "timeframe": "detected timeframe (e.g. 1H, 4H, 1D) or 'Unknown'",
  "direction": "BUY, SELL, or HOLD based on chart analysis",
  "confidence": <number 0-100>,
  "entryPrice": <detected or estimated entry price, or null>,
  "stopLoss": <detected or estimated stop loss, or null>,
  "takeProfit": <detected or estimated take profit, or null>,
  "trend": "UPTREND, DOWNTREND, or SIDEWAYS",
  "patterns": ["list of identified chart patterns, indicators, or signals"],
  "reasoning": "detailed analysis of what you see in the chart",
  "keyLevels": "important support/resistance levels visible",
  "keyRisks": "main risks associated with this trade",
  "marketBias": "BULLISH, BEARISH, or NEUTRAL",
  "timeHorizon": "suggested trade duration",
  "disclaimer": "For educational purposes only. Not financial advice."
}

Respond ONLY with valid JSON. No markdown, no extra text.`;

function parseImageAnalysisJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

async function analyzeImageWithGemini(imageBase64, mimeType) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const imageData = { inlineData: { data: imageBase64, mimeType } };
  const result = await model.generateContent([IMAGE_ANALYSIS_PROMPT, imageData]);
  const text = result.response.text();
  return { text, provider: 'gemini' };
}

async function analyzeImageWithOpenAI(imageBase64, mimeType) {
  const OpenAI = require('openai');
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: IMAGE_ANALYSIS_PROMPT },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 1024,
  });
  const text = response.choices[0]?.message?.content || '';
  return { text, provider: 'openai' };
}

// POST /ai/analyze-image
async function analyzeImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided.' });
  }

  const userId = req.user.id;

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' });
  }

  // Validate file size before base64 encoding to avoid payload limits
  if (req.file.size > MAX_IMAGE_BYTES_FOR_GEMINI) {
    return res.status(413).json({ error: 'Image file is too large. Maximum allowed size is 7.5 MB.' });
  }

  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Image analysis requires an AI API key. Please configure GEMINI_API_KEY or OPENAI_API_KEY.' });
  }

  try {
    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Try AI providers in order: Gemini → OpenAI Vision
    let aiResult = null;
    const analysisErrors = [];

    if (process.env.GEMINI_API_KEY) {
      try {
        aiResult = await analyzeImageWithGemini(imageBase64, mimeType);
      } catch (err) {
        analysisErrors.push(`gemini: ${err.message}`);
        console.warn('[AIController] analyzeImage Gemini failed:', err.message);
      }
    }

    if (!aiResult && process.env.OPENAI_API_KEY) {
      try {
        aiResult = await analyzeImageWithOpenAI(imageBase64, mimeType);
      } catch (err) {
        analysisErrors.push(`openai: ${err.message}`);
        console.warn('[AIController] analyzeImage OpenAI Vision failed:', err.message);
      }
    }

    if (!aiResult) {
      console.error('[AIController] analyzeImage: all providers failed:', analysisErrors);
      return res.status(503).json({
        error: 'Image analysis is temporarily unavailable. Please check your API keys and try again.',
      });
    }

    let analysis;
    try {
      analysis = parseImageAnalysisJson(aiResult.text);
    } catch (parseErr) {
      console.warn('[AIController] analyzeImage: could not parse AI JSON response:', parseErr.message);
      analysis = {
        direction: 'HOLD',
        confidence: 50,
        reasoning: aiResult.text,
        disclaimer: 'For educational purposes only. Not financial advice.',
      };
    }

    analysis.aiProvider = aiResult.provider;

    // Persist analysis
    try {
      await pool.query(
        'INSERT INTO signal_analyses (user_id, image_name, analysis) VALUES ($1, $2, $3)',
        [userId, req.file.originalname || 'upload', JSON.stringify(analysis)]
      );
    } catch (dbErr) {
      console.error('[AIController] analyzeImage save error:', dbErr.message);
    }

    // Log tool_use activity with geo data and update last_active (non-blocking)
    const imgIP = extractIP(req);
    const imgUA = req.headers['user-agent'] || null;
    const { device_type: imgDT, browser: imgBR, os: imgOS } = parseUserAgent(imgUA);
    const imgRedis = req.app.locals.redis;
    geoLookup(imgIP, imgRedis).then((geo) => {
      pool.query(
        `INSERT INTO user_activity
           (user_id, action, ip_address, country, country_code, city, region, isp,
            latitude, longitude, user_agent, device_type, browser, os, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [userId, 'tool_use', imgIP, geo.country, geo.country_code, geo.city,
         geo.region, geo.isp, geo.latitude, geo.longitude, imgUA, imgDT, imgBR, imgOS,
         JSON.stringify({ tool: 'image_analysis' })]
      ).catch((err) => console.error('[AI] Failed to log tool_use:', err.message));
    }).catch(() => {});

    pool.query(
      'UPDATE users SET last_active = NOW() WHERE id = $1',
      [userId]
    ).catch((err) => console.error('[AI] Failed to update last_active:', err.message));

    return res.json({ analysis });
  } catch (err) {
    console.error('[AIController] analyzeImage error:', err.message);
    return res.status(500).json({ error: 'Failed to analyse image. Please try again.' });
  }
}

module.exports = { predict, getHistory, getSignals, analyzeImage };
