"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { MarketData, FearGreedData, OnchainData, BinanceData, DashboardScore, ShortTermScore, WhaleData } from "./lib/types";
import { calculateScore, calculateShortTermScore, getRecommendationStyle, getShortTermStyle } from "./lib/scoring";
import TopBar from "./components/TopBar";
import PriceChart from "./components/PriceChart";
import TechnicalPanel from "./components/TechnicalPanel";
import FearGreedPanel from "./components/FearGreedPanel";
import CyclePanel from "./components/CyclePanel";
import OnchainPanel from "./components/OnchainPanel";
import ScoreBreakdown from "./components/ScoreBreakdown";
import WhalePanel from "./components/WhalePanel";

type Tab = "invest" | "daytrade";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("invest");
  const [market, setMarket] = useState<MarketData | null>(null);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);
  const [onchain, setOnchain] = useState<OnchainData | null>(null);
  const [score, setScore] = useState<DashboardScore | null>(null);
  const [shortTermScore, setShortTermScore] = useState<ShortTermScore | null>(null);
  const [whaleData, setWhaleData] = useState<WhaleData | null>(null);
  const whaleRef = useRef<WhaleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [binanceError, setBinanceError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchPrice = useCallback(async () => {
    try {
      const [usdRes, eurRes] = await Promise.all([
        fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"),
        fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR"),
      ]);
      if (usdRes.ok && eurRes.ok) {
        const usd = await usdRes.json();
        const eur = await eurRes.json();
        setMarket((prev) =>
          prev ? { ...prev, price_usd: parseFloat(usd.price), price_eur: parseFloat(eur.price) } : prev
        );
      }
    } catch {}
  }, []);

  const fetchBinanceAndWhales = useCallback(async () => {
    try {
      setBinanceError(null);
      const [binanceRes, whaleRes] = await Promise.all([
        fetch("/api/binance"),
        fetch("/api/whales").catch(() => null),
      ]);
      if (!binanceRes.ok) {
        throw new Error("Binance API call failed");
      }
      const binData: BinanceData = await binanceRes.json();
      if (whaleRes?.ok) {
        const whales: WhaleData = await whaleRes.json();
        whaleRef.current = whales;
        setWhaleData(whales);
      }
      const shortTerm = calculateShortTermScore(binData, whaleRef.current);
      setShortTermScore(shortTerm);
    } catch {
      setBinanceError("Failed to fetch Binance data");
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [marketRes, fgRes, onchainRes] = await Promise.all([
        fetch("/api/market"),
        fetch("/api/fear-greed"),
        fetch("/api/onchain"),
      ]);

      if (!marketRes.ok || !fgRes.ok || !onchainRes.ok) {
        throw new Error("API call failed");
      }

      const marketData: MarketData = await marketRes.json();
      const fgData: FearGreedData = await fgRes.json();
      const onchainData: OnchainData = await onchainRes.json();

      setMarket(marketData);
      setFearGreed(fgData);
      setOnchain(onchainData);

      const calculated = calculateScore(marketData, fgData, onchainData);
      setScore(calculated);
      setLastUpdate(new Date());
    } catch {
      setError("Failed to fetch data. Retrying...");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchBinanceAndWhales();
    const mainInterval = setInterval(fetchData, 60000);
    const binanceInterval = setInterval(fetchBinanceAndWhales, 30000);
    const priceInterval = setInterval(fetchPrice, 5000);
    return () => {
      clearInterval(mainInterval);
      clearInterval(binanceInterval);
      clearInterval(priceInterval);
    };
  }, [fetchData, fetchBinanceAndWhales, fetchPrice]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-gray-400">Loading market data...</p>
        </div>
      </div>
    );
  }

  if (error && !market) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center panel max-w-md">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchData();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!market || !fearGreed || !onchain || !score) {
    return null;
  }

  const longTermRec = getRecommendationStyle(score.recommendation);
  const shortTermRec = shortTermScore ? getShortTermStyle(shortTermScore.recommendation) : null;

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header with tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <h1 className="text-lg sm:text-xl font-bold text-gray-300 whitespace-nowrap">BTC Dashboard</h1>
          <div className="flex bg-[#1a1d29] rounded-lg p-1 gap-1">
            <button
              onClick={() => setActiveTab("invest")}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "invest"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#2d3348]"
              }`}
            >
              Invest
            </button>
            <button
              onClick={() => setActiveTab("daytrade")}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === "daytrade"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#2d3348]"
              }`}
            >
              Day Trade
            </button>
          </div>
        </div>
        {lastUpdate && (
          <span className="text-xs text-gray-600">
            Updated:{" "}
            {lastUpdate.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Top bar — changes based on active tab */}
      {activeTab === "invest" ? (
        <TopBar
          market={market}
          total={score.total}
          recommendation={longTermRec}
          scoreLabel="Long Term"
        />
      ) : shortTermScore && shortTermRec ? (
        <TopBar
          market={market}
          total={shortTermScore.total}
          recommendation={shortTermRec}
          scoreLabel="Short Term"
        />
      ) : (
        <div className="panel p-4 text-center text-gray-400">
          {binanceError || "Loading Binance data..."}
        </div>
      )}

      {/* Price chart — always visible */}
      <PriceChart market={market} />

      {/* Tab-specific content */}
      {activeTab === "invest" ? (
        <>
          {/* Long-term panels grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <TechnicalPanel score={score} />
            <FearGreedPanel fearGreed={fearGreed} market={market} />
            <CyclePanel onchain={onchain} />
            <OnchainPanel onchain={onchain} />
          </div>

          {/* Whale panel */}
          <WhalePanel data={whaleData} />

          {/* Long-term score breakdown */}
          <ScoreBreakdown
            indicators={score.indicators}
            total={score.total}
            title="Score Breakdown"
          />
        </>
      ) : shortTermScore ? (
        <>
          {binanceError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {binanceError}
            </div>
          )}
          {/* Short-term score breakdown */}
          <ScoreBreakdown
            indicators={shortTermScore.indicators}
            total={shortTermScore.total}
            title="Short Term Scores"
          />

          {/* Whale panel */}
          <WhalePanel data={whaleData} />
        </>
      ) : (
        <div className="panel p-8 text-center text-gray-400">
          {binanceError || "Loading intraday data..."}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-gray-700 py-4">
        Data: Binance, CoinGecko, Alternative.me, Mempool.space | Not financial advice
      </div>
    </main>
  );
}
