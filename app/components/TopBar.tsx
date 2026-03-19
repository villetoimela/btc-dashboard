"use client";

import { useState, useEffect } from "react";
import type { MarketData } from "../lib/types";
import ScoreSparkline, { useScoreTrend } from "./ScoreSparkline";
import SignalStrength from "./SignalStrength";

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
  notificationPermission?: "default" | "granted" | "denied";
  onRequestNotifications?: () => void;
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
    <span className={`${color} text-sm font-medium`}>
      {value > 0 ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

function getScoreGradientColor(score: number): string {
  // Red (0) -> Yellow (50) -> Green (100)
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
      Updated {display}
    </span>
  );
}

export default function TopBar({
  market,
  total,
  recommendation,
  scoreLabel,
  lastUpdate,
  notificationPermission,
  onRequestNotifications,
}: TopBarProps) {
  const trend = useScoreTrend(total);

  return (
    <div className="panel flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-gray-400">Bitcoin</span>
            <RelativeTime date={lastUpdate} refreshTrigger={lastUpdate?.getTime() ?? 0} />
            {notificationPermission === "default" && onRequestNotifications && (
              <button
                onClick={onRequestNotifications}
                className="text-[10px] bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 px-2 py-0.5 rounded-full transition-colors"
              >
                Enable alerts
              </button>
            )}
          </div>
          <div className="text-3xl md:text-4xl font-bold">
            ${formatPrice(market.price_usd)}
          </div>
          <div className="text-lg text-gray-400">
            {"\u20AC"}{formatPrice(market.price_eur)}
          </div>
        </div>

        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-gray-500">24h </span>
            <ChangeTag value={market.change_24h} />
          </div>
          <div>
            <span className="text-gray-500">7d </span>
            <ChangeTag value={market.change_7d} />
          </div>
          <div>
            <span className="text-gray-500">30d </span>
            <ChangeTag value={market.change_30d} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="text-right">
          <div className="text-xs text-gray-500">{scoreLabel}</div>
          <div className="flex items-center justify-end gap-1">
            <span
              className="text-2xl font-bold"
              style={{ color: getScoreGradientColor(total) }}
            >
              {total}
            </span>
            <span className="text-sm text-gray-500">/100</span>
            {trend && (
              <span className="text-lg font-bold" style={{ color: trend.color }}>
                {trend.arrow}
              </span>
            )}
            <ScoreSparkline score={total} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`${recommendation.bg} px-4 py-2 rounded-xl text-center min-w-[110px] max-w-[220px]`}>
            <div className={`text-xl font-bold ${recommendation.text}`}>{recommendation.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{recommendation.description}</div>
          </div>
          <SignalStrength score={total} color={recommendation.color} />
        </div>
      </div>
    </div>
  );
}
