"use client";

import { useState, useEffect } from "react";
import type { MarketData } from "../lib/types";

interface RecommendationStyle {
  label: string;
  color: string;
  bg: string;
  text: string;
  description: string;
}

interface TopBarProps {
  market: MarketData;
  total: number;
  recommendation: RecommendationStyle;
  scoreLabel: string;
  lastUpdate: Date | null;
}

function formatPrice(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function ChangeTag({ value }: { value: number }) {
  const color =
    value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-gray-400";
  return (
    <span className={`${color} text-xs sm:text-sm font-medium`}>
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

function getScoreGradientColor(score: number): string {
  if (score <= 50) {
    const t = score / 50;
    const r = Math.round(239 + (234 - 239) * t);
    const g = Math.round(68 + (179 - 68) * t);
    const b = Math.round(68 + (8 - 68) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = (score - 50) / 50;
    const r = Math.round(234 + (34 - 234) * t);
    const g = Math.round(179 + (197 - 179) * t);
    const b = Math.round(8 + (94 - 8) * t);
    return `rgb(${r},${g},${b})`;
  }
}

function RelativeTime({ date, refreshTrigger }: { date: Date | null; refreshTrigger: number }) {
  const [display, setDisplay] = useState("");
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!date) return;
    const update = () => {
      const diff = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diff < 60) setDisplay(`${diff}s ago`);
      else if (diff < 3600) setDisplay(`${Math.floor(diff / 60)}m ago`);
      else setDisplay(`${Math.floor(diff / 3600)}h ago`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [date]);

  useEffect(() => {
    if (refreshTrigger === 0) return;
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 1000);
    return () => clearTimeout(timer);
  }, [refreshTrigger]);

  if (!date) return null;

  return (
    <span className={`text-xs text-gray-600 transition-opacity ${pulse ? "animate-pulse-once" : ""}`}>
      {display}
    </span>
  );
}

export default function TopBar({
  market,
  total,
  recommendation,
  scoreLabel,
  lastUpdate,
}: TopBarProps) {
  return (
    <div className="panel">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Price */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs text-gray-500">Bitcoin</span>
            <RelativeTime date={lastUpdate} refreshTrigger={lastUpdate?.getTime() ?? 0} />
          </div>
          <div className="text-2xl sm:text-3xl md:text-4xl font-bold">
            ${formatPrice(market.price_usd)}
          </div>
          <div className="text-xs text-gray-500">
            {"\u20AC"}{formatPrice(market.price_eur)}
          </div>
        </div>

        {/* Right: Score + Recommendation */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">{scoreLabel}</div>
            <div className="flex items-center justify-end gap-0.5">
              <span
                className="text-xl sm:text-2xl font-bold"
                style={{ color: getScoreGradientColor(total) }}
              >
                {total}
              </span>
              <span className="text-xs text-gray-500">/100</span>
            </div>
          </div>
          <div className={`${recommendation.bg} px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-center`}>
            <div className={`text-lg sm:text-xl font-bold ${recommendation.text}`}>{recommendation.label}</div>
            <div className="text-[10px] sm:text-xs text-gray-400 leading-tight max-w-[160px]">{recommendation.description}</div>
          </div>
        </div>
      </div>

      {/* Change tags row */}
      <div className="flex gap-3 sm:gap-4 mt-2 pt-2 border-t border-[#2d3348]">
        <div>
          <span className="text-gray-500 text-xs">24h </span>
          <ChangeTag value={market.change_24h} />
        </div>
        <div>
          <span className="text-gray-500 text-xs">7d </span>
          <ChangeTag value={market.change_7d} />
        </div>
        <div>
          <span className="text-gray-500 text-xs">30d </span>
          <ChangeTag value={market.change_30d} />
        </div>
        {/* Mobile score */}
        <div className="sm:hidden ml-auto">
          <span className="text-xs text-gray-500">{scoreLabel} </span>
          <span className="text-sm font-bold" style={{ color: getScoreGradientColor(total) }}>{total}/100</span>
        </div>
      </div>
    </div>
  );
}
