'use strict';

// ─── EMA ─────────────────────────────────────────────────────────────────────

/**
 * Exponential Moving Average.
 * @param {number[]} closes
 * @param {number}  period
 * @returns {number[]}  array aligned with closes (leading values are NaN)
 */
function calculateEMA(closes, period) {
  if (!closes || closes.length < period) return closes.map(() => NaN);

  const k = 2 / (period + 1);
  const result = new Array(closes.length).fill(NaN);

  // Seed with simple average of first `period` values
  const seed = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = seed;

  for (let i = period; i < closes.length; i++) {
    result[i] = closes[i] * k + result[i - 1] * (1 - k);
  }

  return result;
}

// ─── RSI ─────────────────────────────────────────────────────────────────────

/**
 * Relative Strength Index.
 * @param {number[]} closes
 * @param {number}  period
 * @returns {{ values: number[], current: number }}
 */
function calculateRSI(closes, period = 14) {
  if (!closes || closes.length <= period) {
    return { values: [], current: 50 };
  }

  const values = new Array(closes.length).fill(NaN);
  let avgGain = 0;
  let avgLoss = 0;

  // Initial average over first `period` changes
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  values[period] = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    values[i] = parseFloat(rsi.toFixed(2));
  }

  const current = values.filter((v) => !isNaN(v)).pop() || 50;
  return { values, current: parseFloat(current.toFixed(2)) };
}

// ─── MACD ─────────────────────────────────────────────────────────────────────

/**
 * MACD (Moving Average Convergence Divergence).
 * @param {number[]} closes
 * @param {number}  fast     Fast EMA period (default 12)
 * @param {number}  slow     Slow EMA period (default 26)
 * @param {number}  signal   Signal EMA period (default 9)
 * @returns {{ macd: number[], signal: number[], histogram: number[], current: object }}
 */
function calculateMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);

  const macdLine = closes.map((_, i) =>
    isNaN(emaFast[i]) || isNaN(emaSlow[i]) ? NaN : emaFast[i] - emaSlow[i]
  );

  // Signal line is EMA of macdLine (over valid values only)
  const validMacd = macdLine.filter((v) => !isNaN(v));
  const signalValues = calculateEMA(validMacd, signal);

  // Re-align signal values back to full array length
  const signalAligned = new Array(closes.length).fill(NaN);
  let validIdx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macdLine[i])) {
      signalAligned[i] = signalValues[validIdx++];
    }
  }

  const histogram = closes.map((_, i) =>
    isNaN(macdLine[i]) || isNaN(signalAligned[i])
      ? NaN
      : macdLine[i] - signalAligned[i]
  );

  const lastValid = (arr) => arr.filter((v) => !isNaN(v)).pop() || 0;

  return {
    macd: macdLine,
    signal: signalAligned,
    histogram,
    current: {
      macd: parseFloat(lastValid(macdLine).toFixed(6)),
      signal: parseFloat(lastValid(signalAligned).toFixed(6)),
      histogram: parseFloat(lastValid(histogram).toFixed(6)),
    },
  };
}

// ─── Bollinger Bands ──────────────────────────────────────────────────────────

/**
 * Bollinger Bands.
 * @param {number[]} closes
 * @param {number}  period   SMA period (default 20)
 * @param {number}  stdDev   Standard-deviation multiplier (default 2)
 * @returns {{ upper: number[], middle: number[], lower: number[], current: object }}
 */
function calculateBollingerBands(closes, period = 20, stdDev = 2) {
  const upper = new Array(closes.length).fill(NaN);
  const middle = new Array(closes.length).fill(NaN);
  const lower = new Array(closes.length).fill(NaN);

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);

    middle[i] = parseFloat(mean.toFixed(6));
    upper[i] = parseFloat((mean + stdDev * sd).toFixed(6));
    lower[i] = parseFloat((mean - stdDev * sd).toFixed(6));
  }

  const lastValid = (arr) => arr.filter((v) => !isNaN(v)).pop() || 0;

  return {
    upper,
    middle,
    lower,
    current: {
      upper: lastValid(upper),
      middle: lastValid(middle),
      lower: lastValid(lower),
    },
  };
}

