"use client";

import { useState } from "react";
import type { IndicatorResult, ConsensusData } from "../lib/types";

interface ScoreBreakdownProps {
  indicators: IndicatorResult[];
  total: number;
  title?: string;
  consensus?: ConsensusData;
}

function ConsensusSummary({ indicators, consensus }: { indicators: IndicatorResult[]; consensus?: ConsensusData }) {
  let bullish: number;
  let bearish: number;
  let neutral: number;

  if (consensus) {
    bullish = consensus.bullish;
    bearish = consensus.bearish;
    neutral = consensus.neutral;
  } else {
    bullish = indicators.filter((i) => i.signal === "bullish").length;
    bearish = indicators.filter((i) => i.signal === "bearish").length;
    neutral = indicators.filter((i) => i.signal === "neutral").length;
  }

  const count = indicators.length;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-4 pb-3 border-b border-[#2d3348]">
      <span className="text-green-400 font-semibold">{bullish}/{count} Bullish</span>
      <span className="text-gray-600">|</span>
      <span className="text-red-400 font-semibold">{bearish}/{count} Bearish</span>
      <span className="text-gray-600">|</span>
      <span className="text-gray-400 font-semibold">{neutral}/{count} Neutral</span>
    </div>
  );
}

function IndicatorRow({ ind }: { ind: IndicatorResult }) {
  const [expanded, setExpanded] = useState(false);

  // Center-aligned bar: score is -1 to +1
  // Bullish (positive) extends right, bearish (negative) extends left
  const absScore = Math.abs(ind.score);
  const barWidth = absScore * 50; // Max 50% of container
  const isBullish = ind.score > 0;
  const isBearish = ind.score < 0;

  const barColor = isBullish
    ? "#22c55e"
    : isBearish
      ? "#ef4444"
      : "#6b7280";

  return (
    <div
      className="group cursor-pointer hover:bg-[#1e2235] rounded-lg transition-colors -mx-1 px-1"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 sm:gap-3 py-1.5">
        <div className="w-24 sm:w-36 text-xs text-gray-400 truncate flex-shrink-0 flex items-center gap-1">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              ind.signal === "bullish"
                ? "bg-green-400"
                : ind.signal === "bearish"
                  ? "bg-red-400"
                  : "bg-yellow-400"
            }`}
          />
          {ind.name}
        </div>

        {/* Center-aligned bar */}
        <div className="flex-1 relative h-4 min-w-0">
          <div className="absolute inset-0 bg-[#242836] rounded-full overflow-hidden">
            {/* Center line */}
            <div className="absolute top-0 left-1/2 w-px h-full bg-gray-600/50" />
            {/* Bar */}
            {isBullish ? (
              <div
                className="absolute top-0.5 bottom-0.5 rounded-r-full transition-all duration-700"
                style={{
                  left: "50%",
                  width: `${barWidth}%`,
                  backgroundColor: barColor,
                }}
              />
            ) : isBearish ? (
              <div
                className="absolute top-0.5 bottom-0.5 rounded-l-full transition-all duration-700"
                style={{
                  right: "50%",
                  width: `${barWidth}%`,
                  backgroundColor: barColor,
                }}
              />
            ) : (
              <div
                className="absolute top-1 bottom-1 bg-gray-600"
                style={{
                  left: "calc(50% - 1px)",
                  width: "2px",
                }}
              />
            )}
          </div>
        </div>

        <div className="w-12 text-right text-xs font-mono flex-shrink-0" style={{ color: barColor }}>
          {ind.score > 0 ? "+" : ""}{ind.score.toFixed(2)}
        </div>
      </div>

      {/* Expandable description */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          expanded ? "max-h-20 opacity-100 pb-2" : "max-h-0 opacity-0"
        }`}
      >
        <div className="text-xs text-gray-500 pl-6 sm:pl-[9.5rem]">
          {ind.description}
          {ind.value != null && (
            <span className="ml-2 text-gray-600">({String(ind.value)})</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ScoreBreakdown({
  indicators,
  total,
  title = "Score Breakdown",
  consensus,
}: ScoreBreakdownProps) {
  return (
    <div className="panel">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>

      <ConsensusSummary indicators={indicators} consensus={consensus} />

      <div className="space-y-0">
        {indicators.map((ind) => (
          <IndicatorRow key={ind.name} ind={ind} />
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-[#2d3348] flex items-center justify-between">
        <span className="text-sm text-gray-400">Total</span>
        <span className="text-lg font-bold">{total}/100</span>
      </div>
    </div>
  );
}
