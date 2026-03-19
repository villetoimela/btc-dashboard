import {
  sma,
  rsi as calcRsi,
  macd as calcMacd,
  bollingerBands as calcBB,
  lastValid,
  atr as calcAtr,
  vwap as calcVwap,
  detectRsiDivergence,
} from "./indicators";
import type {
  MarketData,
  FearGreedData,
  OnchainData,
  BinanceData,
  IndicatorResult,
  DashboardScore,
  Recommendation,
  ShortTermScore,
  ShortTermRec,
  WhaleData,
  FundingRateData,
  OrderBookData,
  MultiTimeframeData,
  ConsensusData,
} from "./types";

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function lerp(value: number, fromLow: number, fromHigh: number): number {
  return clamp((value - fromLow) / (fromHigh - fromLow), -1, 1);
}

function calculateConsensus(indicators: IndicatorResult[]): ConsensusData {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;

  for (const ind of indicators) {
    if (ind.signal === "bullish") bullish++;
    else if (ind.signal === "bearish") bearish++;
    else neutral++;
  }

  const total = indicators.length;
  const maxDirection = Math.max(bullish, bearish);
  let agreement: 'strong' | 'moderate' | 'mixed';
  if (maxDirection / total > 0.66) {
    agreement = 'strong';
  } else if (maxDirection / total > 0.50) {
    agreement = 'moderate';
  } else {
    agreement = 'mixed';
  }

  return { bullish, bearish, neutral, agreement };
}

