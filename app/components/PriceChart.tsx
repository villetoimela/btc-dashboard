"use client";

import { useEffect, useRef, memo, useState } from "react";

interface PriceChartProps {
  mode: "invest" | "daytrade";
  currentPrice?: number | null;
  change24h?: number | null;
}

const COLLAPSED_KEY = "btc-dash-chart-collapsed";

function PriceChartInner({ mode, currentPrice, change24h }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (!containerRef.current || collapsed) return;

    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: "BINANCE:BTCUSDT",
      interval: mode === "invest" ? "D" : "15",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "#1a1d29",
      gridColor: "#2d334822",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      studies: [],
    });

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";

    const widgetDiv = document.createElement("div");
    widgetDiv.className = "tradingview-widget-container__widget";
    widgetDiv.style.height = "calc(100% - 32px)";
    widgetDiv.style.width = "100%";

    wrapper.appendChild(widgetDiv);
    wrapper.appendChild(script);
    containerRef.current.appendChild(wrapper);
  }, [mode, collapsed]);

  const formatPrice = (n: number) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="panel relative">
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-md bg-[#242836] hover:bg-[#2d3348] text-gray-400 hover:text-gray-200 transition-colors text-xs"
        title={collapsed ? "Expand chart" : "Collapse chart"}
      >
        {collapsed ? "\u25BC" : "\u25B2"}
      </button>

      {collapsed ? (
        <div className="flex items-center justify-between py-1 pr-8">
          <span className="text-sm text-gray-400">Chart</span>
          <div className="flex items-center gap-3">
            {currentPrice != null && (
              <span className="text-sm font-bold">${formatPrice(currentPrice)}</span>
            )}
            {change24h != null && (
              <span
                className={`text-sm font-medium ${
                  change24h > 0 ? "text-green-400" : change24h < 0 ? "text-red-400" : "text-gray-400"
                }`}
              >
                {change24h > 0 ? "+" : ""}
                {change24h.toFixed(1)}% 24h
              </span>
            )}
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="w-full h-[300px] md:h-[300px]" />
      )}
    </div>
  );
}

const PriceChart = memo(PriceChartInner);
export default PriceChart;
