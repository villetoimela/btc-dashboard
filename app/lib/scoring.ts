import {
  sma,
  rsi as calcRsi,
  macd as calcMacd,
  bollingerBands as calcBB,
  lastValid,
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
} from "./types";

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function lerp(value: number, fromLow: number, fromHigh: number): number {
  return clamp((value - fromLow) / (fromHigh - fromLow), -1, 1);
}

export function calculateScore(
  market: MarketData,
  fearGreed: FearGreedData,
  onchain: OnchainData
): DashboardScore {
  const prices = market.prices_history.map(([, p]) => p);
  const indicators: IndicatorResult[] = [];

  // --- 1. Price vs 200d MA (weight 15) ---
  const ma200 = sma(prices, 200);
  const ma200Val = lastValid(ma200);
  const currentPrice = prices[prices.length - 1];
  const priceVsMa200 = currentPrice / ma200Val - 1;
  indicators.push({
    name: "Price vs 200d MA",
    value: `${(priceVsMa200 * 100).toFixed(1)}%`,
    signal: priceVsMa200 > 0 ? "bullish" : priceVsMa200 < -0.1 ? "bearish" : "neutral",
    score: clamp(priceVsMa200 * 5, -1, 1),
    weight: 15,
    description: isNaN(ma200Val)
      ? "Not enough data"
      : priceVsMa200 > 0
        ? `Price ${(priceVsMa200 * 100).toFixed(1)}% above 200d MA`
        : `Price ${(Math.abs(priceVsMa200) * 100).toFixed(1)}% below 200d MA`,
  });

  // --- 2. RSI (weight 12) ---
  const rsiValues = calcRsi(prices, 14);
  const rsiVal = lastValid(rsiValues);
  let rsiScore = 0;
  let rsiSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (rsiVal < 30) {
    rsiScore = lerp(rsiVal, 30, 0); // Lower RSI = more bullish
    rsiSignal = "bullish";
  } else if (rsiVal > 70) {
    rsiScore = -lerp(rsiVal, 70, 100);
    rsiSignal = "bearish";
  } else {
    rsiScore = lerp(rsiVal, 70, 30) * 0.3; // Slight bias
    rsiSignal = rsiVal < 45 ? "bullish" : rsiVal > 55 ? "bearish" : "neutral";
  }
  indicators.push({
    name: "RSI (14)",
    value: rsiVal.toFixed(1),
    signal: rsiSignal,
    score: rsiScore,
    weight: 12,
    description:
      rsiVal < 30
        ? "Oversold - buy signal"
        : rsiVal > 70
          ? "Overbought - caution"
          : "Normal range",
  });

  // --- 3. Fear & Greed (weight 12) ---
  const fgVal = fearGreed.value;
  let fgScore = 0;
  let fgSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (fgVal <= 25) {
    fgScore = lerp(fgVal, 25, 0);
    fgSignal = "bullish";
  } else if (fgVal >= 75) {
    fgScore = -lerp(fgVal, 75, 100);
    fgSignal = "bearish";
  } else {
    fgScore = lerp(fgVal, 75, 25) * 0.2;
    fgSignal = fgVal < 40 ? "bullish" : fgVal > 60 ? "bearish" : "neutral";
  }
  indicators.push({
    name: "Fear & Greed",
    value: `${fgVal} (${fearGreed.value_classification})`,
    signal: fgSignal,
    score: fgScore,
    weight: 12,
    description:
      fgVal <= 25
        ? "Extreme Fear - contrarian buy"
        : fgVal >= 75
          ? "Extreme Greed - caution"
          : `${fearGreed.value_classification}`,
  });

  // --- 4. MACD (weight 10) ---
  const macdResult = calcMacd(prices);
  const macdVal = lastValid(macdResult.macd);
  const macdSignalVal = lastValid(macdResult.signal);
  const macdHist = lastValid(macdResult.histogram);
  const macdBullish = macdVal > macdSignalVal;
  indicators.push({
    name: "MACD",
    value: macdHist.toFixed(0),
    signal: macdBullish ? "bullish" : "bearish",
    score: macdBullish ? 0.7 : -0.7,
    weight: 10,
    description: macdBullish ? "MACD above signal - bullish" : "MACD below signal - bearish",
  });

  // --- 5. 50/200 MA Cross (weight 10) ---
  const ma50 = sma(prices, 50);
  const ma50Val = lastValid(ma50);
  const goldenCross = ma50Val > ma200Val;
  indicators.push({
    name: "50/200 MA Cross",
    value: goldenCross ? "Golden Cross" : "Death Cross",
    signal: goldenCross ? "bullish" : "bearish",
    score: goldenCross ? 0.8 : -0.8,
    weight: 10,
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

  // --- 8. Volume (weight 8) ---
  const volumes = market.volumes_history.map(([, v]) => v);
  const recentVol = volumes.slice(-1)[0] || 0;
  const avgVol30 =
    volumes.slice(-30).reduce((a, b) => a + b, 0) / Math.min(30, volumes.length);
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
    weight: 8,
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

  // --- 11. Funding Rate proxy (weight 4) ---
  // We approximate with volume pattern since we don't have a free funding rate API
  const volTrend = volumes.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const volOlder = volumes.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
  const fundingProxy = volOlder > 0 ? volTrend / volOlder - 1 : 0;
  let fundScore = 0;
  let fundSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (fundingProxy < -0.1) {
    fundScore = 0.5;
    fundSignal = "bullish";
  } else if (fundingProxy > 0.3) {
    fundScore = -0.5;
    fundSignal = "bearish";
  }
  indicators.push({
    name: "Volume Momentum",
    value: `${(fundingProxy * 100).toFixed(1)}%`,
    signal: fundSignal,
    score: fundScore,
    weight: 4,
    description:
      fundingProxy < -0.1
        ? "Declining volume - possible bottom"
        : fundingProxy > 0.3
          ? "Strong volume surge - overheating"
          : "Normal volume trend",
  });

  // --- Calculate total score (0-100) ---
  const totalWeight = indicators.reduce((sum, ind) => sum + ind.weight, 0);
  let weightedScore = 0;
  for (const ind of indicators) {
    // Convert -1..1 score to 0..1 contribution
    const normalizedScore = (ind.score + 1) / 2;
    weightedScore += normalizedScore * ind.weight;
  }
  const total = Math.round((weightedScore / totalWeight) * 100);

  let recommendation: Recommendation;
  if (total >= 75) recommendation = "OSTA";
  else if (total >= 55) recommendation = "KERAA";
  else if (total >= 40) recommendation = "ODOTA";
  else if (total >= 25) recommendation = "VAROVAINEN";
  else recommendation = "ALA_OSTA";

  return {
    total: clamp(total, 0, 100),
    recommendation,
    indicators,
  };
}

// ===== SHORT-TERM SCORING (day trading) =====

export function calculateShortTermScore(
  binance: BinanceData,
  whaleData?: WhaleData | null
): ShortTermScore {
  const closes = binance.candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];
  const indicators: IndicatorResult[] = [];

  // --- 1. RSI (14) on 1h candles (weight 25) ---
  const rsiValues = calcRsi(closes, 14);
  const rsiVal = lastValid(rsiValues);
  let rsiScore = 0;
  let rsiSignal: "bullish" | "neutral" | "bearish" = "neutral";
  if (rsiVal < 30) {
    rsiScore = lerp(rsiVal, 30, 0);
    rsiSignal = "bullish";
  } else if (rsiVal > 70) {
    rsiScore = -lerp(rsiVal, 70, 100);
    rsiSignal = "bearish";
  } else {
    rsiScore = lerp(rsiVal, 70, 30) * 0.3;
    rsiSignal = rsiVal < 40 ? "bullish" : rsiVal > 60 ? "bearish" : "neutral";
  }
  indicators.push({
    name: "RSI (14) 1h",
    value: rsiVal.toFixed(1),
    signal: rsiSignal,
    score: rsiScore,
    weight: 25,
    description: rsiVal < 30 ? "Oversold — bounce likely" : rsiVal > 70 ? "Overbought — correction possible" : "Normal range",
  });

  // --- 2. MACD on 1h candles (weight 20) ---
  const macdResult = calcMacd(closes);
  const macdHist = lastValid(macdResult.histogram);
  const histValues = macdResult.histogram.filter((v) => !isNaN(v));
  const prevHist = histValues.length >= 2 ? histValues[histValues.length - 2] : 0;
  const histAccelerating = Math.abs(macdHist) > Math.abs(prevHist);
  const macdBullish = macdHist > 0;
  let macdScore = macdBullish ? 0.6 : -0.6;
  if (histAccelerating) macdScore *= 1.3;
  macdScore = clamp(macdScore, -1, 1);
  indicators.push({
    name: "MACD 1h",
    value: macdHist.toFixed(0),
    signal: macdBullish ? "bullish" : "bearish",
    score: macdScore,
    weight: 20,
    description: macdBullish
      ? histAccelerating ? "MACD accelerating upward" : "MACD positive"
      : histAccelerating ? "MACD accelerating downward" : "MACD negative",
  });

  // --- 3. 1h/4h/24h Momentum (weight 20) ---
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
    weight: 20,
    description: momentumCombo > 2 ? "Strong upward momentum" : momentumCombo < -2 ? "Strong downward momentum" : "Calm movement",
  });

  // --- 4. Bollinger Band position on 1h data (weight 20) ---
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
    weight: 20,
    description: bbPosition < 0.2 ? "Below lower band — bounce?" : bbPosition > 0.8 ? "Above upper band — overextended?" : "Mid-range",
  });

  // --- 5. Volume spike on 1h data (weight 15) ---
  const volumes = binance.candles.map((c) => c.volume);
  const currentVol = volumes[volumes.length - 1] || 0;
  const avgVol = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / Math.max(1, volumes.length - 1);
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
    weight: 15,
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

  return { total: clamp(total, 0, 100), recommendation, indicators };
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