export function calculateScore(
  market: MarketData,
  fearGreed: FearGreedData,
  onchain: OnchainData,
  fundingRate?: FundingRateData | null
): DashboardScore {
  const prices = market.prices_history.map(([, p]) => p);
  const indicators: IndicatorResult[] = [];

  // Extract OHLC data from candles for ATR calculation
  const candles = market.candles_history;
  const candleHighs = candles.map((c) => c.high);
  const candleLows = candles.map((c) => c.low);
  const candleCloses = candles.map((c) => c.close);

  // Calculate ATR for use in MACD gradient scoring
  const atrValues = calcAtr(candleHighs, candleLows, candleCloses, 14);
  const atrVal = lastValid(atrValues);

  // --- 1. Price vs 200d MA (weight 12) ---
  const ma200 = sma(prices, 200);
  const ma200Val = lastValid(ma200);
  const currentPrice = prices[prices.length - 1];
  const priceVsMa200 = currentPrice / ma200Val - 1;
  indicators.push({
    name: "Price vs 200d MA",
    value: `${(priceVsMa200 * 100).toFixed(1)}%`,
    signal: priceVsMa200 > 0 ? "bullish" : priceVsMa200 < -0.1 ? "bearish" : "neutral",
    score: clamp(priceVsMa200 * 5, -1, 1),
    weight: 12,
    description: isNaN(ma200Val)
      ? "Not enough data"
      : priceVsMa200 > 0
        ? `Price ${(priceVsMa200 * 100).toFixed(1)}% above 200d MA`
        : `Price ${(Math.abs(priceVsMa200) * 100).toFixed(1)}% below 200d MA`,
  });

  // --- 2. RSI (weight 14) — widened neutral dead zone with piecewise scoring ---
  const rsiValues = calcRsi(prices, 14);
  const rsiVal = lastValid(rsiValues);
  let rsiScore = 0;
  let rsiSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (rsiVal < 25) {
    rsiScore = 1.0;
    rsiSignal = "bullish";
  } else if (rsiVal < 30) {
    rsiScore = 0.8;
    rsiSignal = "bullish";
  } else if (rsiVal < 40) {
    rsiScore = 0.3;
    rsiSignal = "bullish";
  } else if (rsiVal <= 60) {
    rsiScore = 0.0;
    rsiSignal = "neutral";
  } else if (rsiVal <= 70) {
    rsiScore = -0.3;
    rsiSignal = "bearish";
  } else if (rsiVal <= 80) {
    rsiScore = -0.7;
    rsiSignal = "bearish";
  } else {
    rsiScore = -1.0;
    rsiSignal = "bearish";
  }

  // RSI Divergence bonus
  const divergence = detectRsiDivergence(prices, rsiValues);
  if (divergence === 'bullish_divergence') {
    rsiScore = Math.min(rsiScore * 1.5, 1.0);
    if (rsiScore > 0) rsiScore = Math.min(rsiScore, 1.0);
    else rsiScore = Math.max(rsiScore * 1.5, -1.0);
  } else if (divergence === 'bearish_divergence') {
    if (rsiScore < 0) rsiScore = Math.max(rsiScore * 1.5, -1.0);
    else rsiScore = Math.min(rsiScore * 1.5, 1.0);
  }
  rsiScore = clamp(rsiScore, -1, 1);

  const divergenceNote = divergence !== 'none'
    ? ` (${divergence === 'bullish_divergence' ? 'bullish' : 'bearish'} divergence)`
    : '';

  indicators.push({
    name: "RSI (14)",
    value: rsiVal.toFixed(1),
    signal: rsiSignal,
    score: rsiScore,
    weight: 14,
    description:
      rsiVal < 30
        ? `Oversold - buy signal${divergenceNote}`
        : rsiVal > 70
          ? `Overbought - caution${divergenceNote}`
          : `Normal range${divergenceNote}`,
  });

  // --- 3. Fear & Greed (weight 10) — asymmetric scoring ---
  const fgVal = fearGreed.value;
  let fgScore = 0;
  let fgSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (fgVal <= 25) {
    // Fear side: strong buy signal (historically ~80% accurate)
    // Linear from 0.4 at fgVal=25 to 1.0 at fgVal=0
    fgScore = 0.4 + (25 - fgVal) / 25 * 0.6;
    fgSignal = "bullish";
  } else if (fgVal >= 75) {
    // Greed side: moderate sell (FOMO can sustain rallies), cap at -0.7
    // Linear from -0.2 at fgVal=75 to -0.7 at fgVal=100
    fgScore = -0.2 - (fgVal - 75) / 25 * 0.5;
    fgSignal = "bearish";
  } else if (fgVal < 40) {
    // Mild fear: slight bullish bias
    fgScore = (40 - fgVal) / 15 * 0.3;
    fgSignal = "bullish";
  } else if (fgVal > 60) {
    // Mild greed: slight bearish bias (asymmetric — weaker than fear side)
    fgScore = -(fgVal - 60) / 15 * 0.15;
    fgSignal = "bearish";
  } else {
    // 40-60: neutral
    fgScore = 0;
    fgSignal = "neutral";
  }
  fgScore = clamp(fgScore, -1, 1);
  indicators.push({
    name: "Fear & Greed",
    value: `${fgVal} (${fearGreed.value_classification})`,
    signal: fgSignal,
    score: fgScore,
    weight: 10,
    description:
      fgVal <= 25
        ? "Extreme Fear - contrarian buy"
        : fgVal >= 75
          ? "Extreme Greed - caution"
          : `${fearGreed.value_classification}`,
  });

  // --- 4. MACD (weight 7) — gradient scoring using ATR ---
  const macdResult = calcMacd(prices);
  const macdVal = lastValid(macdResult.macd);
  const macdSignalVal = lastValid(macdResult.signal);
  const macdHist = lastValid(macdResult.histogram);
  const macdBullish = macdVal > macdSignalVal;

  // Gradient score: tanh(histogram / ATR) gives weak score near zero, strong at extremes
  let macdScore = 0;
  if (!isNaN(atrVal) && atrVal > 0) {
    macdScore = Math.tanh(macdHist / atrVal);
  } else {
    // Fallback if ATR not available
    macdScore = macdBullish ? 0.5 : -0.5;
  }
  macdScore = clamp(macdScore, -1, 1);

  indicators.push({
    name: "MACD",
    value: macdHist.toFixed(0),
    signal: macdBullish ? "bullish" : "bearish",
    score: macdScore,
    weight: 7,
    description: macdBullish ? "MACD above signal - bullish" : "MACD below signal - bearish",
  });

  // --- 5. 50/200 MA Cross (weight 6) — gradient scoring ---
  const ma50 = sma(prices, 50);
  const ma50Val = lastValid(ma50);
  const goldenCross = ma50Val > ma200Val;

  // Gradient: proximity of MAs determines signal strength
  const maProximity = ma200Val > 0 ? (ma50Val - ma200Val) / ma200Val : 0;
  const maCrossScore = clamp(Math.tanh(maProximity * 10), -1, 1);

  indicators.push({
    name: "50/200 MA Cross",
    value: goldenCross ? "Golden Cross" : "Death Cross",
    signal: goldenCross ? "bullish" : "bearish",
    score: maCrossScore,
    weight: 6,
    description: goldenCross
      ? "50d MA above 200d MA - long-term bullish"
      : "50d MA below 200d MA - long-term bearish",
  });

  // --- 6. Cycle position (weight 12) ---
  const daysSinceHalving =
    onchain.current_block > 0 && onchain.halving_block > 0
      ? Math.round(
          ((onchain.current_block - (onchain.halving_block - 210000)) / 144)
        )
      : 0;
  const monthsSinceHalving = daysSinceHalving / 30;
  let cycleScore = 0;
  let cycleSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (monthsSinceHalving <= 12) {
    cycleScore = 0.8;
    cycleSignal = "bullish";
  } else if (monthsSinceHalving <= 18) {
    cycleScore = 0.4;
    cycleSignal = "bullish";
  } else if (monthsSinceHalving <= 24) {
    cycleScore = 0;
    cycleSignal = "neutral";
  } else {
    cycleScore = -0.6;
    cycleSignal = "bearish";
  }
  indicators.push({
    name: "Cycle Position",
    value: `${Math.round(monthsSinceHalving)}mo since halving`,
    signal: cycleSignal,
    score: cycleScore,
    weight: 12,
    description:
      monthsSinceHalving <= 12
        ? "Early in cycle - historically bullish"
        : monthsSinceHalving <= 18
          ? "Mid-cycle phase"
          : "Late cycle - caution",
  });

  // --- 7. Bollinger Band position (weight 8) ---
  const bb = calcBB(prices, 20, 2);
  const bbUpper = lastValid(bb.upper);
  const bbLower = lastValid(bb.lower);
  const bbRange = bbUpper - bbLower;
  const bbPosition = bbRange > 0 ? (currentPrice - bbLower) / bbRange : 0.5;
  let bbScore = 0;
  let bbSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (bbPosition < 0.2) {
    bbScore = 0.8;
    bbSignal = "bullish";
  } else if (bbPosition > 0.8) {
    bbScore = -0.8;
    bbSignal = "bearish";
  } else {
    bbScore = (0.5 - bbPosition) * 0.5;
    bbSignal = bbPosition < 0.4 ? "bullish" : bbPosition > 0.6 ? "bearish" : "neutral";
  }
  indicators.push({
    name: "Bollinger Band",
    value: `${(bbPosition * 100).toFixed(0)}%`,
    signal: bbSignal,
    score: bbScore,
    weight: 8,
    description:
      bbPosition < 0.2
        ? "Near lower band - oversold"
        : bbPosition > 0.8
          ? "Near upper band - overbought"
          : "Mid-range",
  });

  // --- 8. Volume (weight 6) ---
  const volumes = market.volumes_history.map(([, v]) => v);
  // Use yesterday's complete candle instead of today's potentially incomplete one
  const recentVol = volumes.length >= 2 ? volumes[volumes.length - 2] : (volumes.slice(-1)[0] || 0);
  const completedVolumes = volumes.length >= 2 ? volumes.slice(0, -1) : volumes;
  const avgVol30Slice = completedVolumes.slice(-30);
  const avgVol30 =
    avgVol30Slice.length > 0 ? avgVol30Slice.reduce((a, b) => a + b, 0) / avgVol30Slice.length : 0;
  const volRatio = avgVol30 > 0 ? recentVol / avgVol30 : 1;
  const priceUp = market.change_24h > 0;
  let volScore = 0;
  let volSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (volRatio > 1.5 && priceUp) {
    volScore = 0.7;
    volSignal = "bullish";
  } else if (volRatio > 1.5 && !priceUp) {
    volScore = -0.7;
    volSignal = "bearish";
  } else {
    volScore = 0;
    volSignal = "neutral";
  }
  indicators.push({
    name: "Volume",
    value: `${volRatio.toFixed(2)}x avg`,
    signal: volSignal,
    score: volScore,
    weight: 6,
    description:
      volRatio > 1.5
        ? priceUp
          ? "High volume with uptrend - bullish"
          : "High volume with downtrend - bearish"
        : "Normal volume",
  });

  // --- 9. Hashrate trend (weight 5) ---
  const hrChange = onchain.hashrate_change_30d;
  indicators.push({
    name: "Hashrate Trend",
    value: `${hrChange > 0 ? "+" : ""}${hrChange.toFixed(1)}%`,
    signal: hrChange > 0 ? "bullish" : "bearish",
    score: hrChange > 0 ? 0.5 : -0.5,
    weight: 5,
    description: hrChange > 0 ? "Hashrate growing - network strengthening" : "Hashrate declining",
  });

  // --- 10. BTC Dominance (weight 4) ---
  const domVal = market.btc_dominance;
  let domScore = 0;
  let domSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (domVal > 55) {
    domScore = 0.4;
    domSignal = "bullish";
  } else if (domVal < 40) {
    domScore = -0.4;
    domSignal = "bearish";
  }
  indicators.push({
    name: "BTC Dominance",
    value: `${domVal.toFixed(1)}%`,
    signal: domSignal,
    score: domScore,
    weight: 4,
    description:
      domVal > 55
        ? "High dominance - capital flowing into BTC"
        : domVal < 40
          ? "Low dominance - altseason"
          : "Normal dominance",
  });

  // --- 11. Volume Momentum (weight 3) ---
  const volTrend = volumes.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const volOlder = volumes.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
  const fundingProxy = volOlder > 0 ? volTrend / volOlder - 1 : 0;
  let vmScore = 0;
  let vmSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (fundingProxy < -0.1) {
    vmScore = 0.5;
    vmSignal = "bullish";
  } else if (fundingProxy > 0.3) {
    vmScore = -0.5;
    vmSignal = "bearish";
  }
  indicators.push({
    name: "Volume Momentum",
    value: `${(fundingProxy * 100).toFixed(1)}%`,
    signal: vmSignal,
    score: vmScore,
    weight: 3,
    description:
      fundingProxy < -0.1
        ? "Declining volume - possible bottom"
        : fundingProxy > 0.3
          ? "Strong volume surge - overheating"
          : "Normal volume trend",
  });

  // --- 12. Funding Rate (weight 8) — contrarian indicator ---
  if (fundingRate) {
    const avgRate7d = fundingRate.avg_rate_7d;
    // avg_rate_7d > 0.05% = bearish (overleveraged longs), < -0.02% = bullish
    // Scale linearly between
    let frScore = 0;
    let frSignal: "bullish" | "neutral" | "bearish" = "neutral";
    if (avgRate7d >= 0.05) {
      frScore = -0.7;
      frSignal = "bearish";
    } else if (avgRate7d <= -0.02) {
      frScore = 0.7;
      frSignal = "bullish";
    } else {
      // Linear interpolation between -0.02 and 0.05
      // At -0.02: score = 0.7, at 0.05: score = -0.7
      frScore = 0.7 - ((avgRate7d - (-0.02)) / (0.05 - (-0.02))) * 1.4;
      frSignal = frScore > 0.1 ? "bullish" : frScore < -0.1 ? "bearish" : "neutral";
    }
    frScore = clamp(frScore, -1, 1);

    indicators.push({
      name: "Funding Rate",
      value: `${(avgRate7d * 100).toFixed(3)}%`,
      signal: frSignal,
      score: frScore,
      weight: 8,
      description:
        avgRate7d >= 0.05
          ? "High funding - overleveraged longs - bearish"
          : avgRate7d <= -0.02
            ? "Negative funding - shorts paying - bullish"
            : "Neutral funding rate",
    });
  }

  // --- Calculate total score (0-100) ---
  const totalWeight = indicators.reduce((sum, ind) => sum + ind.weight, 0);
  let weightedScore = 0;
  for (const ind of indicators) {
    // Convert -1..1 score to 0..1 contribution
    const normalizedScore = (ind.score + 1) / 2;
    weightedScore += normalizedScore * ind.weight;
  }
  let total = Math.round((weightedScore / totalWeight) * 100);

  // --- Dead Cat Bounce filter ---
  // If 200d MA is declining AND price is below 200d MA AND has been below for < 30 days
  // → cap max score at 60
  if (ma200.length >= 21) {
    const ma200Current = ma200[ma200.length - 1];
    const ma200Prev20 = ma200[ma200.length - 21];
    const maIsDeclining = !isNaN(ma200Current) && !isNaN(ma200Prev20) && ma200Current < ma200Prev20;

    if (maIsDeclining && currentPrice < ma200Val) {
      // Check how long price has been below 200d MA (look back up to 30 days)
      let daysBelowMa200 = 0;
      for (let i = prices.length - 1; i >= Math.max(0, prices.length - 30); i--) {
        if (!isNaN(ma200[i]) && prices[i] < ma200[i]) {
          daysBelowMa200++;
        } else {
          break;
        }
      }

      if (daysBelowMa200 < 30) {
        total = Math.min(total, 60);
      }
    }
  }

  let recommendation: Recommendation;
  if (total >= 75) recommendation = "OSTA";
  else if (total >= 55) recommendation = "KERAA";
  else if (total >= 40) recommendation = "ODOTA";
  else if (total >= 25) recommendation = "VAROVAINEN";
  else recommendation = "ALA_OSTA";

  const consensus = calculateConsensus(indicators);

  return {
    total: clamp(total, 0, 100),
    recommendation,
    indicators,
    consensus,
  };
}

