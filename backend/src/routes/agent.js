'use strict';

/**
 * agent.js
 *
 * Lumos AI Trading Agent routes:
 *   POST /agent/chat   — conversational trading analysis with live-data tool calls
 *   GET  /agent/status — agent health / configuration check
 *
 * Flow:
 *  1. User message → Groq (llama-3.3-70b-versatile) with Lumos system prompt
 *  2. If response contains ACTION tags, fetch live data (Finnhub / NewsData)
 *  3. Tool results injected back into conversation → Groq final answer
 *  4. On Groq failure, fall back to HuggingFace Qwen2.5-7B-Instruct
 */

const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const Groq = require('groq-sdk');
const { getLiveQuote, getForexNews } = require('../services/marketDataService');

const router = express.Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_NAME             = 'Lumos';
const GROQ_MODEL             = 'llama-3.3-70b-versatile';
const HF_MODEL               = 'Qwen/Qwen2.5-7B-Instruct';
const HF_API_URL             = `https://api-inference.huggingface.co/models/${HF_MODEL}/v1/chat/completions`;
const MAX_CONVERSATION_TURNS = 10;
const MAX_NEWS_HEADLINES     = 3;

const LUMOS_SYSTEM_PROMPT = `You are Lumos, an advanced AI trading agent.
Analyze forex/crypto markets using RSI, MACD, ATR.
Give BUY/SELL/HOLD signals with Entry/SL/TP.
If you need live data respond with:
ACTION: FETCH_PRICE
SYMBOL: EURUSD
Output: Signal/Confidence/Entry/SL/TP/Risk/Reasoning`;

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests to the agent. Please slow down.' },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalise a symbol string like "EURUSD" or "EUR/USD" → "EUR/USD".
 */
function normaliseSymbol(raw) {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  // Already has a slash or colon separator
  if (s.includes('/') || s.includes(':')) return s.replace(/:/g, '/');
  // 6-char forex pair: EURUSD → EUR/USD
  if (/^[A-Z]{6}$/.test(s)) return `${s.slice(0, 3)}/${s.slice(3)}`;
  // Crypto or stock left as-is
  return s;
}

/**
 * Parse ACTION blocks from a Groq response string.
 * Returns an array of { action, symbol } objects.
 */
function parseActions(text) {
  const actions = [];
  const lines = text.split('\n').map((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('ACTION:')) {
      const action = lines[i].replace('ACTION:', '').trim().toUpperCase();
      const nextLine = lines[i + 1] || '';
      const symbolMatch = nextLine.match(/^SYMBOL:\s*(.+)/i);
      const symbol = symbolMatch ? normaliseSymbol(symbolMatch[1]) : null;
      if (action && symbol) actions.push({ action, symbol });
    }
  }
  return actions;
}

/**
 * Build a tool-result message string to feed back into Groq.
 */
async function resolveActions(actions) {
  const results = [];
  for (const { action, symbol } of actions) {
    if (action === 'FETCH_PRICE') {
      try {
        const quote = await getLiveQuote(symbol);
        if (quote) {
          results.push(
            `[TOOL RESULT] FETCH_PRICE for ${symbol}:\n` +
            `  Current Price : ${quote.current_price}\n` +
            `  Open          : ${quote.open}\n` +
            `  High          : ${quote.high}\n` +
            `  Low           : ${quote.low}\n` +
            `  Previous Close: ${quote.previous_close}\n` +
            `  Change %      : ${quote.change_pct}%\n` +
            `  Timestamp     : ${quote.timestamp}`
          );
        } else {
          results.push(`[TOOL RESULT] FETCH_PRICE for ${symbol}: data unavailable`);
        }
      } catch (err) {
        console.error(`[Agent] FETCH_PRICE failed for ${symbol}:`, err.message);
        results.push(`[TOOL RESULT] FETCH_PRICE for ${symbol}: fetch error — data unavailable`);
      }
    } else if (action === 'FETCH_NEWS') {
      try {
        const news = await getForexNews(symbol);
        const articles = news?.articles ?? (Array.isArray(news) ? news : null);
        if (articles && articles.length) {
          const headlines = articles.slice(0, MAX_NEWS_HEADLINES).map((n) => `  • ${n.title}`).join('\n');
          results.push(`[TOOL RESULT] FETCH_NEWS for ${symbol}:\n${headlines}`);
        } else {
          results.push(`[TOOL RESULT] FETCH_NEWS for ${symbol}: no recent headlines`);
        }
      } catch (err) {
        console.error(`[Agent] FETCH_NEWS failed for ${symbol}:`, err.message);
        results.push(`[TOOL RESULT] FETCH_NEWS for ${symbol}: fetch error — data unavailable`);
      }
    }
  }
  return results.join('\n\n');
}

