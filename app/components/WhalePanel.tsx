"use client";

import type { WhaleData, LongShortRatio } from "../lib/types";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  YAxis,
  Tooltip,
} from "recharts";

function LongShortBar({
  longPercent,
  shortPercent,
}: {
  longPercent: number;
  shortPercent: number;
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm font-medium mb-1.5">
        <span className="text-green-400">{longPercent.toFixed(1)}% Long</span>
        <span className="text-red-400">{shortPercent.toFixed(1)}% Short</span>
      </div>
      <div className="flex h-6 rounded-lg overflow-hidden">
        <div
          className="flex items-center justify-center text-xs font-bold text-white transition-all duration-700"
          style={{
            width: `${longPercent}%`,
            backgroundColor: longPercent > 55 ? "#22c55e" : longPercent > 50 ? "#4ade80" : "#6b7280",
          }}
        >
          {longPercent > 20 && `${longPercent.toFixed(1)}%`}
        </div>
        <div
          className="flex items-center justify-center text-xs font-bold text-white transition-all duration-700"
          style={{
            width: `${shortPercent}%`,
            backgroundColor: shortPercent > 55 ? "#ef4444" : shortPercent > 50 ? "#f87171" : "#6b7280",
          }}
        >
          {shortPercent > 20 && `${shortPercent.toFixed(1)}%`}
        </div>
      </div>
    </div>
  );
}

function RatioRow({ label, data }: { label: string; data: LongShortRatio }) {
  const longColor =
    data.longPercent > 55
      ? "text-green-400"
      : data.shortPercent > 55
        ? "text-red-400"
        : "text-gray-400";

  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${longColor}`}>
        {data.longPercent.toFixed(1)}% / {data.shortPercent.toFixed(1)}%
      </span>
    </div>
  );
}

export default function WhalePanel({ data }: { data: WhaleData | null }) {
  if (!data) {
    return (
      <div className="panel">
        <h2 className="text-lg font-semibold mb-1">Whale Activity</h2>
        <p className="text-sm text-gray-500">Failed to load whale data</p>
      </div>
    );
  }

  const sparklineData = data.topTraderPositionRatio.history.map((h) => ({
    time: h.time,
    long: h.longPercent,
  }));

  return (
    <div className="panel">
      <h2 className="text-lg font-semibold mb-0.5">Whale Activity</h2>
      <p className="text-xs text-gray-500 mb-3">
        Top Trader Positions (Binance Futures)
      </p>

      {/* Main Long/Short bar */}
      <LongShortBar
        longPercent={data.topTraderPositionRatio.longPercent}
        shortPercent={data.topTraderPositionRatio.shortPercent}
      />

      {/* All 3 ratios */}
      <div className="space-y-1.5 mb-4">
        <RatioRow label="Top Traders (Positions)" data={data.topTraderPositionRatio} />
        <RatioRow label="Top Traders (Accounts)" data={data.topTraderAccountRatio} />
        <RatioRow label="All Accounts" data={data.globalAccountRatio} />
      </div>

      {/* Sparkline */}
      <div>
        <div className="text-xs text-gray-500 mb-1">
          Top Trader Long % (24h)
        </div>
        <ResponsiveContainer width="100%" height={50}>
          <AreaChart data={sparklineData}>
            <defs>
              <linearGradient id="longGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={[30, 70]} hide />
            <Tooltip
              contentStyle={{
                backgroundColor: "#242836",
                border: "1px solid #2d3348",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "12px",
              }}
              labelFormatter={(val: number) =>
                new Date(val).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
              formatter={(val: number) => [`${val.toFixed(1)}%`, "Long"]}
            />
            <Area
              type="monotone"
              dataKey="long"
              stroke="#3b82f6"
              strokeWidth={1.5}
              fill="url(#longGradient)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
