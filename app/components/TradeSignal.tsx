"use client";

import type { ShortTermScore } from "../lib/types";

interface TradeSignalProps {
  score: ShortTermScore;
  currentPrice: number;
}

function getSignalConfig(rec: ShortTermScore["recommendation"], total: number) {
  switch (rec) {
    case "OSTA_NYT":
      return {
        action: "BUY NOW",
        subtitle: "Strong buy signal — momentum, RSI, and volume align",
        bg: "from-green-600/20 to-green-900/10",
        border: "border-green-500/40",
        actionColor: "text-green-400",
        icon: "↑",
      };
    case "NOUSU":
      return {
        action: "BULLISH — Consider buying",
        subtitle: "Upward momentum building. Watch for confirmation.",
        bg: "from-green-600/10 to-green-900/5",
        border: "border-green-500/20",
        actionColor: "text-green-300",
        icon: "↗",
      };
    case "NEUTRAALI":
      return {
        action: "WAIT — No clear signal",
        subtitle: "Mixed signals. Stay on the sidelines until direction clears.",
        bg: "from-gray-600/10 to-gray-900/5",
        border: "border-gray-500/20",
        actionColor: "text-gray-300",
        icon: "→",
      };
    case "LASKU":
      return {
        action: "BEARISH — Don't buy",
        subtitle: "Downward pressure detected. Wait for stabilization.",
        bg: "from-orange-600/10 to-orange-900/5",
        border: "border-orange-500/20",
        actionColor: "text-orange-400",
        icon: "↘",
      };
    case "MYY":
      return {
        action: "SELL / AVOID",
        subtitle: "Strong sell pressure. Do not enter — risk of further decline.",
        bg: "from-red-600/20 to-red-900/10",
        border: "border-red-500/40",
        actionColor: "text-red-400",
        icon: "↓",
      };
  }
}

export default function TradeSignal({ score, currentPrice }: TradeSignalProps) {
  const config = getSignalConfig(score.recommendation, score.total);
  const confidence = score.lowConfidence ? "Low confidence" :
    score.total >= 70 || score.total <= 30 ? "High confidence" : "Moderate confidence";

  const bullish = score.consensus?.bullish ?? 0;
  const bearish = score.consensus?.bearish ?? 0;
  const total = score.consensus ? score.consensus.bullish + score.consensus.bearish + score.consensus.neutral : 0;

  return (
    <div className={`rounded-xl border ${config.border} bg-gradient-to-r ${config.bg} p-4`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{config.icon}</span>
            <span className={`text-xl sm:text-2xl font-bold ${config.actionColor}`}>
              {config.action}
            </span>
          </div>
          <p className="text-sm text-gray-400">{config.subtitle}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>@ ${currentPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            <span>•</span>
            <span>{confidence}</span>
            {total > 0 && (
              <>
                <span>•</span>
                <span>
                  <span className="text-green-400">{bullish}</span>
                  {" / "}
                  <span className="text-red-400">{bearish}</span>
                  {" / "}{total} indicators
                </span>
              </>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-3xl font-bold" style={{
            color: score.total >= 60 ? "#22c55e" : score.total >= 40 ? "#eab308" : "#ef4444"
          }}>
            {score.total}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Score</div>
        </div>
      </div>
    </div>
  );
}
