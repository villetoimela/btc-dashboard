/**
 * Technical indicator calculations.
 * All functions take an array of closing prices (oldest first).
 */

export function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j];
    }
    result.push(sum / period);
  }
  return result;
}

export function ema(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    if (i === period - 1) {
      // First EMA = SMA
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[j];
      }
      result.push(sum / period);
      continue;
    }
    const prev = result[i - 1];
    result.push((data[i] - prev) * multiplier + prev);
  }
  return result;
}

export function rsi(data: number[], period: number = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  let prevAvgGain = 0;
  let prevAvgLoss = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(NaN);
      continue;
    }

    const change = data[i] - data[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);

    if (i < period) {
      result.push(NaN);
      continue;
    }

    let avgGain: number;
    let avgLoss: number;

    if (i === period) {
      // First RSI value: simple average of gains/losses
      avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      // Wilder's smoothing: carry forward previous smoothed values
      avgGain = (prevAvgGain * (period - 1) + gains[gains.length - 1]) / period;
      avgLoss = (prevAvgLoss * (period - 1) + losses[losses.length - 1]) / period;
    }

    prevAvgGain = avgGain;
    prevAvgLoss = avgLoss;

    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
    }
  }
  return result;
}

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export function macd(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const fastEma = ema(data, fastPeriod);
  const slowEma = ema(data, slowPeriod);

  const macdLine: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (isNaN(fastEma[i]) || isNaN(slowEma[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(fastEma[i] - slowEma[i]);
    }
  }

  // Filter out NaN values for signal EMA calculation
  const validMacd = macdLine.filter((v) => !isNaN(v));
  const signalEma = ema(validMacd, signalPeriod);

  // Map signal back
  const signalLine: number[] = [];
  const histogram: number[] = [];
  let validIdx = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (isNaN(macdLine[i])) {
      signalLine.push(NaN);
      histogram.push(NaN);
    } else {
      const sig = signalEma[validIdx] ?? NaN;
      signalLine.push(sig);
      histogram.push(isNaN(sig) ? NaN : macdLine[i] - sig);
      validIdx++;
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

export interface BollingerBandsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

export function bollingerBands(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerBandsResult {
  const middle = sma(data, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < data.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }

    let sumSqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSqDiff += Math.pow(data[j] - middle[i], 2);
    }
    const sd = Math.sqrt(sumSqDiff / period);

    upper.push(middle[i] + stdDev * sd);
    lower.push(middle[i] - stdDev * sd);
  }

  return { upper, middle, lower };
}

/**
 * Get the latest valid value from an indicator array
 */
export function lastValid(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return NaN;
}

/**
 * Average True Range (ATR)
 * Standard ATR calculation using true range.
 */
export function atr(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  const trueRanges: number[] = [];

  for (let i = 0; i < highs.length; i++) {
    if (i === 0) {
      // First TR is simply high - low
      trueRanges.push(highs[i] - lows[i]);
      result.push(NaN);
      continue;
    }

    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);

    if (i < period) {
      result.push(NaN);
      continue;
    }

    if (i === period) {
      // First ATR is simple average of `period` proper true ranges (skip index 0 which has no previous close)
      const sum = trueRanges.slice(1, period + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    } else {
      // Wilder's smoothing
      const prevAtr = result[i - 1];
      result.push((prevAtr * (period - 1) + tr) / period);
    }
  }

  return result;
}

/**
 * Average Directional Index (ADX)
 * Returns values 0-100. ADX < 20 = ranging, > 25 = trending.
 */
export function adx(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 0; i < highs.length; i++) {
    if (i === 0) {
      trueRanges.push(highs[i] - lows[i]);
      plusDMs.push(0);
      minusDMs.push(0);
      result.push(NaN);
      continue;
    }

    // True Range
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trueRanges.push(tr);

    // Directional Movement
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);

    if (i < period) {
      result.push(NaN);
      continue;
    }

    // Not enough data for ADX yet (need period for smoothing + period for DX averaging)
    if (i < period * 2) {
      result.push(NaN);
      continue;
    }

    // Full ADX calculation with Wilder's smoothing
    // Recalculate smoothed TR, +DM, -DM using running Wilder's smoothing
    let smoothedTR = trueRanges.slice(1, period + 1).reduce((a, b) => a + b, 0);
    let smoothedPlusDM = plusDMs.slice(1, period + 1).reduce((a, b) => a + b, 0);
    let smoothedMinusDM = minusDMs.slice(1, period + 1).reduce((a, b) => a + b, 0);

    const dxValues: number[] = [];

    // First DX
    let plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
    let minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
    let diSum = plusDI + minusDI;
    dxValues.push(diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0);

    for (let j = period + 1; j <= i; j++) {
      smoothedTR = smoothedTR - smoothedTR / period + trueRanges[j];
      smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDMs[j];
      smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDMs[j];

      plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
      minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
      diSum = plusDI + minusDI;
      dxValues.push(diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0);
    }

    if (dxValues.length >= period) {
      // First ADX = average of first `period` DX values
      if (dxValues.length === period) {
        const adxVal = dxValues.reduce((a, b) => a + b, 0) / period;
        result.push(adxVal);
      } else {
        // Subsequent ADX using Wilder's smoothing
        let adxVal = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let k = period; k < dxValues.length; k++) {
          adxVal = (adxVal * (period - 1) + dxValues[k]) / period;
        }
        result.push(adxVal);
      }
    } else {
      result.push(NaN);
    }
  }

  return result;
}

