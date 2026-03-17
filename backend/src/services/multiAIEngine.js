'use strict';

/**
 * Multi-AI Consensus Engine
 *
 * Sends the same forex analysis request to ALL available AI providers
 * simultaneously, collects all responses, runs a weighted mathematical
 * consensus algorithm, and returns ONE final high-accuracy trading signal.
 *
 * Provider weights (total = 1.0):
 *   Groq         30%  – fast, reliable fundamentals (llama-3.1-8b-instant)
 *   HuggingFace  25%  – Qwen2.5-7B, excellent JSON output
 *   Gemini       20%  – strong pattern recognition (gemini-1.5-flash)
 *   Mistral      15%  – precise structured reasoning (open-mistral-7b)
 *   OpenRouter   10%  – additional signal diversity (phi-3-mini free)
 */

const Groq                   = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios                  = require('axios');
const { getAllMarketData }    = require('./marketDataService');

// ── Provider weights (total = 1.0) ────────────────────────────────────────────
const WEIGHTS = {
  groq:        0.30,
  huggingface: 0.25,
  gemini:      0.20,
  mistral:     0.15,
  openrouter:  0.10,
};

// ── JSON parser with markdown-fence cleanup ────────────────────────────────────
function parseJSON(raw, provider) {
  try {
    const clean = (raw || '').trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(clean);
    return { provider, data: parsed, error: null };
  } catch {
    // Try to find JSON object in response
    const match = (raw || '').match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return { provider, data: JSON.parse(match[0]), error: null };
      } catch { /* fall through */ }
    }
    return { provider, data: null, error: `JSON parse failed from ${provider}` };
  }
}

// ── Map direction string to numeric score ──────────────────────────────────────
function dirScore(d) {
  const s = (d || '').toString().toUpperCase();
  if (s === 'BUY')  return 1;
  if (s === 'SELL') return -1;
  return 0;
}

// ── Short prompt for fast models to avoid timeout ─────────────────────────────
function buildShortPrompt(symbol, timeframe, marketData) {
  const quote = marketData?.quote;
  const price = quote?.current_price || 'unknown';
  const high  = quote?.high          || 'unknown';
  const low   = quote?.low           || 'unknown';
  const prev  = quote?.previous_close || 'unknown';

  return `You are an expert forex trader and quantitative analyst.

LIVE DATA:
Symbol: ${symbol}
Timeframe: ${timeframe}
Current Price: ${price}
Today High: ${high}
Today Low: ${low}
Previous Close: ${prev}
Time: ${new Date().toISOString()}

Analyse using: RSI, MACD, EMA stack, Bollinger Bands, ATR, Fibonacci, Support/Resistance, Smart Money Concepts.

Rules:
- Max 2% account risk per trade
- Min 1:3 risk reward ratio
- Only trade if confluence >= 58%
- Stop Loss = ATR x 1.5 from entry
- TP1 = ATR x 2.5, TP2 = ATR x 4.5

Return ONLY this JSON (no markdown, no text outside JSON):
{
  "setup": true,
  "direction": "BUY",
  "entry_price": "1.0854",
  "stop_loss": "1.0821",
  "take_profit_1": "1.0920",
  "take_profit_2": "1.0987",
  "confidence": 78,
  "probability_of_success": 72,
  "risk_reward_ratio": 2.0,
  "confluence_score": 68,
  "trend": "UPTREND",
  "market_sentiment": "BULLISH",
  "strategy_used": "EMA + RSI + SMC",
  "reasoning": "Price bouncing off 61.8% Fibonacci with RSI divergence"
}

If no valid setup return:
{"setup": false, "direction": "NEUTRAL", "confidence": 0, "reason": "Low confluence"}`;
}

// ── PROVIDER 1: Groq (fastest — use small fast model) ─────────────────────────
async function callGroq(symbol, timeframe, marketData) {
  if (!process.env.GROQ_API_KEY) throw new Error('No GROQ_API_KEY');
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY.trim() });
  const prompt = buildShortPrompt(symbol, timeframe, marketData);

  const res = await client.chat.completions.create({
    model:      'llama-3.1-8b-instant',
    max_tokens: 500,
    messages: [
      { role: 'system', content: 'You are a forex analyst. Return JSON only.' },
      { role: 'user',   content: prompt },
    ],
  });
  return parseJSON(res.choices[0].message.content, 'groq');
}

