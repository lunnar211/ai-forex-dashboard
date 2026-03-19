'use strict';

const OpenAI = require('openai');
const { buildTradingPrompt } = require('./groqService');
const { MASTER_SYSTEM_PROMPT } = require('./masterPrompt');

let deepseekChatClient = null;
let deepseekReasonClient = null;

function getChatClient() {
  if (!deepseekChatClient && process.env.DEEPSEEK_API_KEY) {
    deepseekChatClient = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });
  }
  return deepseekChatClient;
}

function getReasonClient() {
  if (!deepseekReasonClient && process.env.DEEPSEEK_API_KEY) {
    deepseekReasonClient = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });
  }
  return deepseekReasonClient;
}

function parseAIResponse(content, indicators) {
  const cleaned = (content || '').replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No valid JSON found in DeepSeek response');
    parsed = JSON.parse(match[0]);
  }

  return {
    direction: ['BUY', 'SELL', 'HOLD'].includes(parsed.direction) ? parsed.direction : 'HOLD',
    confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
    entryPrice: parsed.entryPrice != null ? Number(parsed.entryPrice) : indicators.currentPrice,
    stopLoss: parsed.stopLoss != null ? Number(parsed.stopLoss) : 0,
    takeProfit: parsed.takeProfit != null ? Number(parsed.takeProfit) : 0,
    riskRewardRatio: Number(parsed.riskRewardRatio) || 0,
    reasoning: parsed.reasoning || 'Analysis unavailable.',
    explanation: parsed.explanation || parsed.reasoning || '',
    keyRisks: parsed.keyRisks || 'Market conditions may change rapidly.',
    marketBias: parsed.marketBias || 'NEUTRAL',
    timeHorizon: parsed.timeHorizon || 'Short-term',
    fibLevels: parsed.fibLevels || '',
    emaAlignment: parsed.emaAlignment || '',
    disclaimer: 'For educational purposes only. Not financial advice.',
    aiProvider: 'deepseek',
  };
}

/**
 * Generate an AI trading prediction using DeepSeek Chat (deepseek-chat).
 */
async function getAIPrediction(symbol, timeframe, indicators, priceData) {
  const client = getChatClient();
  if (!client) {
    throw new Error('DeepSeek API key not configured (DEEPSEEK_API_KEY)');
  }

  const model = process.env.DEEPSEEK_MODEL_CHAT || 'deepseek-chat';
  const prompt = buildTradingPrompt(symbol, timeframe, indicators, priceData);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: MASTER_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content || '';
  return parseAIResponse(content, indicators);
}

/**
 * Generate an AI trading prediction using DeepSeek Reasoner (deepseek-reasoner).
 */
async function getAIPredictionReasoner(symbol, timeframe, indicators, priceData) {
  const client = getReasonClient();
  if (!client) {
    throw new Error('DeepSeek API key not configured (DEEPSEEK_API_KEY)');
  }

  const model = process.env.DEEPSEEK_MODEL_REASON || 'deepseek-reasoner';
  const prompt = buildTradingPrompt(symbol, timeframe, indicators, priceData);

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: MASTER_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content || '';
  const result = parseAIResponse(content, indicators);
  result.aiProvider = 'deepseek-r1';
  return result;
}

module.exports = { getAIPrediction, getAIPredictionReasoner };
