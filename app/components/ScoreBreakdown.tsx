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
  const bullish = consensus?.bullish ?? indicators.filter((i) => i.signal === "bullish").length;
  const bearish = consensus?.bearish ?? indicators.filter((i) => i.signal === "bearish").length;
  const neutral = consensus?.neutral ?? indicators.filter((i) => i.signal === "neutral").length;
  const count = indicators.length;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-4 pb-3 border-b border-[#2d3348]">
      <span className="text-green-400 font-medium">{bullish}/{count} Bullish</span>
      <span className="text-red-400 font-medium">{bearish}/{count} Bearish</span>
      <span className="text-gray-500 font-medium">{neutral}/{count} Neutral</span>
    </div>
  );
}

function IndicatorRow({ ind }: { ind: IndicatorResult }) {
  const [expanded, setExpanded] = useState(false);

  // Score is -1 to +1, map to 0-100 position
  const position = ((ind.score + 1) / 2) * 100;
  const clampedPos = Math.max(0, Math.min(100, position));

  const dotColor = ind.signal === "bullish"
    ? "bg-green-400 shadow-green-400/40"
    : ind.signal === "bearish"
      ? "bg-red-400 shadow-red-400/40"
      : "bg-gray-400 shadow-gray-400/40";

  const signalColor = ind.signal === "bullish"
    ? "text-green-400"
    : ind.signal === "bearish"
      ? "text-red-400"
      : "text-gray-500";

  return (
    <div
      className="cursor-pointer hover:bg-[#1e2235] rounded-lg transition-colors px-2 py-2"
      onClick={() => setExpanded(!expanded)}
    >
      {/* Label row */}
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm text-gray-300">{ind.name}</span>
        <span className={`text-xs font-medium ${signalColor}`}>
          {String(ind.value)}
        </span>
      </div>

      {/* Range bar (same style as KeyLevels) */}
      <div className="relative h-4 bg-[#242836] rounded-full overflow-hidden">
        <div
          className="absolute h-full rounded-full bg-gradient-to-r from-red-500/30 via-gray-500/20 to-green-500/30"
          style={{ width: "100%" }}
        />
        {/* Center line */}
        <div className="absolute top-0 left-1/2 w-px h-full bg-gray-600/60" />
        {/* Position dot */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${dotColor} shadow-md transition-all duration-500`}
          style={{ left: `calc(${clampedPos}% - 5px)` }}
        />
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div className="text-xs text-gray-500 mt-2">
          {ind.description}
          <span className="text-gray-600 ml-1">(score: {ind.score > 0 ? "+" : ""}{ind.score.toFixed(2)}, weight: {ind.weight})</span>
        </div>
      )}
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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span
          className="text-lg font-bold"
          style={{
            color: total >= 60 ? "#22c55e" : total >= 40 ? "#eab308" : "#ef4444",
          }}
        >
          {total}/100
        </span>
      </div>

      <ConsensusSummary indicators={indicators} consensus={consensus} />

      <div className="space-y-1">
        {indicators.map((ind) => (
          <IndicatorRow key={ind.name} ind={ind} />
        ))}
      </div>
    </div>
  );
}
