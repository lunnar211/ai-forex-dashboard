'use strict';

const OpenAI = require('openai');
const { buildTradingPrompt } = require('./groqService');
const { MASTER_SYSTEM_PROMPT } = require('./masterPrompt');

// OpenRouter is OpenAI-API-compatible; we point the client at the OpenRouter
// base URL and supply the OPENROUTER_API_KEY as the bearer token.
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// A capable free-tier model available on OpenRouter.
const OPENROUTER_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

let openrouterClient = null;

function getClient() {
  if (!openrouterClient && process.env.OPENROUTER_API_KEY) {
    openrouterClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
    });
  }
  return openrouterClient;
}

function parseAIResponse(content, indicators) {
  const cleaned = content.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No valid JSON found in OpenRouter response');
    parsed = JSON.parse(match[0]);
  }

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
    aiProvider: 'openrouter',
  };
}

/**
 * Generate an AI trading prediction via OpenRouter.
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
    throw new Error('OpenRouter API key not configured');
  }

  const prompt = buildTradingPrompt(symbol, timeframe, indicators, priceData);

  const completion = await client.chat.completions.create({
    model: OPENROUTER_MODEL,
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
  return parseAIResponse(content, indicators);
}

module.exports = { getAIPrediction };
