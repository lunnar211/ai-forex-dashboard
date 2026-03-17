'use strict';

const axios = require('axios');
const { buildTradingPrompt } = require('./groqService');
const { MASTER_SYSTEM_PROMPT } = require('./masterPrompt');

const COHERE_CHAT_URL = 'https://api.cohere.com/v1/chat';
const COHERE_MODEL = 'command-r';

function parseAIResponse(content, indicators) {
  const cleaned = content.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No valid JSON found in Cohere response');
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
    aiProvider: 'cohere',
  };
}

/**
 * Generate an AI trading prediction using Cohere (command-r).
 *
 * @param {string}   symbol
 * @param {string}   timeframe
 * @param {object}   indicators  Output of indicatorService.calculateAll()
 * @param {object[]} priceData   Array of recent OHLCV candles
 * @returns {Promise<object>}
 */
async function getAIPrediction(symbol, timeframe, indicators, priceData) {
  if (!process.env.COHERE_API_KEY) {
    throw new Error('Cohere API key not configured');
  }

  const prompt = buildTradingPrompt(symbol, timeframe, indicators, priceData);

  const response = await axios.post(
    COHERE_CHAT_URL,
    {
      model: COHERE_MODEL,
      preamble: MASTER_SYSTEM_PROMPT,
      message: prompt,
      temperature: 0.3,
      max_tokens: 1024,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  const content = response.data?.text || '';
  return parseAIResponse(content, indicators);
}

module.exports = { getAIPrediction };