/**
 * Call Groq with the full conversation messages array.
 * Returns the assistant reply string.
 */
async function callGroq(messages) {
  const client = new Groq({ apiKey: (process.env.GROQ_API_KEY || '').trim() });
  const res = await client.chat.completions.create({
    model: GROQ_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 1024,
  });
  return res.choices[0]?.message?.content || '';
}

/**
 * HuggingFace Inference API fallback (Qwen2.5-7B-Instruct).
 * Works without an API key (free tier) but is rate-limited.
 */
async function callHuggingFace(messages) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.HUGGINGFACE_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.HUGGINGFACE_API_KEY}`;
  }
  const res = await axios.post(
    HF_API_URL,
    { model: HF_MODEL, messages, temperature: 0.4, max_tokens: 1024 },
    { headers, timeout: 30000 }
  );
  return res.data?.choices?.[0]?.message?.content || '';
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /agent/status
 * Returns the agent's configuration and availability.
 */
router.get('/status', (req, res) => {
  res.json({
    agent: AGENT_NAME,
    status: 'online',
    primaryModel: GROQ_MODEL,
    fallbackModel: HF_MODEL,
    tools: ['FETCH_PRICE', 'FETCH_NEWS'],
    providers: {
      groq:     process.env.GROQ_API_KEY     ? 'configured' : 'not configured',
      finnhub:  process.env.FINNHUB_API_KEY  ? 'configured' : 'not configured',
      newsdata: process.env.NEWSDATA_API_KEY ? 'configured' : 'not configured',
    },
  });
});

/**
 * POST /agent/chat
 *
 * Body:
 *   { message: string, conversationHistory?: Array<{role, content}> }
 *
 * Response:
 *   { agent, model, response, toolsUsed }
 */
router.post('/chat', agentLimiter, async (req, res) => {
  const { message, conversationHistory = [] } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required.' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'Groq API key not configured.' });
  }

  // Build initial message list
  const messages = [
    { role: 'system', content: LUMOS_SYSTEM_PROMPT },
    ...conversationHistory.slice(-MAX_CONVERSATION_TURNS), // keep last N turns for context window
    { role: 'user', content: message.trim() },
  ];

  let modelUsed   = GROQ_MODEL;
  let toolsUsed   = [];
  let reply       = '';

  try {
    // ── Round 1: initial Groq call ───────────────────────────────────────────
    reply = await callGroq(messages);

    // ── Tool resolution ──────────────────────────────────────────────────────
    const actions = parseActions(reply);
    if (actions.length > 0) {
      toolsUsed = actions.map((a) => a.action);
      const toolResults = await resolveActions(actions);

      if (toolResults) {
        // ── Round 2: Groq final answer with live data ────────────────────────
        const messagesWithTools = [
          ...messages,
          { role: 'assistant', content: reply },
          { role: 'user',      content: toolResults },
        ];
        reply = await callGroq(messagesWithTools);
      }
    }
  } catch (err) {
    console.error('[Agent] Groq call failed, trying HuggingFace fallback:', err.message);
    modelUsed = HF_MODEL;
    try {
      reply = await callHuggingFace(messages);
    } catch (hfErr) {
      console.error('[Agent] HuggingFace fallback also failed:', hfErr.message);
      return res.status(502).json({
        error: 'All AI providers are currently unavailable. Please try again later.',
      });
    }
  }

  return res.json({
    agent:     AGENT_NAME,
    model:     modelUsed,
    response:  reply,
    toolsUsed: toolsUsed.length ? toolsUsed : undefined,
  });
});

module.exports = router;
