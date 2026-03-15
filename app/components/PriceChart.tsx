"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  type IChartApi,
  ColorType,
  LineStyle,
} from "lightweight-charts";
import { sma, bollingerBands } from "../lib/indicators";
import type { MarketData } from "../lib/types";

interface ChartDataPoint {
  time: string;
  value: number;
}

const TIMEFRAMES = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
];

function toChartData(prices: [number, number][]): ChartDataPoint[] {
  const seen = new Set<string>();
  return prices
    .map(([ts, price]) => {
      const d = new Date(ts);
      const time = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return { time, value: price };
    })
    .filter((item) => {
      if (seen.has(item.time)) return false;
      seen.add(item.time);
      return true;
    });
}

export default function PriceChart({ market }: { market: MarketData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [selectedDays, setSelectedDays] = useState(90);

  useEffect(() => {
    if (!containerRef.current || !market.prices_history.length) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#1a1d29" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "#2d334822" },
        horzLines: { color: "#2d334822" },
      },
      width: containerRef.current.clientWidth,
      height: 400,
      crosshair: {
        horzLine: { color: "#64748b" },
        vertLine: { color: "#64748b" },
      },
      timeScale: {
        borderColor: "#2d3348",
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: "#2d3348",
      },
    });

    chartRef.current = chart;

    const visibleData = market.prices_history.slice(-selectedDays);
    const chartData = toChartData(visibleData);

    // Price line
    const priceSeries = chart.addLineSeries({
      color: "#3b82f6",
      lineWidth: 2,
      priceLineVisible: false,
    });
    priceSeries.setData(chartData as any);

    // MA & BB calculations use all data for accuracy
    const allPrices = market.prices_history.map(([, p]) => p);
    const allChartData = toChartData(market.prices_history);
    const sliceStart = allChartData.length - selectedDays;

    // 50d MA
    if (selectedDays >= 30) {
      const ma50Full = sma(allPrices, 50);
      const ma50Series = chart.addLineSeries({
        color: "#eab308",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
      });
      const ma50Data = allChartData
        .slice(-selectedDays)
        .map((d, i) => ({
          time: d.time,
          value: ma50Full[sliceStart + i],
        }))
        .filter((d) => d.value && !isNaN(d.value));
      ma50Series.setData(ma50Data as any);
    }

    // 200d MA (only on 1y view)
    if (selectedDays >= 200) {
      const ma200Full = sma(allPrices, 200);
      const ma200Series = chart.addLineSeries({
        color: "#ef4444",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
      });
      const ma200Data = allChartData
        .slice(-selectedDays)
        .map((d, i) => ({
          time: d.time,
          value: ma200Full[sliceStart + i],
        }))
        .filter((d) => d.value && !isNaN(d.value));
      ma200Series.setData(ma200Data as any);
    }

    // Bollinger Bands
    if (selectedDays >= 20) {
      const bbFull = bollingerBands(allPrices, 20, 2);

      const bbUpperSeries = chart.addLineSeries({
        color: "#64748b44",
        lineWidth: 1,
        priceLineVisible: false,
      });
      const bbUpperData = allChartData
        .slice(-selectedDays)
        .map((d, i) => ({
          time: d.time,
          value: bbFull.upper[sliceStart + i],
        }))
        .filter((d) => d.value && !isNaN(d.value));
      bbUpperSeries.setData(bbUpperData as any);

      const bbLowerSeries = chart.addLineSeries({
        color: "#64748b44",
        lineWidth: 1,
        priceLineVisible: false,
      });
      const bbLowerData = allChartData
        .slice(-selectedDays)
        .map((d, i) => ({
          time: d.time,
          value: bbFull.lower[sliceStart + i],
        }))
        .filter((d) => d.value && !isNaN(d.value));
      bbLowerSeries.setData(bbLowerData as any);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [market, selectedDays]);

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Price Chart</h2>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.days}
              onClick={() => setSelectedDays(tf.days)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                selectedDays === tf.days
                  ? "bg-blue-600 text-white"
                  : "bg-[#242836] text-gray-400 hover:bg-[#2d3348] hover:text-gray-200"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-4 text-xs text-gray-500 mb-2">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-blue-500 inline-block"></span> Price
        </span>
        {selectedDays >= 30 && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-yellow-500 inline-block"></span> 50d MA
          </span>
        )}
        {selectedDays >= 200 && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-red-500 inline-block"></span> 200d MA
          </span>
        )}
        {selectedDays >= 20 && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-gray-500 inline-block"></span> BB
          </span>
        )}
      </div>
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