// ===== SHORT-TERM SCORING (day trading) =====

export function calculateShortTermScore(
  binance: BinanceData,
  whaleData?: WhaleData | null,
  fundingRate?: FundingRateData | null,
  orderBook?: OrderBookData | null,
  multiTf?: MultiTimeframeData | null
): ShortTermScore {
  const closes = binance.candles.map((c) => c.close);
  const highs = binance.candles.map((c) => c.high);
  const lows = binance.candles.map((c) => c.low);
  const candleVolumes = binance.candles.map((c) => c.volume);
  const currentPrice = closes[closes.length - 1];
  const indicators: IndicatorResult[] = [];

  // Calculate ATR for gradient scoring
  const atrValues = calcAtr(highs, lows, closes, 14);
  const atrVal = lastValid(atrValues);

  // --- 1. RSI (14) on 1h candles (weight 18) — with multi-timeframe support ---
  const rsiValues1h = calcRsi(closes, 14);
  const rsiVal1h = lastValid(rsiValues1h);

  let finalRsiVal = rsiVal1h;

  if (multiTf) {
    const closes15m = multiTf.candles_15m.map((c) => c.close);
    const closes4h = multiTf.candles_4h.map((c) => c.close);

    const rsiValues15m = calcRsi(closes15m, 14);
    const rsiVal15m = lastValid(rsiValues15m);

    const rsiValues4h = calcRsi(closes4h, 14);
    const rsiVal4h = lastValid(rsiValues4h);

    // Weighted blend: 0.25 * 15m + 0.50 * 1h + 0.25 * 4h
    if (!isNaN(rsiVal15m) && !isNaN(rsiVal4h)) {
      finalRsiVal = 0.25 * rsiVal15m + 0.50 * rsiVal1h + 0.25 * rsiVal4h;
    }
  }

  let rsiScore = 0;
  let rsiSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (finalRsiVal < 30) {
    rsiScore = lerp(finalRsiVal, 30, 0);
    rsiSignal = "bullish";
  } else if (finalRsiVal > 70) {
    rsiScore = -lerp(finalRsiVal, 70, 100);
    rsiSignal = "bearish";
  } else {
    rsiScore = lerp(finalRsiVal, 70, 30) * 0.3;
    rsiSignal = finalRsiVal < 40 ? "bullish" : finalRsiVal > 60 ? "bearish" : "neutral";
  }

  const rsiDisplay = multiTf ? `${finalRsiVal.toFixed(1)} (MTF)` : rsiVal1h.toFixed(1);
  indicators.push({
    name: "RSI (14) 1h",
    value: rsiDisplay,
    signal: rsiSignal,
    score: rsiScore,
    weight: 18,
    description: finalRsiVal < 30 ? "Oversold — bounce likely" : finalRsiVal > 70 ? "Overbought — correction possible" : "Normal range",
  });

  // --- 2. MACD on 1h candles (weight 12) — gradient scoring with multi-timeframe ---
  const macdResult1h = calcMacd(closes);
  const macdHist1h = lastValid(macdResult1h.histogram);

  // Gradient MACD score using ATR
  let macdScore1h = 0;
  if (!isNaN(atrVal) && atrVal > 0) {
    macdScore1h = Math.tanh(macdHist1h / atrVal);
  } else {
    macdScore1h = macdHist1h > 0 ? 0.5 : -0.5;
  }

  let finalMacdScore = macdScore1h;

  if (multiTf) {
    const closes15m = multiTf.candles_15m.map((c) => c.close);
    const closes4h = multiTf.candles_4h.map((c) => c.close);

    const macdResult15m = calcMacd(closes15m);
    const macdHist15m = lastValid(macdResult15m.histogram);

    const macdResult4h = calcMacd(closes4h);
    const macdHist4h = lastValid(macdResult4h.histogram);

    // Calculate ATR for each timeframe
    const highs15m = multiTf.candles_15m.map((c) => c.high);
    const lows15m = multiTf.candles_15m.map((c) => c.low);
    const atr15m = lastValid(calcAtr(highs15m, lows15m, closes15m, 14));

    const highs4h = multiTf.candles_4h.map((c) => c.high);
    const lows4h = multiTf.candles_4h.map((c) => c.low);
    const atr4h = lastValid(calcAtr(highs4h, lows4h, closes4h, 14));

    let score15m = 0;
    let score4h = 0;

    if (!isNaN(atr15m) && atr15m > 0) {
      score15m = Math.tanh(macdHist15m / atr15m);
    } else {
      score15m = macdHist15m > 0 ? 0.5 : -0.5;
    }

    if (!isNaN(atr4h) && atr4h > 0) {
      score4h = Math.tanh(macdHist4h / atr4h);
    } else {
      score4h = macdHist4h > 0 ? 0.5 : -0.5;
    }

    // Weighted blend: 0.25 * 15m + 0.50 * 1h + 0.25 * 4h
    if (!isNaN(score15m) && !isNaN(score4h)) {
      finalMacdScore = 0.25 * score15m + 0.50 * macdScore1h + 0.25 * score4h;
    }
  }

  finalMacdScore = clamp(finalMacdScore, -1, 1);
  const macdBullish = finalMacdScore > 0;

  indicators.push({
    name: "MACD 1h",
    value: macdHist1h.toFixed(0),
    signal: macdBullish ? "bullish" : "bearish",
    score: finalMacdScore,
    weight: 12,
    description: macdBullish
      ? multiTf ? "MACD positive (multi-timeframe)" : "MACD positive"
      : multiTf ? "MACD negative (multi-timeframe)" : "MACD negative",
  });

  // --- 3. 1h/4h/24h Momentum (weight 18) ---
  const { change_1h, change_4h, change_24h } = binance;
  // Weighted combination: 1h has most weight for day trading responsiveness
  const momentumCombo = change_1h * 0.5 + change_4h * 0.3 + change_24h * 0.2;
  let momScore = 0;
  let momSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (momentumCombo > 2) { momScore = 0.8; momSignal = "bullish"; }
  else if (momentumCombo > 0.5) { momScore = 0.4; momSignal = "bullish"; }
  else if (momentumCombo < -2) { momScore = -0.8; momSignal = "bearish"; }
  else if (momentumCombo < -0.5) { momScore = -0.4; momSignal = "bearish"; }
  const momParts = [
    `1h: ${change_1h > 0 ? "+" : ""}${change_1h.toFixed(1)}%`,
    `4h: ${change_4h > 0 ? "+" : ""}${change_4h.toFixed(1)}%`,
    `24h: ${change_24h > 0 ? "+" : ""}${change_24h.toFixed(1)}%`,
  ].join(" | ");
  indicators.push({
    name: "Momentum",
    value: momParts,
    signal: momSignal,
    score: momScore,
    weight: 18,
    description: momentumCombo > 2 ? "Strong upward momentum" : momentumCombo < -2 ? "Strong downward momentum" : "Calm movement",
  });

  // --- 4. Bollinger Band position on 1h data (weight 15) ---
  const bb = calcBB(closes, 20, 2);
  const bbUpper = lastValid(bb.upper);
  const bbLower = lastValid(bb.lower);
  const bbRange = bbUpper - bbLower;
  const bbPosition = bbRange > 0 ? (currentPrice - bbLower) / bbRange : 0.5;
  let bbScore = 0;
  let bbSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (bbPosition < 0.1) { bbScore = 1; bbSignal = "bullish"; }
  else if (bbPosition < 0.3) { bbScore = 0.5; bbSignal = "bullish"; }
  else if (bbPosition > 0.9) { bbScore = -1; bbSignal = "bearish"; }
  else if (bbPosition > 0.7) { bbScore = -0.5; bbSignal = "bearish"; }
  else { bbScore = (0.5 - bbPosition) * 0.4; }
  indicators.push({
    name: "BB Position 1h",
    value: `${(bbPosition * 100).toFixed(0)}%`,
    signal: bbSignal,
    score: bbScore,
    weight: 15,
    description: bbPosition < 0.2 ? "Below lower band — bounce?" : bbPosition > 0.8 ? "Above upper band — overextended?" : "Mid-range",
  });

  // --- 5. Volume spike on 1h data (weight 12) ---
  const volArr = binance.candles.map((c) => c.volume);
  // Use last complete candle instead of current incomplete one
  const currentVol = volArr.length >= 2 ? volArr[volArr.length - 2] : (volArr[volArr.length - 1] || 0);
  const avgVolSlice = volArr.length >= 3 ? volArr.slice(0, -2) : volArr.slice(0, -1);
  const avgVol = avgVolSlice.length > 0 ? avgVolSlice.reduce((a, b) => a + b, 0) / avgVolSlice.length : 0;
  const volSpike = avgVol > 0 ? currentVol / avgVol : 1;
  const priceUp = change_1h > 0;
  let volScore = 0;
  let volSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (volSpike > 1.5 && priceUp) { volScore = 0.8; volSignal = "bullish"; }
  else if (volSpike > 1.5 && !priceUp) { volScore = -0.8; volSignal = "bearish"; }
  else if (volSpike < 0.5) { volScore = 0; volSignal = "neutral"; }
  indicators.push({
    name: "Volume Spike 1h",
    value: `${volSpike.toFixed(1)}x`,
    signal: volSignal,
    score: volScore,
    weight: 12,
    description: volSpike > 1.5 ? (priceUp ? "High volume + uptrend" : "High volume + downtrend — panic?") : "Normal volume",
  });

  // --- 6. Whale Long/Short Ratio (weight 15) ---
  if (whaleData) {
    const topLong = whaleData.topTraderPositionRatio.longPercent;
    const topShort = whaleData.topTraderPositionRatio.shortPercent;
    let whaleScore = 0;
    let whaleSignal: "bullish" | "neutral" | "bearish" = "neutral";
    if (topLong >= 60) { whaleScore = 0.8; whaleSignal = "bullish"; }
    else if (topLong >= 55) { whaleScore = 0.4; whaleSignal = "bullish"; }
    else if (topShort >= 60) { whaleScore = -0.8; whaleSignal = "bearish"; }
    else if (topShort >= 55) { whaleScore = -0.4; whaleSignal = "bearish"; }
    indicators.push({
      name: "Whale L/S Ratio",
      value: `${topLong.toFixed(1)}% L / ${topShort.toFixed(1)}% S`,
      signal: whaleSignal,
      score: whaleScore,
      weight: 15,
      description: topLong >= 60
        ? "Top traders heavily long — bullish conviction"
        : topLong >= 55
          ? "Top traders leaning long"
          : topShort >= 60
            ? "Top traders heavily short — bearish pressure"
            : topShort >= 55
              ? "Top traders leaning short"
              : "Top traders balanced — no clear bias",
    });
  }

  // --- 7. Order Book Imbalance (weight 12) ---
  if (orderBook) {
    const imbalance = orderBook.imbalance_ratio;
    let obScore = 0;
    let obSignal: "bullish" | "neutral" | "bearish" = "neutral";

    if (imbalance > 1.5) {
      obScore = 0.8;
      obSignal = "bullish";
    } else if (imbalance < 0.7) {
      obScore = -0.8;
      obSignal = "bearish";
    } else {
      // Linear interpolation between 0.7 and 1.5
      // At 0.7: -0.8, at 1.1 (midpoint): 0, at 1.5: 0.8
      obScore = ((imbalance - 0.7) / (1.5 - 0.7)) * 1.6 - 0.8;
      obSignal = obScore > 0.1 ? "bullish" : obScore < -0.1 ? "bearish" : "neutral";
    }

    // Spread warning: if spread is too wide, reduce score magnitude
    if (orderBook.spread_percent > 0.05) {
      obScore = obScore > 0 ? Math.max(obScore - 0.2, 0) : Math.min(obScore + 0.2, 0);
    }

    obScore = clamp(obScore, -1, 1);

    indicators.push({
      name: "Order Book",
      value: `${imbalance.toFixed(2)} (${orderBook.spread_percent.toFixed(3)}% spread)`,
      signal: obSignal,
      score: obScore,
      weight: 12,
      description:
        imbalance > 1.5
          ? "Strong bid-side imbalance — buyers dominating"
          : imbalance < 0.7
            ? "Strong ask-side imbalance — sellers dominating"
            : "Order book relatively balanced",
    });
  }

  // --- 8. Funding Rate current (weight 10) — contrarian ---
  if (fundingRate) {
    const currentRate = fundingRate.current_rate;
    let frScore = 0;
    let frSignal: "bullish" | "neutral" | "bearish" = "neutral";

    if (currentRate >= 0.05) {
      frScore = -0.7;
      frSignal = "bearish";
    } else if (currentRate <= -0.02) {
      frScore = 0.7;
      frSignal = "bullish";
    } else {
      // Linear interpolation between -0.02 and 0.05
      frScore = 0.7 - ((currentRate - (-0.02)) / (0.05 - (-0.02))) * 1.4;
      frSignal = frScore > 0.1 ? "bullish" : frScore < -0.1 ? "bearish" : "neutral";
    }
    frScore = clamp(frScore, -1, 1);

    indicators.push({
      name: "Funding Rate",
      value: `${(currentRate * 100).toFixed(3)}%`,
      signal: frSignal,
      score: frScore,
      weight: 10,
      description:
        currentRate >= 0.05
          ? "High funding - overleveraged longs - short squeeze risk"
          : currentRate <= -0.02
            ? "Negative funding - shorts paying - squeeze potential"
            : "Neutral funding rate",
    });
  }

  // --- 9. VWAP (weight 12) ---
  if (closes.length > 0 && candleVolumes.length > 0) {
    const vwapValues = calcVwap(highs, lows, closes, candleVolumes);
    const vwapVal = lastValid(vwapValues);

    if (!isNaN(vwapVal) && !isNaN(atrVal) && atrVal > 0) {
      let vwapScore = clamp((currentPrice - vwapVal) / atrVal * 0.5, -1, 1);
      let vwapSignal: "bullish" | "neutral" | "bearish" = "neutral";

      if (vwapScore > 0.1) vwapSignal = "bullish";
      else if (vwapScore < -0.1) vwapSignal = "bearish";

      indicators.push({
        name: "VWAP",
        value: `$${vwapVal.toFixed(0)}`,
        signal: vwapSignal,
        score: vwapScore,
        weight: 12,
        description:
          currentPrice > vwapVal
            ? `Price $${(currentPrice - vwapVal).toFixed(0)} above VWAP — bullish bias`
            : `Price $${(vwapVal - currentPrice).toFixed(0)} below VWAP — bearish bias`,
      });
    }
  }

  // --- Calculate total ---
  const totalWeight = indicators.reduce((sum, ind) => sum + ind.weight, 0);
  let weightedScore = 0;
  for (const ind of indicators) {
    const normalizedScore = (ind.score + 1) / 2;
    weightedScore += normalizedScore * ind.weight;
  }
  const total = Math.round((weightedScore / totalWeight) * 100);

  let recommendation: ShortTermRec;
  if (total >= 70) recommendation = "OSTA_NYT";
  else if (total >= 58) recommendation = "NOUSU";
  else if (total >= 42) recommendation = "NEUTRAALI";
  else if (total >= 30) recommendation = "LASKU";
  else recommendation = "MYY";

  const consensus = calculateConsensus(indicators);

  // Low confidence flag: if fewer than 4 indicators agree on a direction
  const maxDirectionCount = Math.max(consensus.bullish, consensus.bearish);
  const lowConfidence = maxDirectionCount < 4;

  return {
    total: clamp(total, 0, 100),
    recommendation,
    indicators,
    consensus,
    ...(lowConfidence ? { lowConfidence: true } : {}),
  };
}