// ── PROVIDER 2: HuggingFace (Qwen2.5-7B — best free model) ───────────────────
async function callHuggingFace(symbol, timeframe, marketData) {
  if (!process.env.HUGGINGFACE_API_KEY) throw new Error('No HUGGINGFACE_API_KEY');
  const key    = process.env.HUGGINGFACE_API_KEY.trim();
  const prompt = buildShortPrompt(symbol, timeframe, marketData);

  const res = await axios.post(
    'https://api-inference.huggingface.co/models/Qwen/Qwen2.5-7B-Instruct/v1/chat/completions',
    {
      model: 'Qwen/Qwen2.5-7B-Instruct',
      messages: [
        { role: 'system', content: 'You are a forex analyst. Return JSON only. No markdown.' },
        { role: 'user',   content: prompt },
      ],
      max_tokens: 500,
      stream: false,
    },
    {
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type':  'application/json',
      },
      timeout: 25000,
    }
  );

  const content = res.data?.choices?.[0]?.message?.content || '';
  return parseJSON(content, 'huggingface');
}

// ── PROVIDER 3: Gemini (gemini-1.5-flash — avoids 429 from flash-2.0) ────────
async function callGemini(symbol, timeframe, marketData) {
  if (!process.env.GEMINI_API_KEY) throw new Error('No GEMINI_API_KEY');
  const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
  const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const prompt = buildShortPrompt(symbol, timeframe, marketData);

  const result = await model.generateContent(prompt);
  return parseJSON(result.response.text(), 'gemini');
}

// ── PROVIDER 4: Mistral (open-mistral-7b free tier) ──────────────────────────
async function callMistral(symbol, timeframe, marketData) {
  if (!process.env.MISTRAL_API_KEY) throw new Error('No MISTRAL_API_KEY');
  const key    = process.env.MISTRAL_API_KEY.trim();
  const prompt = buildShortPrompt(symbol, timeframe, marketData);

  const res = await axios.post(
    'https://api.mistral.ai/v1/chat/completions',
    {
      model:      'open-mistral-7b',
      max_tokens: 500,
      messages: [
        { role: 'system', content: 'You are a forex analyst. Return JSON only.' },
        { role: 'user',   content: prompt },
      ],
    },
    {
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type':  'application/json',
      },
      timeout: 20000,
    }
  );
  return parseJSON(res.data.choices[0].message.content, 'mistral');
}

// ── PROVIDER 5: OpenRouter (correct free model) ───────────────────────────────
async function callOpenRouter(symbol, timeframe, marketData) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('No OPENROUTER_API_KEY');
  const key    = process.env.OPENROUTER_API_KEY.trim();
  const prompt = buildShortPrompt(symbol, timeframe, marketData);

  const res = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model:      'microsoft/phi-3-mini-128k-instruct:free',
      max_tokens: 500,
      messages: [
        { role: 'system', content: 'You are a forex analyst. Return JSON only.' },
        { role: 'user',   content: prompt },
      ],
    },
    {
      headers: {
        'Authorization':  `Bearer ${key}`,
        'Content-Type':   'application/json',
        'HTTP-Referer':   'https://ai-forex-frontend.onrender.com',
        'X-Title':        'ForexAI Terminal',
      },
      timeout: 20000,
    }
  );
  return parseJSON(res.data.choices[0].message.content, 'openrouter');
}

