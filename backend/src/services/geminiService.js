'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { buildTradingPrompt } = require('./groqService');

let geminiClient = null;

function getClient() {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return geminiClient;
}

function parseAIResponse(content, indicators) {
  const cleaned = content.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No valid JSON found in Gemini response');
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
    buyReasons: Array.isArray(parsed.buyReasons) ? parsed.buyReasons : [],
    sellReasons: Array.isArray(parsed.sellReasons) ? parsed.sellReasons : [],
    nextSignalEta: parsed.nextSignalEta || 'Monitor for next confluence setup.',
    aiProvider: 'gemini',
  };
}

/**
 * Generate an AI trading prediction using Google Gemini (gemini-1.5-flash).
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
    throw new Error('Gemini API key not configured');
  }

  const prompt = buildTradingPrompt(symbol, timeframe, indicators, priceData);

  const model = client.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  });

  const systemInstruction =
    'You are a professional forex trading analyst. Always respond with valid JSON only. No markdown, no extra text outside the JSON object.';

  const result = await model.generateContent(`${systemInstruction}\n\n${prompt}`);
  const content = result.response.text();
  return parseAIResponse(content, indicators);
}

module.exports = { getAIPrediction };
