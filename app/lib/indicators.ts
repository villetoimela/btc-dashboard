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
