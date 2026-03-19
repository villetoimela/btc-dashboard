"use client";

import type { BinanceData } from "../lib/types";

interface MomentumStripProps {
  binanceData: BinanceData | null;
}

function MomentumItem({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return null;
  const color = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-gray-400";
  const arrow = value > 0 ? "\u2191" : value < 0 ? "\u2193" : "\u2192";

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${color}`}>
        {arrow} {value > 0 ? "+" : ""}{value.toFixed(2)}%
      </span>
    </div>
  );
}

export default function MomentumStrip({ binanceData }: MomentumStripProps) {
  if (!binanceData) return null;

  return (
    <div className="panel !py-2 !px-2 flex flex-wrap items-center justify-around gap-1">
      <MomentumItem label="1h" value={binanceData.change_1h} />
      <div className="w-px h-5 bg-[#2d3348] hidden sm:block" />
      <MomentumItem label="4h" value={binanceData.change_4h} />
      <div className="w-px h-5 bg-[#2d3348] hidden sm:block" />
      <MomentumItem label="24h" value={binanceData.change_24h} />
    </div>
  );
}
