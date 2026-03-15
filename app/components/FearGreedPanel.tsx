"use client";

import type { FearGreedData, MarketData } from "../lib/types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  Tooltip,
} from "recharts";

function GaugeDisplay({ value }: { value: number }) {
  // Simple gauge with SVG
  // Angle in radians: 0=left (fear), PI=right (greed)
  // Value 0 → angle PI (left), value 100 → angle 0 (right)
  const angleRad = Math.PI * (1 - value / 100);
  const color =
    value <= 25
      ? "#ef4444"
      : value <= 45
        ? "#f97316"
        : value <= 55
          ? "#eab308"
          : value <= 75
            ? "#86efac"
            : "#22c55e";

  const needleLength = 70;
  const nx = 100 + Math.cos(angleRad) * needleLength;
  const ny = 100 - Math.sin(angleRad) * needleLength;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[200px] h-auto">
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#2d3348"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Colored segments — 4 equal 45° arcs */}
        <path
          d="M 20 100 A 80 80 0 0 1 43.43 43.43"
          fill="none"
          stroke="#ef4444"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 43.43 43.43 A 80 80 0 0 1 100 20"
          fill="none"
          stroke="#f97316"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 100 20 A 80 80 0 0 1 156.57 43.43"
          fill="none"
          stroke="#eab308"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 156.57 43.43 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#22c55e"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Needle */}
        <line
          x1="100"
          y1="100"
          x2={nx}
          y2={ny}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="5" fill={color} />
        {/* Value */}
        <text
          x="100"
          y="70"
          textAnchor="middle"
          fill={color}
          fontSize="28"
          fontWeight="bold"
        >
          {value}
        </text>
      </svg>
    </div>
  );
}

export default function FearGreedPanel({
  fearGreed,
  market,
}: {
  fearGreed: FearGreedData;
  market: MarketData;
}) {
  const sparklineData = fearGreed.history.map((h) => ({
    value: h.value,
  }));

  const volume24h = market.volume_24h;
  const volumes = market.volumes_history.map(([, v]) => v);
  const avgVol30 =
    volumes.slice(-30).reduce((a, b) => a + b, 0) / Math.min(30, volumes.length);
  const volRatio = avgVol30 > 0 ? volume24h / avgVol30 : 1;

  return (
    <div className="panel">
      <h2 className="text-lg font-semibold mb-3">Market Sentiment</h2>

      <GaugeDisplay value={fearGreed.value} />
      <div className="text-center text-sm text-gray-400 mb-4">
        {fearGreed.value_classification}
      </div>

      {/* Sparkline */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1">
          Fear & Greed (30d)
        </div>
        <ResponsiveContainer width="100%" height={60}>
          <LineChart data={sparklineData}>
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              contentStyle={{
                backgroundColor: "#242836",
                border: "1px solid #2d3348",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "12px",
              }}
              formatter={(val: number) => [val, "F&G"]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">BTC Dominance</span>
          <span className="font-medium">{market.btc_dominance.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">24h Volume</span>
          <span className="font-medium">
            ${(volume24h / 1e9).toFixed(1)}B
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Vol vs 30d avg</span>
          <span
            className={`font-medium ${
              volRatio > 1.2
                ? "text-green-400"
                : volRatio < 0.8
                  ? "text-red-400"
                  : "text-gray-300"
            }`}
          >
            {volRatio.toFixed(2)}x
          </span>
        </div>
      </div>
    </div>
  );
}
