'use strict';

/**
 * Multi-AI Consensus Engine
 *
 * Sends the same forex analysis request to ALL available AI providers
 * simultaneously, collects all responses, runs a weighted mathematical
 * consensus algorithm, and returns ONE final high-accuracy trading signal.
 *
 * Provider weights (must total 1.0):
 *   Claude      30%  – best at maths & structured reasoning
 *   OpenAI      25%  – strong general financial analysis
 *   Groq        20%  – fast, reliable fundamentals
 *   Gemini      15%  – good pattern recognition
 *   OpenRouter  10%  – additional signal diversity
 */

const Anthropic              = require('@anthropic-ai/sdk');
const Groq                   = require('groq-sdk');
const OpenAI                 = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios                  = require('axios');
const { buildMasterPrompt }  = require('./masterPrompt');
const { getAllMarketData }    = require('./marketDataService');

// ── Provider weights ───────────────────────────────────────────────────────────
const WEIGHTS = {
  claude:     0.30,
  openai:     0.25,
  groq:       0.20,
  gemini:     0.15,
  openrouter: 0.10,
};

// ── Timeout wrapper ────────────────────────────────────────────────────────────
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Provider timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// ── Individual AI callers ──────────────────────────────────────────────────────

async function callClaude(symbol, timeframe, systemPrompt) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('No ANTHROPIC_API_KEY');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Analyse: Symbol=${symbol} Timeframe=${timeframe} Time=${new Date().toISOString()} Return JSON only.`,
    }],
  });
  return parseJSON(msg.content[0].text, 'claude');
}

async function callGroq(symbol, timeframe, systemPrompt) {
  if (!process.env.GROQ_API_KEY) throw new Error('No GROQ_API_KEY');
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const res = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 2000,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Analyse: Symbol=${symbol} Timeframe=${timeframe} Time=${new Date().toISOString()} Return JSON only.`,
      },
    ],
  });
  return parseJSON(res.choices[0].message.content, 'groq');
}

async function callOpenAI(symbol, timeframe, systemPrompt) {
  if (!process.env.OPENAI_API_KEY) throw new Error('No OPENAI_API_KEY');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Analyse: Symbol=${symbol} Timeframe=${timeframe} Time=${new Date().toISOString()} Return JSON only.`,
      },
    ],
  });
  return parseJSON(res.choices[0].message.content, 'openai');
}

async function callGemini(symbol, timeframe, systemPrompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error('No GEMINI_API_KEY');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  const result = await model.generateContent(
    `${systemPrompt}\n\nAnalyse: Symbol=${symbol} Timeframe=${timeframe} Time=${new Date().toISOString()} Return JSON only.`
  );
  return parseJSON(result.response.text(), 'gemini');
}

async function callOpenRouter(symbol, timeframe, systemPrompt) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('No OPENROUTER_API_KEY');
  const res = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'meta-llama/llama-3.1-405b-instruct',
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Analyse: Symbol=${symbol} Timeframe=${timeframe} Time=${new Date().toISOString()} Return JSON only.`,
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );
  return parseJSON(res.data.choices[0].message.content, 'openrouter');
}

// ── JSON parser with markdown-fence cleanup ────────────────────────────────────
function parseJSON(raw, provider) {
  try {
    const clean = raw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    return { provider, data: JSON.parse(clean), error: null };
  } catch {
    return { provider, data: null, error: `JSON parse failed: ${raw.slice(0, 120)}` };
  }
}

// ── Map direction string to numeric score ──────────────────────────────────────
function dirScore(direction) {
  if (!direction) return 0;
  const d = direction.toString().toUpperCase();
  if (d === 'BUY')  return 1;
  if (d === 'SELL') return -1;
  return 0;
}

// ── Helper: drill into a nested path like "indicators.rsi.signal" ─────────────
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// ── Count indicator votes across providers ────────────────────────────────────
function countVotes(results, path) {
  const votes = { BUY: 0, SELL: 0, NEUTRAL: 0 };
  for (const r of results) {
    const val = getPath(r.data, path);
    if (val) {
      const key = val.toString().toUpperCase();
      votes[key] = (votes[key] || 0) + 1;
    }
  }
  return votes;
}

