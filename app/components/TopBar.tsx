"use client";

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

export default function TopBar({ market, total, recommendation, scoreLabel }: TopBarProps) {
  return (
    <div className="panel flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-8">
        <div>
          <div className="text-sm text-gray-400 mb-1">Bitcoin</div>
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
          <div className="text-2xl font-bold" style={{ color: recommendation.color }}>
            {total}
            <span className="text-sm text-gray-500">/100</span>
          </div>
        </div>
        <div className={`${recommendation.bg} px-4 py-2 rounded-xl text-center min-w-[110px] max-w-[220px]`}>
          <div className={`text-xl font-bold ${recommendation.text}`}>{recommendation.label}</div>
          <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">{recommendation.description}</div>
        </div>
      </div>
    </div>
  );
}
