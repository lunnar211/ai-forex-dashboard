'use strict';

const Groq = require('groq-sdk');
const { MASTER_SYSTEM_PROMPT } = require('./masterPrompt');

let groqClient = null;

function getClient() {
  if (!groqClient && process.env.GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

function buildTradingPrompt(symbol, timeframe, indicators, priceData) {
  return `You are a master trading analyst with 20+ years on institutional trading desks at top-tier hedge funds and investment banks. You have deep expertise in technical analysis, market microstructure, and quantitative methods.

INSTRUMENT: ${symbol}
TIMEFRAME: ${timeframe}
CURRENT PRICE: ${indicators.currentPrice}
24H CHANGE: ${indicators.priceChange}%
24H HIGH: ${indicators.highLow?.high24h}  |  24H LOW: ${indicators.highLow?.low24h}

TECHNICAL INDICATORS:
─────────────────────────────────────────
RSI (14): ${indicators.rsi}
  → ${indicators.rsi > 70 ? 'OVERBOUGHT — potential reversal or pullback' : indicators.rsi < 30 ? 'OVERSOLD — potential bounce or reversal' : 'NEUTRAL — no extreme reading'}
  → Check for divergence: if price makes new high/low but RSI does not, signal weakens

MACD:
  MACD Line  : ${indicators.macd?.macd}
  Signal Line: ${indicators.macd?.signal}
  Histogram  : ${indicators.macd?.histogram}
  → ${(indicators.macd?.histogram || 0) > 0 ? 'Bullish momentum — histogram above zero' : 'Bearish momentum — histogram below zero'}
  → Histogram expanding = strengthening momentum; contracting = weakening momentum

Bollinger Bands:
  Upper : ${indicators.bollinger?.upper}
  Middle: ${indicators.bollinger?.middle}  (20-SMA)
  Lower : ${indicators.bollinger?.lower}
  → Price is ${indicators.currentPrice > (indicators.bollinger?.upper || 0) ? 'ABOVE upper band (overbought / breakout candidate)' : indicators.currentPrice < (indicators.bollinger?.lower || 0) ? 'BELOW lower band (oversold / breakdown candidate)' : 'INSIDE bands (mean-reverting environment)'}
  → Band width indicates volatility; squeeze = potential explosive move ahead

Exponential Moving Averages:
  EMA 20 : ${indicators.ema?.ema20}
  EMA 50 : ${indicators.ema?.ema50}
  EMA 200: ${indicators.ema?.ema200}
  → Short-term trend : ${indicators.currentPrice > (indicators.ema?.ema20 || 0) ? 'BULLISH' : 'BEARISH'}
  → Medium-term trend: ${indicators.currentPrice > (indicators.ema?.ema50 || 0) ? 'BULLISH' : 'BEARISH'}
  → Long-term trend  : ${indicators.currentPrice > (indicators.ema?.ema200 || 0) ? 'BULLISH' : 'BEARISH'}
  → EMA alignment (20>50>200 = bullish stack; 20<50<200 = bearish stack)

ATR (14): ${indicators.atr}  [volatility / stop-distance reference]
Volume  : ${indicators.volumeTrend}

KEY LEVELS:
  Support   : ${indicators.supportResistance?.support?.join(' | ') || 'N/A'}
  Resistance: ${indicators.supportResistance?.resistance?.join(' | ') || 'N/A'}
─────────────────────────────────────────
RECENT PRICE ACTION (last 5 closes):
${JSON.stringify(priceData.slice(-5).map((c) => ({ open: c.open, high: c.high, low: c.low, close: c.close })), null, 2)}

ANALYSIS REQUIREMENTS:
Perform a comprehensive multi-factor analysis covering:
1. Multi-timeframe trend alignment (short/medium/long term)
2. Key support/resistance levels and their strength
3. RSI divergence detection (regular and hidden)
4. MACD signal quality and momentum assessment
5. Bollinger Band squeeze/expansion analysis
6. EMA crossover signals and trend strength
7. ATR-based position sizing (minimum 1:2 risk/reward)
8. Risk/reward ratio calculation

Respond ONLY with valid JSON in the following exact structure — no markdown, no prose outside JSON:
{
  "direction": "BUY" | "SELL" | "HOLD",
  "confidence": <number 0-100>,
  "entryPrice": <number>,
  "stopLoss": <number>,
  "takeProfit": <number>,
  "riskRewardRatio": <number>,
  "reasoning": "<one-sentence signal summary>",
  "keyRisks": "<brief description of what would invalidate this setup>",
  "marketBias": "BULLISH" | "BEARISH" | "NEUTRAL",
  "timeHorizon": "<estimated trade duration based on timeframe>",
  "disclaimer": "For educational purposes only. Not financial advice.",
  "why_explanation": "<4-6 sentence professional explanation of the full reason for this signal. Reference specific price levels and indicator values. Explain the confluence. Mention the risk. End with the trade plan summary.>",
  "technical_confirmations": [
    "<specific confirmation 1 with indicator value and implication>",
    "<specific confirmation 2>",
    "<specific confirmation 3>"
  ],
  "smart_money_analysis": [
    "<order block / BOS / liquidity observation 1>",
    "<order block / BOS / liquidity observation 2>"
  ],
  "risks": [
    "<specific risk 1: invalidation level or upcoming event>",
    "<specific risk 2>"
  ],
  "entry_strategy": "<exact entry instruction: at market / limit / confirmation candle>",
  "exit_strategy": "<trade management: SL move to breakeven trigger, partial close at TP1, runner to TP2>"
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
    fibLevels: parsed.fibLevels || '',
    emaAlignment: parsed.emaAlignment || '',
    disclaimer: 'For educational purposes only. Not financial advice.',
    aiProvider: 'groq',
    // Deep analysis fields
    why_explanation:         parsed.why_explanation         || null,
    explanation:             parsed.why_explanation         || parsed.reasoning || null,
    technical_confirmations: Array.isArray(parsed.technical_confirmations) ? parsed.technical_confirmations : [],
    smart_money_analysis:    Array.isArray(parsed.smart_money_analysis)    ? parsed.smart_money_analysis    : [],
    news_context:            Array.isArray(parsed.news_context)            ? parsed.news_context            : [],
    risks:                   Array.isArray(parsed.risks)                   ? parsed.risks                   : [],
    entry_strategy:          parsed.entry_strategy          || null,
    exit_strategy:           parsed.exit_strategy           || null,
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
        content: MASTER_SYSTEM_PROMPT,
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