// ── Weighted consensus algorithm ───────────────────────────────────────────────
function buildConsensus(results, symbol, timeframe) {
  const valid   = results.filter((r) => r.data && r.data.setup === true && r.data.direction);
  const noSetup = results.filter((r) => r.data && r.data.setup === false);
  const failed  = results.filter((r) => r.error || !r.data);

  console.log(
    `[MultiAI] ${symbol}/${timeframe} — valid: ${valid.length} | no_setup: ${noSetup.length} | failed: ${failed.length}`
  );

  // If majority say no setup, respect the caution
  if (noSetup.length > valid.length) {
    const sample = noSetup[0]?.data;
    return {
      setup:         false,
      market:        symbol,
      timeframe,
      reason:        `Majority of AI providers (${noSetup.length}/${results.length}) found no valid trade setup. ${sample?.reason || ''}`.trim(),
      market_sentiment: sample?.market_sentiment || 'NEUTRAL',
      next_level_to_watch: sample?.next_level_to_watch || '',
      providers_responded: results.map((r) => ({
        provider: r.provider,
        status:   r.error ? 'failed' : r.data?.setup ? 'signal' : 'no_setup',
      })),
    };
  }

  if (valid.length === 0) {
    // All failed or no data — nothing to build from
    const errMsg = failed.map((r) => `${r.provider}: ${r.error}`).join('; ');
    throw new Error(`No AI provider returned a valid signal. ${errMsg}`);
  }

  // ── Weighted direction + confidence accumulation ───────────────────────────
  let weightedScore = 0;
  let totalWeight = 0;
  let weightedConfidence = 0;
  let weightedProbability = 0;
  let weightedConfluence = 0;

  for (const r of valid) {
    const w = WEIGHTS[r.provider] ?? 0.10;
    const conf = Number(r.data.confidence) || 50;
    const score = dirScore(r.data.direction);

    weightedScore += score * w * conf;
    weightedConfidence += conf * w;
    weightedProbability += (Number(r.data.probability_of_success) || 50) * w;
    weightedConfluence += (Number(r.data.confluence_score) || 50) * w;
    totalWeight += w;
  }

  if (totalWeight > 0) {
    weightedConfidence /= totalWeight;
    weightedProbability /= totalWeight;
    weightedConfluence /= totalWeight;
  }

  // ── Final direction decision ───────────────────────────────────────────────
  let finalDirection;
  if (weightedScore > 8) finalDirection = 'BUY';
  else if (weightedScore < -8) finalDirection = 'SELL';
  else                         finalDirection = 'NEUTRAL';

  // Agreement bonus / penalty
  const allAgree = valid.every((r) => r.data.direction === valid[0].data.direction);
  if (allAgree && valid.length >= 2) {
    weightedConfidence = Math.min(99, weightedConfidence + 12);
  } else if (!allAgree) {
    weightedConfidence = Math.max(10, weightedConfidence - 15);
  }

  // ── Best provider — used for price levels ─────────────────────────────────
  const best = [...valid].sort(
    (a, b) => (Number(b.data.confidence) || 0) - (Number(a.data.confidence) || 0)
  )[0];

  // ── Indicator consensus votes ──────────────────────────────────────────────
  const indicatorVotes = {
    ema_stack: countVotes(valid, 'indicators.ema_stack.signal'),
    rsi:       countVotes(valid, 'indicators.rsi.signal'),
    macd:      countVotes(valid, 'indicators.macd.signal'),
    bollinger: countVotes(valid, 'indicators.bollinger.signal'),
    fibonacci: countVotes(valid, 'indicators.fibonacci.signal'),
    z_score:   countVotes(valid, 'indicators.z_score.signal'),
  };

  const consensusConf = Math.round(weightedConfidence);
  const reasoning = allAgree
    ? `All ${valid.length} AI models agree: ${finalDirection}. Average confidence ${consensusConf}%. Confluence score ${Math.round(weightedConfluence)}%. ${best.data.reasoning || ''}`.trim()
    : `${valid.length} AI models analysed. Weighted consensus: ${finalDirection}. Models disagreed — confidence reduced. Best signal from ${best.provider} at ${best.data.confidence}% confidence. Trade with caution.`;

  return {
    setup: true,
    market: symbol,
    timeframe,
    direction: finalDirection,
    confidence: consensusConf,
    probability_of_success: Math.round(weightedProbability),
    confluence_score: Math.round(weightedConfluence),
    entry_price: best.data.entry_price,
    stop_loss: best.data.stop_loss,
    take_profit_1: best.data.take_profit_1,
    take_profit_2: best.data.take_profit_2,
    risk_reward_ratio: best.data.risk_reward_ratio,
    kelly_position_size: best.data.kelly_position_size,
    max_account_risk: '2%',
    trend: best.data.trend,
    market_sentiment: best.data.market_sentiment,
    strategy_used: best.data.strategy_used,
    all_agreed: allAgree,
    providers_count: valid.length,
    indicator_votes: indicatorVotes,
    individual_results: valid.map((r) => ({
      provider: r.provider,
      direction: r.data.direction,
      confidence: r.data.confidence,
      confluence: r.data.confluence_score,
      weight: `${Math.round((WEIGHTS[r.provider] ?? 0.10) * 100)}%`,
    })),
    failed_providers: failed.map((r) => ({ provider: r.provider, error: r.error })),
    reasoning,
  };
}

