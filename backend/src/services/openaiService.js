'use strict';

const OpenAI = require('openai');
const { buildTradingPrompt } = require('./groqService');
const { MASTER_SYSTEM_PROMPT } = require('./masterPrompt');

let openaiClient = null;

function getClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function parseAIResponse(content, indicators) {
  const cleaned = content.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No valid JSON found in OpenAI response');
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
    disclaimer: 'For educational purposes only. Not financial advice.',
    aiProvider: 'openai',
  };
}

/**
 * Generate an AI trading prediction using OpenAI (gpt-4o-mini).
 *
 * @param {string}   symbol
 * @param {string}   timeframe
 * @param {object}   indicators
 * @param {object[]} priceData
 * @returns {Promise<object>}
 */
async function getAIPrediction(symbol, timeframe, indicators, priceData) {
  const client = getClient();
  if (!client) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = buildTradingPrompt(symbol, timeframe, indicators, priceData);

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: MASTER_SYSTEM_PROMPT,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 1024,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content || '';
  return parseAIResponse(content, indicators);
}

module.exports = { getAIPrediction };