// ── Weighted consensus algorithm ───────────────────────────────────────────────
function buildConsensus(results, symbol, timeframe) {
  const valid  = results.filter(r => r.data && r.data.direction &&
    r.data.direction !== 'NEUTRAL' && r.data.direction !== 'HOLD');
  const failed = results.filter(r => r.error || !r.data);

  console.log(`[MultiAI] ${symbol} ${timeframe}: Valid=${valid.length} Failed=${failed.length}`);

  // If no valid signals → return clean NEUTRAL (not error text)
  if (valid.length === 0) {
    return {
      setup:             false,
      direction:         'NEUTRAL',
      confidence:        0,
      entry_price:       null,
      stop_loss:         null,
      take_profit_1:     null,
      take_profit_2:     null,
      risk_reward_ratio: null,
      confluence_score:  0,
      trend:             'RANGING',
      market_sentiment:  'NEUTRAL',
      providers_count:   0,
      reason:            'No clear trade setup found. Market conditions unclear.',
      individual_results: [],
      failed_providers:  failed.map(r => r.provider),
    };
  }

  let weightedScore = 0;
  let weightedConf  = 0;
  let weightedProb  = 0;
  let totalWeight   = 0;

  for (const r of valid) {
    const w    = WEIGHTS[r.provider] || 0.10;
    const conf = Number(r.data.confidence) || 50;
    weightedScore += dirScore(r.data.direction) * w * conf;
    weightedConf  += conf * w;
    weightedProb  += (Number(r.data.probability_of_success) || 50) * w;
    totalWeight   += w;
  }

  if (totalWeight > 0) {
    weightedConf /= totalWeight;
    weightedProb /= totalWeight;
  }

  let direction;
  if (weightedScore > 5)       direction = 'BUY';
  else if (weightedScore < -5) direction = 'SELL';
  else                         direction = 'NEUTRAL';

  const allAgree = valid.every(r => r.data.direction === valid[0].data.direction);
  if (allAgree && valid.length >= 2) weightedConf = Math.min(99, weightedConf + 12);
  if (!allAgree)                     weightedConf = Math.max(10, weightedConf - 8);

  // Best result = highest confidence with valid prices
  const best = [...valid]
    .filter(r => r.data.entry_price && r.data.stop_loss)
    .sort((a, b) => (Number(b.data.confidence) || 0) - (Number(a.data.confidence) || 0))[0]
    || valid[0];

  const consensusConf = Math.round(weightedConf);

  return {
    setup:              true,
    direction,
    confidence:         consensusConf,
    probability_of_success: Math.round(weightedProb),
    confluence_score:   Math.round(best.data.confluence_score || weightedConf),
    entry_price:        best.data.entry_price   || null,
    stop_loss:          best.data.stop_loss     || null,
    take_profit_1:      best.data.take_profit_1 || null,
    take_profit_2:      best.data.take_profit_2 || null,
    risk_reward_ratio:  best.data.risk_reward_ratio || null,
    trend:              best.data.trend         || 'UNKNOWN',
    market_sentiment:   best.data.market_sentiment || (direction === 'BUY' ? 'BULLISH' : 'BEARISH'),
    strategy_used:      best.data.strategy_used || 'Multi-AI Consensus',
    all_agreed:         allAgree,
    providers_count:    valid.length,
    individual_results: valid.map(r => ({
      provider:   r.provider,
      direction:  r.data.direction,
      confidence: r.data.confidence,
      weight:     `${Math.round((WEIGHTS[r.provider] || 0.10) * 100)}%`,
    })),
    failed_providers: failed.map(r => r.provider),
    reasoning: allAgree
      ? `${valid.length} AI models agree: ${direction}. Confidence ${consensusConf}%. ${best.data.reasoning || ''}`.trim()
      : `Weighted consensus: ${direction} from ${valid.length} models. Best signal: ${best.provider}. ${best.data.reasoning || ''}`.trim(),
  };
}

// ── Extract error message from a settled Promise rejection ────────────────────
function extractError(reason) {
  return reason?.message?.slice(0, 100) || 'Unknown error';
}

// ── Main export ────────────────────────────────────────────────────────────────
async function generateMultiAIPrediction(symbol, timeframe) {
  console.log(`[MultiAI] Starting: ${symbol} ${timeframe}`);

  // Get live market data
  let marketData = {};
  try {
    marketData = await getAllMarketData(symbol);
    if (marketData?.quote?.current_price) {
      console.log(`[MultiAI] Live price: ${marketData.quote.current_price}`);
    }
  } catch {
    console.warn('[MultiAI] Market data unavailable, using AI knowledge');
  }

  // Run all providers simultaneously with individual error handling
  const [groq, hf, gemini, mistral, openrouter] = await Promise.allSettled([
    callGroq(symbol, timeframe, marketData),
    callHuggingFace(symbol, timeframe, marketData),
    callGemini(symbol, timeframe, marketData),
    callMistral(symbol, timeframe, marketData),
    callOpenRouter(symbol, timeframe, marketData),
  ]);

  const results = [
    groq.status       === 'fulfilled' ? groq.value
      : { provider: 'groq',        data: null, error: extractError(groq.reason) },
    hf.status         === 'fulfilled' ? hf.value
      : { provider: 'huggingface', data: null, error: extractError(hf.reason) },
    gemini.status     === 'fulfilled' ? gemini.value
      : { provider: 'gemini',      data: null, error: extractError(gemini.reason) },
    mistral.status    === 'fulfilled' ? mistral.value
      : { provider: 'mistral',     data: null, error: extractError(mistral.reason) },
    openrouter.status === 'fulfilled' ? openrouter.value
      : { provider: 'openrouter',  data: null, error: extractError(openrouter.reason) },
  ];

  const consensus = buildConsensus(results, symbol, timeframe);

  // Add camelCase aliases for backward compatibility with aiController DB save
  const entryPriceNum  = parseFloat(consensus.entry_price)   || null;
  const stopLossNum    = parseFloat(consensus.stop_loss)     || null;
  const takeProfitNum  = parseFloat(consensus.take_profit_1) || parseFloat(consensus.take_profit_2) || null;

  return {
    ...consensus,
    // camelCase aliases
    entryPrice:      entryPriceNum,
    stopLoss:        stopLossNum,
    takeProfit:      takeProfitNum,
    riskRewardRatio: Number(consensus.risk_reward_ratio) || null,
    aiProvider:      'multi_ai',
    // live price metadata
    live_price_used:  Boolean(marketData.quote),
    live_price:       marketData.quote?.current_price ?? null,
    live_change_pct:  marketData.quote?.change_pct    ?? null,
  };
}

module.exports = { generateMultiAIPrediction };
