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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-4 pb-3 border-b border-[#2d3348]">
      <span className="text-green-400 font-medium">{bullish}/{count} Bullish</span>
      <span className="text-red-400 font-medium">{bearish}/{count} Bearish</span>
      <span className="text-gray-500 font-medium">{neutral}/{count} Neutral</span>
    </div>
  );
}

function SignalBadge({ signal }: { signal: "bullish" | "neutral" | "bearish" }) {
  if (signal === "bullish") return <span className="text-[10px] font-semibold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">BULL</span>;
  if (signal === "bearish") return <span className="text-[10px] font-semibold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">BEAR</span>;
  return <span className="text-[10px] font-semibold text-gray-400 bg-gray-400/10 px-1.5 py-0.5 rounded">—</span>;
}

function IndicatorRow({ ind }: { ind: IndicatorResult }) {
  const [expanded, setExpanded] = useState(false);

  const absScore = Math.abs(ind.score);
  const barWidth = absScore * 50;
  const isBullish = ind.score > 0;
  const isBearish = ind.score < 0;

  const barColor = isBullish
    ? "#22c55e"
    : isBearish
      ? "#ef4444"
      : "#6b7280";

  return (
    <div
      className="group cursor-pointer hover:bg-[#1e2235] rounded-lg transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3 py-2 px-2">
        {/* Name + value */}
        <div className="w-40 sm:w-48 flex-shrink-0">
          <div className="text-sm text-gray-300 font-medium">{ind.name}</div>
          <div className="text-xs text-gray-500">{String(ind.value)}</div>
        </div>

        {/* Center-aligned bar */}
        <div className="flex-1 relative h-5 min-w-0">
          <div className="absolute inset-0 bg-[#242836] rounded overflow-hidden">
            {/* Center line */}
            <div className="absolute top-0 left-1/2 w-px h-full bg-gray-600/40" />
            {/* Bar */}
            {isBullish ? (
              <div
                className="absolute top-1 bottom-1 rounded-r transition-all duration-700"
                style={{
                  left: "50%",
                  width: `${barWidth}%`,
                  backgroundColor: barColor,
                  opacity: 0.7 + absScore * 0.3,
                }}
              />
            ) : isBearish ? (
              <div
                className="absolute top-1 bottom-1 rounded-l transition-all duration-700"
                style={{
                  right: "50%",
                  width: `${barWidth}%`,
                  backgroundColor: barColor,
                  opacity: 0.7 + absScore * 0.3,
                }}
              />
            ) : null}
          </div>
        </div>

        {/* Signal + score */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <SignalBadge signal={ind.signal} />
          <span className="w-12 text-right text-xs font-mono" style={{ color: barColor }}>
            {ind.score > 0 ? "+" : ""}{ind.score.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Expandable description */}
      {expanded && (
        <div className="text-xs text-gray-500 px-2 pb-2 pl-[10.5rem] sm:pl-[13rem]">
          {ind.description}
          <span className="text-gray-600 ml-1">(w: {ind.weight})</span>
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

      <div className="space-y-0.5">
        {indicators.map((ind) => (
          <IndicatorRow key={ind.name} ind={ind} />
        ))}
      </div>
    </div>
  );
}
