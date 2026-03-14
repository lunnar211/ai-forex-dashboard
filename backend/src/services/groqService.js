'use strict';

const Groq = require('groq-sdk');

let groqClient = null;

function getClient() {
  if (!groqClient && process.env.GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

function buildTradingPrompt(symbol, timeframe, indicators, priceData) {
  const stochLabel =
    (indicators.stochastic?.k || 50) > 80 ? 'OVERBOUGHT' :
    (indicators.stochastic?.k || 50) < 20 ? 'OVERSOLD' : 'NEUTRAL';
  const wRLabel =
    (indicators.williamsR || -50) > -20 ? 'OVERBOUGHT' :
    (indicators.williamsR || -50) < -80 ? 'OVERSOLD' : 'NEUTRAL';
  const cciLabel =
    (indicators.cci || 0) > 100 ? 'OVERBOUGHT' :
    (indicators.cci || 0) < -100 ? 'OVERSOLD' : 'NEUTRAL';
  const adxStrength =
    (indicators.adx?.adx || 25) > 50 ? 'VERY STRONG' :
    (indicators.adx?.adx || 25) > 25 ? 'STRONG' : 'WEAK/CONSOLIDATING';

  return `You are a senior professional forex analyst and algorithmic trading specialist with over 15 years of experience in institutional trading. Analyse the following market data and provide a precise, data-driven trading prediction.

INSTRUMENT: ${symbol}
TIMEFRAME: ${timeframe}
CURRENT PRICE: ${indicators.currentPrice}
24H CHANGE: ${indicators.priceChange}%
24H HIGH: ${indicators.highLow?.high24h}  |  24H LOW: ${indicators.highLow?.low24h}

TECHNICAL INDICATORS:
─────────────────────────────────────────
RSI (14): ${indicators.rsi}
  → ${indicators.rsi > 70 ? 'OVERBOUGHT — potential reversal or pullback' : indicators.rsi < 30 ? 'OVERSOLD — potential bounce or reversal' : 'NEUTRAL — no extreme reading'}

MACD:
  MACD Line  : ${indicators.macd?.macd}
  Signal Line: ${indicators.macd?.signal}
  Histogram  : ${indicators.macd?.histogram}
  → ${(indicators.macd?.histogram || 0) > 0 ? 'Bullish momentum — histogram above zero' : 'Bearish momentum — histogram below zero'}

Stochastic Oscillator:
  %K: ${indicators.stochastic?.k}  %D: ${indicators.stochastic?.d}
  → ${stochLabel}${(indicators.stochastic?.k || 50) > (indicators.stochastic?.d || 50) ? ' — %K above %D (bullish crossover)' : ' — %K below %D (bearish crossover)'}

Williams %R (14): ${indicators.williamsR}
  → ${wRLabel}

CCI (20): ${indicators.cci}
  → ${cciLabel}

ADX (14): ${indicators.adx?.adx}  [trend strength: ${adxStrength}]
  +DI: ${indicators.adx?.plusDI}  -DI: ${indicators.adx?.minusDI}
  → ${(indicators.adx?.plusDI || 0) > (indicators.adx?.minusDI || 0) ? 'Bullish directional dominance' : 'Bearish directional dominance'}

Bollinger Bands:
  Upper : ${indicators.bollinger?.upper}
  Middle: ${indicators.bollinger?.middle}  (20-SMA)
  Lower : ${indicators.bollinger?.lower}
  → Price is ${indicators.currentPrice > (indicators.bollinger?.upper || 0) ? 'ABOVE upper band (overbought / breakout)' : indicators.currentPrice < (indicators.bollinger?.lower || 0) ? 'BELOW lower band (oversold / breakdown)' : 'INSIDE bands (mean-reverting environment)'}

Exponential Moving Averages:
  EMA 20 : ${indicators.ema?.ema20}
  EMA 50 : ${indicators.ema?.ema50}
  EMA 200: ${indicators.ema?.ema200}
  → Short-term trend : ${indicators.currentPrice > (indicators.ema?.ema20 || 0) ? 'BULLISH' : 'BEARISH'}
  → Medium-term trend: ${indicators.currentPrice > (indicators.ema?.ema50 || 0) ? 'BULLISH' : 'BEARISH'}
  → Long-term trend  : ${indicators.currentPrice > (indicators.ema?.ema200 || 0) ? 'BULLISH' : 'BEARISH'}

Fibonacci Levels (50-bar swing):
  High: ${indicators.fibonacci?.high}  Low: ${indicators.fibonacci?.low}
  23.6%: ${indicators.fibonacci?.levels?.fib236}
  38.2%: ${indicators.fibonacci?.levels?.fib382}
  50.0%: ${indicators.fibonacci?.levels?.fib500}
  61.8%: ${indicators.fibonacci?.levels?.fib618}  [Golden ratio — strong S/R]
  78.6%: ${indicators.fibonacci?.levels?.fib786}

ATR (14): ${indicators.atr}  [volatility / stop-distance reference]
Volume  : ${indicators.volumeTrend}

KEY LEVELS:
  Support   : ${indicators.supportResistance?.support?.join(' | ') || 'N/A'}
  Resistance: ${indicators.supportResistance?.resistance?.join(' | ') || 'N/A'}
─────────────────────────────────────────
RECENT PRICE ACTION (last 5 closes):
${JSON.stringify(priceData.slice(-5).map((c) => ({ open: c.open, high: c.high, low: c.low, close: c.close })), null, 2)}

TASK:
Based on a comprehensive multi-factor analysis of ALL indicators above, determine:
1. The most probable near-term directional bias (BUY / SELL / HOLD).
2. A confidence score (0–100) reflecting the conviction level.
3. Precise entry price, stop-loss, and take-profit targets using ATR-based methodology.
4. A concise but professional reasoning narrative (3–5 sentences) covering confluence factors.
5. Key risks that could invalidate this setup.
6. An array of 3-5 specific, concise bullet-point reasons WHY to BUY (even if direction is not BUY, list the bullish case).
7. An array of 3-5 specific, concise bullet-point reasons WHY to SELL (even if direction is not SELL, list the bearish case).
8. An estimated time window for the NEXT high-probability signal, e.g. "RSI approaching oversold — expect BUY signal in ~2-4 hours" or "Stochastic crossover imminent — watch next 1-2 candles".

Respond ONLY with valid JSON in the following exact structure — no markdown, no prose outside JSON:
{
  "direction": "BUY" | "SELL" | "HOLD",
  "confidence": <number 0-100>,
  "entryPrice": <number>,
  "stopLoss": <number>,
  "takeProfit": <number>,
  "riskRewardRatio": <number>,
  "reasoning": "<professional multi-sentence analysis>",
  "keyRisks": "<brief description of invalidation risks>",
  "marketBias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "timeHorizon": "<estimated trade duration>",
  "disclaimer": "For educational purposes only. Not financial advice.",
  "buyReasons": ["<reason 1>", "<reason 2>", "<reason 3>"],
  "sellReasons": ["<reason 1>", "<reason 2>", "<reason 3>"],
  "nextSignalEta": "<description of when next signal may occur>"
}`;
}

function parseAIResponse(content, symbol, indicators) {
  // Strip any markdown code fences if present
  const cleaned = content.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Attempt to extract JSON object from the response
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No valid JSON found in AI response');
    parsed = JSON.parse(match[0]);
  }

  // Ensure required fields exist with sensible defaults
  return {
    direction: ['BUY', 'SELL', 'HOLD'].includes(parsed.direction) ? parsed.direction : 'HOLD',
    confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
    entryPrice: Number(parsed.entryPrice) || indicators.currentPrice,
    stopLoss: Number(parsed.stopLoss) || 0,
    takeProfit: Number(parsed.takeProfit) || 0,
    riskRewardRatio: Number(parsed.riskRewardRatio) || 0,
    reasoning: parsed.reasoning || 'Analysis unavailable.',
    keyRisks: parsed.keyRisks || 'Market conditions may change rapidly.',
    marketBias: parsed.marketBias || 'NEUTRAL',
    timeHorizon: parsed.timeHorizon || 'Short-term',
    disclaimer: 'For educational purposes only. Not financial advice.',
    buyReasons: Array.isArray(parsed.buyReasons) ? parsed.buyReasons : [],
    sellReasons: Array.isArray(parsed.sellReasons) ? parsed.sellReasons : [],
    nextSignalEta: parsed.nextSignalEta || 'Monitor for next confluence setup.',
    aiProvider: 'groq',
  };
}

/**
 * Generate an AI trading prediction using Groq (llama-3.1-70b-versatile).
 *
 * @param {string}   symbol
 * @param {string}   timeframe
 * @param {object}   indicators  Output of indicatorService.calculateAll()
 * @param {object[]} priceData   Array of recent OHLCV candles
 * @returns {Promise<object>}
 */
async function getAIPrediction(symbol, timeframe, indicators, priceData) {
  const client = getClient();
  if (!client) {
    throw new Error('Groq API key not configured');
  }

  const prompt = buildTradingPrompt(symbol, timeframe, indicators, priceData);

  const completion = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content:
          'You are a professional forex trading analyst. Always respond with valid JSON only. No markdown, no extra text.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  });

  const content = completion.choices[0]?.message?.content || '';
  return parseAIResponse(content, symbol, indicators);
}

module.exports = { getAIPrediction, buildTradingPrompt };
