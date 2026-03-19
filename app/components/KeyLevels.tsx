"use client";

import type { LevelsData } from "../lib/types";

interface KeyLevelsProps {
  levels: LevelsData | null;
  currentPrice: number | null;
}

function formatPrice(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function RangeBar({
  low,
  high,
  current,
  label,
}: {
  low: number;
  high: number;
  current: number;
  label: string;
}) {
  const range = high - low;
  const position = range > 0 ? ((current - low) / range) * 100 : 50;
  const clampedPos = Math.max(0, Math.min(100, position));

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>
          ${formatPrice(low)} - ${formatPrice(high)}
        </span>
      </div>
      <div className="relative h-2 bg-[#242836] rounded-full overflow-hidden">
        <div
          className="absolute h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-30"
          style={{ width: "100%" }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-md shadow-white/30 transition-all duration-500"
          style={{ left: `calc(${clampedPos}% - 5px)` }}
        />
      </div>
    </div>
  );
}

export default function KeyLevels({ levels, currentPrice }: KeyLevelsProps) {
  if (!levels) {
    return (
      <div className="panel">
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Key Levels</h3>
        <p className="text-xs text-gray-600">Loading...</p>
      </div>
    );
  }

  const price = currentPrice ?? 0;

  return (
    <div className="panel space-y-3">
      <h3 className="text-sm font-semibold text-gray-400">Key Levels</h3>

      <RangeBar low={levels.low_24h} high={levels.high_24h} current={price} label="24h Range" />
      <RangeBar low={levels.low_7d} high={levels.high_7d} current={price} label="7d Range" />
      <RangeBar low={levels.low_30d} high={levels.high_30d} current={price} label="30d Range" />

      <div className="flex justify-between text-xs pt-1 border-t border-[#2d3348]">
        <span className="text-gray-500">ATH</span>
        <span className="text-gray-300">
          ${formatPrice(levels.ath)}{" "}
          <span className="text-red-400">
            ({levels.distance_from_ath_percent.toFixed(1)}% away)
          </span>
        </span>
      </div>
    </div>
  );
}
