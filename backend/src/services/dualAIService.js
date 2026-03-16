'use strict';
const { generatePrediction: claudePredict } = require('./claudeService');
const groqService = require('./groqService');
const { fetchOHLCV } = require('./forexService');
const { calculateAll } = require('./indicatorService');

/**
 * Converts a direction string to a numeric score.
 * BUY = 1, SELL = -1, NEUTRAL/HOLD = 0
 */
function directionScore(direction) {
  if (!direction) return 0;
  const d = direction.toString().toUpperCase();
  if (d === 'BUY') return 1;
  if (d === 'SELL') return -1;
  return 0;
}

/**
 * Normalises a Claude snake_case result to the camelCase format used by the
 * rest of the application (aiController, PredictionCard, etc.).
 */
function normaliseClaude(claudeResult, symbol, indicators) {
  const direction = ['BUY', 'SELL', 'HOLD', 'NEUTRAL'].includes(
    (claudeResult.direction || '').toUpperCase()
  )
    ? claudeResult.direction.toUpperCase()
    : 'HOLD';

  // Treat NEUTRAL the same as HOLD so the frontend displays it correctly
  const normalisedDirection = direction === 'NEUTRAL' ? 'HOLD' : direction;

  const entryPrice = parseFloat(claudeResult.entry_price) || (indicators ? indicators.currentPrice : 0);
  const stopLoss = parseFloat(claudeResult.stop_loss) || 0;
  const takeProfit = parseFloat(claudeResult.take_profit) || 0;
  const riskRewardRatio = Number(claudeResult.risk_reward_ratio) || 2.0;

  return {
    direction: normalisedDirection,
    confidence: Math.min(100, Math.max(0, Number(claudeResult.confidence) || 50)),
    entryPrice,
    stopLoss,
    takeProfit,
    riskRewardRatio,
    reasoning: claudeResult.reasoning || 'Claude analysis unavailable.',
    keyRisks: 'Market conditions may change rapidly. Claude quantitative analysis.',
    marketBias: normalisedDirection === 'BUY' ? 'BULLISH' : normalisedDirection === 'SELL' ? 'BEARISH' : 'NEUTRAL',
    timeHorizon: 'Short-term (1–4 hours)',
    disclaimer: 'For educational purposes only. Not financial advice.',
    aiProvider: 'claude',
    // Pass through extended Claude fields for dual-AI consumers
    kelly_position_size: claudeResult.kelly_position_size || 'N/A',
    confluence_score: claudeResult.confluence_score || 50,
    claude_indicators: claudeResult.indicators || {},
    // Keep raw direction for combining (before NEUTRAL→HOLD normalisation)
    _raw_direction: direction,
  };
}

/**
 * Weighted combination of two predictions.
 * Claude gets 60 % weight (deeper math), Groq gets 40 % (fast market sense).
 * If both agree: confidence boosted by 15 points.
 * If they disagree: confidence reduced, direction from higher-confidence model.
 */