// ── Normalise multi-AI result to the standard prediction shape ────────────────
function normaliseMultiAI(consensus, symbol) {
  if (!consensus.setup) {
    // Return a HOLD prediction shape so the caller can handle "no setup"
    return {
      direction:        'HOLD',
      confidence:       0,
      entryPrice:       0,
      stopLoss:         0,
      takeProfit:       0,
      riskRewardRatio:  0,
      reasoning:        consensus.reason || 'No valid trade setup identified by multi-AI consensus.',
      keyRisks:         'Insufficient confluence across AI providers.',
      marketBias:       consensus.market_sentiment || 'NEUTRAL',
      timeHorizon:      '',
      disclaimer:       'This is an AI-generated analysis. Not financial advice.',
      aiProvider:       'multi_ai',
      agreement:        null,
      providers_used:   (consensus.providers_responded || []).map((p) => p.provider),
      confluence_score: 0,
      kelly_position_size: '0%',
      individual_results_list: consensus.providers_responded || [],
    };
  }

  const dirMap = { BUY: 'BUY', SELL: 'SELL', NEUTRAL: 'HOLD', HOLD: 'HOLD' };
  const normDir = dirMap[consensus.direction?.toUpperCase()] || 'HOLD';

  return {
    direction:        normDir,
    confidence:       consensus.confidence,
    entryPrice:       parseFloat(consensus.entry_price)   || 0,
    stopLoss:         parseFloat(consensus.stop_loss)     || 0,
    takeProfit:       parseFloat(consensus.take_profit_1) || parseFloat(consensus.take_profit_2) || 0,
    riskRewardRatio:  Number(consensus.risk_reward_ratio) || 0,
    reasoning:        consensus.reasoning || '',
    keyRisks:         consensus.all_agreed
      ? `All ${consensus.providers_count} AI providers agree. High-conviction signal.`
      : `${consensus.providers_count} providers polled. Disagreement detected — exercise caution.`,
    marketBias:       consensus.market_sentiment || 'NEUTRAL',
    timeHorizon:      consensus.timeframe || '',
    fibLevels:        `Take Profit 1: ${consensus.take_profit_1 || '—'}  Take Profit 2: ${consensus.take_profit_2 || '—'}`,
    emaAlignment:     consensus.trend || '',
    disclaimer:       'Multi-AI Consensus: 5 independent models weighted by capability. Not financial advice.',
    aiProvider:       'multi_ai',
    agreement:        consensus.all_agreed,
    providers_used:   (consensus.individual_results || []).map((r) => r.provider),
    confluence_score: consensus.confluence_score,
    kelly_position_size: consensus.kelly_position_size,
    // Extended multi-AI fields — picked up by PredictionCard
    individual_results_list: consensus.individual_results || [],
    indicator_votes:         consensus.indicator_votes   || {},
    failed_providers:        consensus.failed_providers  || [],
    all_agreed:              consensus.all_agreed,
    providers_count:         consensus.providers_count,
  };
}

// ── Main export ────────────────────────────────────────────────────────────────
const PROVIDER_TIMEOUT_MS = 30000;

async function generateMultiAIPrediction(symbol, timeframe) {
  console.log(`[MultiAI] Fetching live market data for ${symbol}…`);
  const marketData = await getAllMarketData(symbol);

  if (marketData.quote) {
    console.log(`[MultiAI] Live price: ${marketData.quote.current_price} (${symbol})`);
  } else {
    console.warn('[MultiAI] No live price data — AI will use training knowledge');
  }

  // Build prompt enriched with live price, sentiment, and news
  const livePrompt = buildMasterPrompt(marketData);

  console.log(`[MultiAI] Starting parallel analysis: ${symbol} ${timeframe}`);

  const [claude, groq, openaiRes, gemini, openrouter] = await Promise.allSettled([
    withTimeout(callClaude(symbol, timeframe, livePrompt),     PROVIDER_TIMEOUT_MS),
    withTimeout(callGroq(symbol, timeframe, livePrompt),       PROVIDER_TIMEOUT_MS),
    withTimeout(callOpenAI(symbol, timeframe, livePrompt),     PROVIDER_TIMEOUT_MS),
    withTimeout(callGemini(symbol, timeframe, livePrompt),     PROVIDER_TIMEOUT_MS),
    withTimeout(callOpenRouter(symbol, timeframe, livePrompt), PROVIDER_TIMEOUT_MS),
  ]);

  const results = [
    claude.status     === 'fulfilled' ? claude.value     : { provider: 'claude',     data: null, error: claude.reason?.message     || 'Unknown error' },
    groq.status       === 'fulfilled' ? groq.value       : { provider: 'groq',       data: null, error: groq.reason?.message       || 'Unknown error' },
    openaiRes.status  === 'fulfilled' ? openaiRes.value  : { provider: 'openai',     data: null, error: openaiRes.reason?.message  || 'Unknown error' },
    gemini.status     === 'fulfilled' ? gemini.value     : { provider: 'gemini',     data: null, error: gemini.reason?.message     || 'Unknown error' },
    openrouter.status === 'fulfilled' ? openrouter.value : { provider: 'openrouter', data: null, error: openrouter.reason?.message || 'Unknown error' },
  ];

  const consensus = buildConsensus(results, symbol, timeframe);
  const normalised = normaliseMultiAI(consensus, symbol);

  // Attach live price metadata so the frontend can display it
  normalised.live_price_used = Boolean(marketData.quote);
  normalised.live_price      = marketData.quote?.current_price ?? null;
  normalised.live_change_pct = marketData.quote?.change_pct    ?? null;

  return normalised;
}

module.exports = { generateMultiAIPrediction };