export function getShortTermStyle(rec: ShortTermRec) {
  switch (rec) {
    case "OSTA_NYT":
      return { label: "BUY NOW", color: "#22c55e", bg: "bg-green-500/20", text: "text-green-400", description: "Strong short-term buy signal — momentum, RSI, and volume align. Potential quick entry." };
    case "NOUSU":
      return { label: "BULLISH", color: "#86efac", bg: "bg-green-300/20", text: "text-green-300", description: "Upward momentum building. Watch for confirmation before entering." };
    case "NEUTRAALI":
      return { label: "NEUTRAL", color: "#94a3b8", bg: "bg-gray-500/20", text: "text-gray-300", description: "No clear short-term direction. Stay on the sidelines." };
    case "LASKU":
      return { label: "BEARISH", color: "#f97316", bg: "bg-orange-500/20", text: "text-orange-400", description: "Downward momentum detected. Avoid buying — wait for stabilization." };
    case "MYY":
      return { label: "AVOID", color: "#ef4444", bg: "bg-red-500/20", text: "text-red-400", description: "Strong sell pressure. Do not enter — risk of further decline." };
  }
}

export function getRecommendationStyle(rec: Recommendation) {
  switch (rec) {
    case "OSTA":
      return { label: "BUY", color: "#22c55e", bg: "bg-green-500/20", text: "text-green-400", description: "Strong buy signal — multiple indicators align bullish. Consider entering a position or adding to existing." };
    case "KERAA":
      return { label: "ACCUMULATE", color: "#86efac", bg: "bg-green-300/20", text: "text-green-300", description: "Conditions favor gradual buying. Good time to DCA (dollar-cost average) in smaller amounts." };
    case "ODOTA":
      return { label: "WAIT", color: "#eab308", bg: "bg-yellow-500/20", text: "text-yellow-400", description: "Mixed signals — no clear direction. Hold off on new buys until a clearer setup appears." };
    case "VAROVAINEN":
      return {
        label: "CAUTION",
        color: "#f97316",
        bg: "bg-orange-500/20",
        text: "text-orange-400",
        description: "Elevated risk detected. Avoid new positions and consider tightening stop-losses.",
      };
    case "ALA_OSTA":
      return {
        label: "STAY OUT",
        color: "#ef4444",
        bg: "bg-red-500/20",
        text: "text-red-400",
        description: "Market conditions are weak. Preserve capital in stablecoins until sentiment improves.",
      };
  }
}