// ─── Support & Resistance ─────────────────────────────────────────────────────

/**
 * Identify key support and resistance levels using local pivot highs/lows.
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number}   lookback  Window for pivot detection (default 5)
 * @returns {{ support: number[], resistance: number[] }}
 */
function calculateSupportResistance(highs, lows, lookback = 5) {
  const resistance = [];
  const support = [];

  for (let i = lookback; i < highs.length - lookback; i++) {
    const windowHighs = highs.slice(i - lookback, i + lookback + 1);
    const windowLows = lows.slice(i - lookback, i + lookback + 1);

    if (highs[i] === Math.max(...windowHighs)) {
      resistance.push(parseFloat(highs[i].toFixed(5)));
    }
    if (lows[i] === Math.min(...windowLows)) {
      support.push(parseFloat(lows[i].toFixed(5)));
    }
  }

  // Deduplicate levels that are within 0.05 % of each other
  const dedupe = (levels) => {
    const sorted = [...new Set(levels)].sort((a, b) => a - b);
    const result = [];
    for (const level of sorted) {
      if (!result.length || level === 0 || Math.abs(level - result[result.length - 1]) / level > 0.0005) {
        result.push(level);
      }
    }
    return result.slice(-5); // return only the 5 most recent
  };

  return {
    support: dedupe(support),
    resistance: dedupe(resistance),
  };
}

// ─── Composite calculator ─────────────────────────────────────────────────────

/**
 * Compute all indicators from an array of OHLCV candles.
 * @param {{ open, high, low, close, volume }[]} candles
 * @returns {object}
 */
function calculateAll(candles) {
  if (!candles || candles.length === 0) {
    return {};
  }

  const opens = candles.map((c) => c.open);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);

  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const bollinger = calculateBollingerBands(closes);
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const sr = calculateSupportResistance(highs, lows);

  const lastClose = closes[closes.length - 1];
  const lastEma20 = ema20.filter((v) => !isNaN(v)).pop() || lastClose;
  const lastEma50 = ema50.filter((v) => !isNaN(v)).pop() || lastClose;
  const lastEma200 = ema200.filter((v) => !isNaN(v)).pop() || lastClose;

  // Average True Range (ATR-14)
  let atr = 0;
  if (candles.length > 15) {
    const trValues = [];
    for (let i = 1; i < candles.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trValues.push(tr);
    }
    atr = trValues.slice(-14).reduce((a, b) => a + b, 0) / 14;
  }

  // Volume trend
  const recentVol = volumes.slice(-10);
  const avgVol = recentVol.reduce((a, b) => a + b, 0) / recentVol.length;
  const volumeTrend = volumes[volumes.length - 1] > avgVol * 1.2 ? 'HIGH' : 'NORMAL';

  return {
    rsi: rsi.current,
    macd: macd.current,
    bollinger: bollinger.current,
    ema: {
      ema20: parseFloat(lastEma20.toFixed(6)),
      ema50: parseFloat(lastEma50.toFixed(6)),
      ema200: parseFloat(lastEma200.toFixed(6)),
    },
    supportResistance: sr,
    atr: parseFloat(atr.toFixed(6)),
    volumeTrend,
    currentPrice: parseFloat(lastClose.toFixed(6)),
    priceChange: opens[0] !== 0
      ? parseFloat(((lastClose - opens[0]) / opens[0] * 100).toFixed(4))
      : 0,
    highLow: {
      high24h: parseFloat(Math.max(...highs.slice(-24)).toFixed(6)),
      low24h: parseFloat(Math.min(...lows.slice(-24)).toFixed(6)),
    },
  };
}

module.exports = {
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateSupportResistance,
  calculateAll,
};
