"use client";

import type { DashboardScore } from "../lib/types";

function SignalBadge({ signal }: { signal: "bullish" | "neutral" | "bearish" }) {
  if (signal === "bullish") return <span className="badge-green">Bullish</span>;
  if (signal === "bearish") return <span className="badge-red">Bearish</span>;
  return <span className="badge-yellow">Neutral</span>;
}

export default function TechnicalPanel({ score }: { score: DashboardScore }) {
  const technicalIndicators = score.indicators.filter((ind) =>
    [
      "RSI (14)",
      "MACD",
      "Price vs 200d MA",
      "50/200 MA Cross",
      "Bollinger Band",
    ].includes(ind.name)
  );

  return (
    <div className="panel">
      <h2 className="text-lg font-semibold mb-3">Technical Indicators</h2>
      <div className="space-y-0">
        {technicalIndicators.map((ind) => (
          <div key={ind.name} className="indicator-row">
            <div className="flex-1">
              <div className="font-medium text-sm">{ind.name}</div>
              <div className="text-xs text-gray-500">{ind.description}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-gray-300">
                {ind.value}
              </span>
              <SignalBadge signal={ind.signal} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