/**
 * Volume Weighted Average Price (VWAP)
 * Cumulative VWAP: sum(typical_price * volume) / sum(volume)
 * where typical_price = (H+L+C)/3
 * Resets daily at UTC midnight when timestamps are provided,
 * otherwise falls back to resetInterval-based reset.
 */
export function vwap(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  timestamps?: number[],
  resetInterval: number = 24
): number[] {
  const result: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVol = 0;
  let currentDay = -1;

  for (let i = 0; i < closes.length; i++) {
    // Reset at UTC midnight if timestamps available, else by interval
    if (timestamps && timestamps[i]) {
      const day = Math.floor(timestamps[i] / 86400000); // ms to days
      if (day !== currentDay) {
        cumulativeTPV = 0;
        cumulativeVol = 0;
        currentDay = day;
      }
    } else if (i % resetInterval === 0) {
      cumulativeTPV = 0;
      cumulativeVol = 0;
    }

    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativeTPV += typicalPrice * volumes[i];
    cumulativeVol += volumes[i];

    if (cumulativeVol === 0) {
      result.push(NaN);
    } else {
      result.push(cumulativeTPV / cumulativeVol);
    }
  }

  return result;
}

/**
 * RSI Divergence Detection
 * - Bullish divergence: price makes lower low but RSI makes higher low
 * - Bearish divergence: price makes higher high but RSI makes lower high
 */
export function detectRsiDivergence(
  prices: number[],
  rsiValues: number[],
  lookback: number = 30
): 'bullish_divergence' | 'bearish_divergence' | 'none' {
  if (prices.length < lookback || rsiValues.length < lookback) {
    return 'none';
  }

  const len = prices.length;
  const pSlice = prices.slice(len - lookback);
  const rSlice = rsiValues.slice(len - lookback);

  // Find local minima and maxima using a simple 3-bar pivot approach
  const minima: { idx: number; price: number; rsi: number }[] = [];
  const maxima: { idx: number; price: number; rsi: number }[] = [];

  for (let i = 2; i < pSlice.length - 2; i++) {
    if (isNaN(rSlice[i])) continue;

    // Local minimum: lower than 2 neighbors on each side
    if (
      pSlice[i] < pSlice[i - 1] && pSlice[i] < pSlice[i - 2] &&
      pSlice[i] < pSlice[i + 1] && pSlice[i] < pSlice[i + 2]
    ) {
      minima.push({ idx: i, price: pSlice[i], rsi: rSlice[i] });
    }

    // Local maximum: higher than 2 neighbors on each side
    if (
      pSlice[i] > pSlice[i - 1] && pSlice[i] > pSlice[i - 2] &&
      pSlice[i] > pSlice[i + 1] && pSlice[i] > pSlice[i + 2]
    ) {
      maxima.push({ idx: i, price: pSlice[i], rsi: rSlice[i] });
    }
  }

  // Check bullish divergence: compare last two minima
  if (minima.length >= 2) {
    const prev = minima[minima.length - 2];
    const curr = minima[minima.length - 1];
    // Price lower low, RSI higher low
    if (curr.price < prev.price && curr.rsi > prev.rsi) {
      return 'bullish_divergence';
    }
  }

  // Check bearish divergence: compare last two maxima
  if (maxima.length >= 2) {
    const prev = maxima[maxima.length - 2];
    const curr = maxima[maxima.length - 1];
    // Price higher high, RSI lower high
    if (curr.price > prev.price && curr.rsi < prev.rsi) {
      return 'bearish_divergence';
    }
  }

  return 'none';
}
