'use strict';

const { fetchOHLCV } = require('../services/forexService');
const { calculateAll } = require('../services/indicatorService');
const groqService = require('../services/groqService');
const openaiService = require('../services/openaiService');
const geminiService = require('../services/geminiService');
const openrouterService = require('../services/openrouterService');
const { pool } = require('../config/database');

const WATCHED_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'XAU/USD'];
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const RATE_LIMIT_MAX = 20;

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
  const { symbol = 'EUR/USD', timeframe = '1h' } = req.body;
  const userId = req.user.id;
  const redis = req.app.locals.redis;

  // Rate limit
  const rateCheck = await checkRateLimit(redis, userId);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Rate limit exceeded. You can make ${RATE_LIMIT_MAX} predictions per hour. Resets in ${rateCheck.resetInSeconds}s.`,
    });
  }

  try {
    // 1. Fetch candle data
    const { candles, isMock } = await fetchOHLCV(symbol, timeframe, 100);

    // 2. Calculate indicators
    const indicators = calculateAll(candles);

    // 3. Try AI providers in order
    let prediction = null;
    const errors = [];

    for (const [name, service] of [
      ['groq', groqService],
      ['openai', openaiService],
      ['gemini', geminiService],
      ['openrouter', openrouterService],
    ]) {
      try {
        prediction = await service.getAIPrediction(symbol, timeframe, indicators, candles);
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

    // 5. Persist
    const saved = await savePrediction(userId, symbol, timeframe, prediction);

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

  const { GoogleGenerativeAI } = require('@google/generative-ai');

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Image analysis requires a Gemini API key. Please configure GEMINI_API_KEY.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const imageData = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype,
      },
    };

    const prompt = `You are a professional forex/trading chart analyst. Analyze this trading chart or signal screenshot and provide a structured JSON response with the following fields:
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

    const result = await model.generateContent([prompt, imageData]);
    const text = result.response.text();

    let analysis;
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(match ? match[0] : cleaned);
    } catch (parseErr) {
      console.warn('[AIController] analyzeImage: could not parse AI JSON response:', parseErr.message);
      analysis = {
        direction: 'HOLD',
        confidence: 50,
        reasoning: text,
        disclaimer: 'For educational purposes only. Not financial advice.',
        aiProvider: 'gemini',
      };
    }

    analysis.aiProvider = 'gemini';

    // Persist analysis
    try {
      await pool.query(
        'INSERT INTO signal_analyses (user_id, image_name, analysis) VALUES ($1, $2, $3)',
        [userId, req.file.originalname || 'upload', JSON.stringify(analysis)]
      );
    } catch (dbErr) {
      console.error('[AIController] analyzeImage save error:', dbErr.message);
    }

    return res.json({ analysis });
  } catch (err) {
    console.error('[AIController] analyzeImage error:', err.message);
    return res.status(500).json({ error: 'Failed to analyse image. Please try again.' });
  }
}

module.exports = { predict, getHistory, getSignals, analyzeImage };