function combinePredictions(claudeNorm, groqResult) {
  const CLAUDE_WEIGHT = 0.60;
  const GROQ_WEIGHT   = 0.40;

  // Use the raw pre-normalisation direction for combining logic
  const claudeDir = claudeNorm._raw_direction || claudeNorm.direction;
  const groqDir   = groqResult.direction;

  const claudeScore = directionScore(claudeDir);
  const groqScore   = directionScore(groqDir);

  const claudeConf = claudeNorm.confidence;
  const groqConf   = Number(groqResult.confidence) || 50;

  // Weighted direction score
  const combinedScore = (claudeScore * CLAUDE_WEIGHT * claudeConf) +
                        (groqScore   * GROQ_WEIGHT   * groqConf);

  // Weighted confidence
  let finalConfidence = (claudeConf * CLAUDE_WEIGHT) + (groqConf * GROQ_WEIGHT);

  // Agreement bonus / disagreement penalty
  const bothAgree = claudeDir === groqDir;
  if (bothAgree) {
    finalConfidence = Math.min(99, finalConfidence + 15);
  } else {
    finalConfidence = Math.max(10, finalConfidence - 20);
  }

  // Final direction from combined score
  let finalDirection;
  if (combinedScore > 10)       finalDirection = 'BUY';
  else if (combinedScore < -10) finalDirection = 'SELL';
  else                          finalDirection = 'HOLD';

  // Use Claude's precise price levels (deeper math), fallback to Groq
  const entryPrice     = claudeNorm.entryPrice   || groqResult.entryPrice   || 0;
  const stopLoss       = claudeNorm.stopLoss      || groqResult.stopLoss     || 0;
  const takeProfit     = claudeNorm.takeProfit    || groqResult.takeProfit   || 0;
  const riskRewardRatio = claudeNorm.riskRewardRatio || groqResult.riskRewardRatio || 2.0;

  const reasoning = bothAgree
    ? `Both Claude and Groq agree: ${finalDirection}. Claude confidence: ${claudeConf}%, Groq confidence: ${groqConf}%. ${claudeNorm.reasoning || ''}`
    : `Claude signals ${claudeDir} (${claudeConf}%), Groq signals ${groqDir} (${groqConf}%). Combined weight favours ${finalDirection}. Use caution — conflicting signals.`;

  return {
    direction:         finalDirection,
    confidence:        Math.round(finalConfidence),
    entryPrice,
    stopLoss,
    takeProfit,
    riskRewardRatio,
    reasoning,
    keyRisks: bothAgree
      ? 'Both AI models agree — standard market risks apply.'
      : 'Conflicting AI signals detected. Exercise extra caution and wait for confirmation.',
    marketBias: finalDirection === 'BUY' ? 'BULLISH' : finalDirection === 'SELL' ? 'BEARISH' : 'NEUTRAL',
    timeHorizon: 'Short-term (1–4 hours)',
    disclaimer: 'For educational purposes only. Not financial advice.',
    aiProvider: 'dual_ai',
    // Extended dual-AI fields
    agreement: bothAgree,
    providers_used: ['claude', 'groq'],
    kelly_position_size: claudeNorm.kelly_position_size || 'N/A',
    confluence_score: claudeNorm.confluence_score || 50,
    individual_results: {
      claude: {
        direction:  claudeDir,
        confidence: claudeConf,
        reasoning:  claudeNorm.reasoning || '',
        indicators: claudeNorm.claude_indicators || {},
      },
      groq: {
        direction:  groqDir,
        confidence: groqConf,
        reasoning:  groqResult.reasoning || '',
      },
    },
  };
}

/**
 * Runs Claude and Groq simultaneously then merges their outputs into one
 * high-accuracy signal.
 *
 * @param {string} symbol
 * @param {string} timeframe
 * @returns {Promise<object>}
 */
async function generateDualPrediction(symbol, timeframe) {
  // Fetch price data once — shared by both providers
  const { candles } = await fetchOHLCV(symbol, timeframe, 100);
  const indicators = calculateAll(candles);

  // Run both AIs simultaneously for speed
  const [claudeSettled, groqSettled] = await Promise.allSettled([
    claudePredict(symbol, timeframe),
    groqService.getAIPrediction(symbol, timeframe, indicators, candles),
  ]);

  const claudeOk = claudeSettled.status === 'fulfilled';
  const groqOk   = groqSettled.status   === 'fulfilled';

  // Both succeeded — combine them
  if (claudeOk && groqOk) {
    const claudeNorm = normaliseClaude(claudeSettled.value, symbol, indicators);
    return combinePredictions(claudeNorm, groqSettled.value);
  }

  // Only Claude succeeded
  if (claudeOk) {
    console.warn('[DualAI] Groq failed:', groqSettled.reason?.message);
    const claudeNorm = normaliseClaude(claudeSettled.value, symbol, indicators);
    return { ...claudeNorm, providers_used: ['claude'], agreement: null };
  }

  // Only Groq succeeded
  if (groqOk) {
    console.warn('[DualAI] Claude failed:', claudeSettled.reason?.message);
    return { ...groqSettled.value, providers_used: ['groq'], agreement: null };
  }

  // Both failed
  throw new Error(
    `Both AI providers failed. Claude: ${claudeSettled.reason?.message}. Groq: ${groqSettled.reason?.message}`
  );
}

module.exports = { generateDualPrediction, normaliseClaude };
