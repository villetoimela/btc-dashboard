"use client";

import type { IndicatorResult } from "../lib/types";

interface ScoreBreakdownProps {
  indicators: IndicatorResult[];
  total: number;
  title?: string;
}

export default function ScoreBreakdown({ indicators, total, title = "Score Breakdown" }: ScoreBreakdownProps) {
  return (
    <div className="panel">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="space-y-2">
        {indicators.map((ind) => {
          const normalizedScore = (ind.score + 1) / 2; // 0 to 1
          const contribution = normalizedScore * ind.weight;
          const maxContribution = ind.weight;
          const barWidth = (contribution / maxContribution) * 100;
          const barColor =
            ind.signal === "bullish"
              ? "#22c55e"
              : ind.signal === "bearish"
                ? "#ef4444"
                : "#eab308";

          return (
            <div key={ind.name} className="flex items-center gap-2 sm:gap-3">
              <div className="w-24 sm:w-36 text-xs text-gray-400 truncate flex-shrink-0">
                {ind.name}
              </div>
              <div className="flex-1 bg-[#242836] rounded-full h-3 overflow-hidden min-w-0">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
              <div className="w-14 sm:w-16 text-right text-xs font-mono text-gray-400 flex-shrink-0">
                {contribution.toFixed(1)}/{maxContribution}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-[#2d3348] flex items-center justify-between">
        <span className="text-sm text-gray-400">Total</span>
        <span className="text-lg font-bold">{total}/100</span>
      </div>
    </div>
  );
}
