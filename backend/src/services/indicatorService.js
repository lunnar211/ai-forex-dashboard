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

  // Deduplicate levels that are within 0.05% of each other
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

// ─── Stochastic Oscillator ────────────────────────────────────────────────────

/**
 * Stochastic Oscillator (%K and %D).
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number}   kPeriod   Lookback for %K (default 14)
 * @param {number}   dPeriod   SMA of %K for %D (default 3)
 * @returns {{ k: number, d: number }}
 */
function calculateStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
  if (closes.length < kPeriod) return { k: 50, d: 50 };

  const kValues = [];
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const sliceHighs = highs.slice(i - kPeriod + 1, i + 1);
    const sliceLows = lows.slice(i - kPeriod + 1, i + 1);
    const highestHigh = Math.max(...sliceHighs);
    const lowestLow = Math.min(...sliceLows);
    const range = highestHigh - lowestLow;
    // Clamp to [0, 100] to handle floating-point edge cases in real data
    const rawK = range === 0 ? 50 : ((closes[i] - lowestLow) / range) * 100;
    const clampedK = Math.min(100, Math.max(0, rawK));
    kValues.push(parseFloat(clampedK.toFixed(2)));
  }

  // %D is a 3-period SMA of %K
  const recent = kValues.slice(-dPeriod);
  const d = recent.reduce((a, b) => a + b, 0) / recent.length;
  return {
    k: kValues[kValues.length - 1],
    d: parseFloat(d.toFixed(2)),
  };
}

// ─── Williams %R ─────────────────────────────────────────────────────────────

/**
 * Williams %R.
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number}   period  (default 14)
 * @returns {number}  -100 to 0; near 0 = overbought, near -100 = oversold
 */
function calculateWilliamsR(highs, lows, closes, period = 14) {
  if (closes.length < period) return -50;
  const sliceHighs = highs.slice(-period);
  const sliceLows = lows.slice(-period);
  const highestHigh = Math.max(...sliceHighs);
  const lowestLow = Math.min(...sliceLows);
  const range = highestHigh - lowestLow;
  if (range === 0) return -50;
  const wr = ((highestHigh - closes[closes.length - 1]) / range) * -100;
  return parseFloat(wr.toFixed(2));
}

// ─── CCI (Commodity Channel Index) ───────────────────────────────────────────

/**
 * Commodity Channel Index.
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number}   period  (default 20)
 * @returns {number}
 */
function calculateCCI(highs, lows, closes, period = 20) {
  if (closes.length < period) return 0;
  const typicalPrices = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const recent = typicalPrices.slice(-period);
  const mean = recent.reduce((a, b) => a + b, 0) / period;
  const meanDeviation = recent.reduce((acc, v) => acc + Math.abs(v - mean), 0) / period;
  if (meanDeviation === 0) return 0;
  const cci = (recent[recent.length - 1] - mean) / (0.015 * meanDeviation);
  return parseFloat(cci.toFixed(2));
}

// ─── ADX (Average Directional Index) ─────────────────────────────────────────

/**
 * Simplified ADX (trend strength).
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number}   period  (default 14)
 * @returns {{ adx: number, plusDI: number, minusDI: number }}
 */
function calculateADX(highs, lows, closes, period = 14) {
  if (closes.length < period + 1) return { adx: 25, plusDI: 25, minusDI: 25 };

  const trValues = [];
  const plusDM = [];
  const minusDM = [];

  for (let i = 1; i < closes.length; i++) {
    const highDiff = highs[i] - highs[i - 1];
    const lowDiff = lows[i - 1] - lows[i];
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trValues.push(tr);
    plusDM.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
    minusDM.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
  }

  const smoothTR = trValues.slice(-period).reduce((a, b) => a + b, 0);
  const smoothPlusDM = plusDM.slice(-period).reduce((a, b) => a + b, 0);
  const smoothMinusDM = minusDM.slice(-period).reduce((a, b) => a + b, 0);

  if (smoothTR === 0) return { adx: 25, plusDI: 25, minusDI: 25 };

  const plusDI = (smoothPlusDM / smoothTR) * 100;
  const minusDI = (smoothMinusDM / smoothTR) * 100;
  const diSum = plusDI + minusDI;
  const dx = diSum === 0 ? 0 : (Math.abs(plusDI - minusDI) / diSum) * 100;

  return {
    adx: parseFloat(dx.toFixed(2)),
    plusDI: parseFloat(plusDI.toFixed(2)),
    minusDI: parseFloat(minusDI.toFixed(2)),
  };
}

// ─── Fibonacci Retracement ────────────────────────────────────────────────────

/**
 * Key Fibonacci retracement levels from the highest high and lowest low.
 * @param {number[]} highs
 * @param {number[]} lows
 * @returns {{ high: number, low: number, levels: object }}
 */
function calculateFibonacci(highs, lows) {
  const lookback = Math.min(highs.length, 50);
  const recentHighs = highs.slice(-lookback);
  const recentLows = lows.slice(-lookback);
  const high = Math.max(...recentHighs);
  const low = Math.min(...recentLows);
  const range = high - low;

  return {
    high: parseFloat(high.toFixed(5)),
    low: parseFloat(low.toFixed(5)),
    levels: {
      fib0: parseFloat(high.toFixed(5)),
      fib236: parseFloat((high - range * 0.236).toFixed(5)),
      fib382: parseFloat((high - range * 0.382).toFixed(5)),
      fib500: parseFloat((high - range * 0.500).toFixed(5)),
      fib618: parseFloat((high - range * 0.618).toFixed(5)),
      fib786: parseFloat((high - range * 0.786).toFixed(5)),
      fib100: parseFloat(low.toFixed(5)),
    },
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
  const stochastic = calculateStochastic(highs, lows, closes);
  const williamsR = calculateWilliamsR(highs, lows, closes);
  const cci = calculateCCI(highs, lows, closes);
  const adx = calculateADX(highs, lows, closes);
  const fibonacci = calculateFibonacci(highs, lows);

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
    stochastic,
    williamsR,
    cci,
    adx,
    fibonacci,
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
  calculateStochastic,
  calculateWilliamsR,
  calculateCCI,
  calculateADX,
  calculateFibonacci,
  calculateAll,
};
