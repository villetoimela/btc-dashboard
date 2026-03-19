"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type {
  MarketData,
  FearGreedData,
  OnchainData,
  BinanceData,
  DashboardScore,
  ShortTermScore,
  WhaleData,
  LevelsData,
} from "./lib/types";
import {
  calculateScore,
  calculateShortTermScore,
  getRecommendationStyle,
  getShortTermStyle,
} from "./lib/scoring";
import TopBar from "./components/TopBar";
import PriceChart from "./components/PriceChart";
import TechnicalPanel from "./components/TechnicalPanel";
import FearGreedPanel from "./components/FearGreedPanel";
import CyclePanel from "./components/CyclePanel";
import OnchainPanel from "./components/OnchainPanel";
import ScoreBreakdown from "./components/ScoreBreakdown";
import WhalePanel from "./components/WhalePanel";
import MomentumStrip from "./components/MomentumStrip";
import KeyLevels from "./components/KeyLevels";
import AlertBanner, {
  useNotificationPermission,
  type ToastMessage,
} from "./components/AlertBanner";
import EventLog, { addEvent } from "./components/EventLog";

type Tab = "invest" | "daytrade";

const TAB_KEY = "btc-dash-active-tab";
const PREV_SCORE_KEY = "btc-dash-prev-score";
const PREV_SIGNALS_KEY = "btc-dash-prev-signals";

function getStoredTab(): Tab {
  if (typeof window === "undefined") return "daytrade";
  const stored = localStorage.getItem(TAB_KEY);
  if (stored === "invest" || stored === "daytrade") return stored;
  return "daytrade";
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>(() => getStoredTab());
  const [market, setMarket] = useState<MarketData | null>(null);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);
  const [onchain, setOnchain] = useState<OnchainData | null>(null);
  const [score, setScore] = useState<DashboardScore | null>(null);
  const [shortTermScore, setShortTermScore] = useState<ShortTermScore | null>(null);
  const [binanceData, setBinanceData] = useState<BinanceData | null>(null);
  const [whaleData, setWhaleData] = useState<WhaleData | null>(null);
  const whaleRef = useRef<WhaleData | null>(null);
  const [levelsData, setLevelsData] = useState<LevelsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [binanceError, setBinanceError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const { permission: notifPerm, requestPermission, sendNotification } =
    useNotificationPermission();

  // Persist active tab
  useEffect(() => {
    localStorage.setItem(TAB_KEY, activeTab);
  }, [activeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "1") setActiveTab("invest");
      else if (e.key === "2") setActiveTab("daytrade");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const addToast = useCallback(
    (text: string, type: ToastMessage["type"] = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, text, type, timestamp: Date.now() }]);
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Check for alert conditions
  const checkAlerts = useCallback(
    (newScore: number, indicators: { name: string; signal: string }[]) => {
      // Score threshold alerts
      const prevScoreStr = localStorage.getItem(PREV_SCORE_KEY);
      const prevScore = prevScoreStr ? parseFloat(prevScoreStr) : null;

      if (prevScore !== null) {
        // Score crossed above 70
        if (newScore >= 70 && prevScore < 70) {
          const msg = `Score crossed above 70 (${newScore})`;
          addEvent(msg);
          addToast(msg, "success");
          sendNotification("BTC Dashboard", msg);
        }
        // Score crossed below 30
        if (newScore <= 30 && prevScore > 30) {
          const msg = `Score dropped below 30 (${newScore})`;
          addEvent(msg);
          addToast(msg, "warning");
          sendNotification("BTC Dashboard", msg);
        }
        // Large score change
        const delta = Math.abs(newScore - prevScore);
        if (delta >= 10) {
          const direction = newScore > prevScore ? "up" : "down";
          const msg = `Score moved ${direction} by ${delta} points (${prevScore} -> ${newScore})`;
          addEvent(msg);
          addToast(msg, "info");
          sendNotification("BTC Dashboard", msg);
        }
      }

      localStorage.setItem(PREV_SCORE_KEY, String(newScore));

      // Signal flip alerts
      const prevSignalsStr = localStorage.getItem(PREV_SIGNALS_KEY);
      let prevSignals: Record<string, string> = {};
      try {
        if (prevSignalsStr) prevSignals = JSON.parse(prevSignalsStr);
      } catch {
        /* ignore */
      }

      const highWeightIndicators = indicators.filter(
        (ind) =>
          "weight" in ind &&
          (ind as { weight: number }).weight >= 10
      );

      for (const ind of highWeightIndicators) {
        const prev = prevSignals[ind.name];
        if (prev && prev !== ind.signal) {
          const msg = `${ind.name} flipped ${ind.signal}`;
          addEvent(msg);
          addToast(msg, ind.signal === "bullish" ? "success" : "warning");
          sendNotification("BTC Dashboard", msg);
        }
      }

      const newSignals: Record<string, string> = {};
      for (const ind of indicators) {
        newSignals[ind.name] = ind.signal;
      }
      localStorage.setItem(PREV_SIGNALS_KEY, JSON.stringify(newSignals));
    },
    [addToast, sendNotification]
  );

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
          prev
            ? {
                ...prev,
                price_usd: parseFloat(usd.price),
                price_eur: parseFloat(eur.price),
              }
            : prev
        );
      }
    } catch {
      /* silent */
    }
  }, []);

  const fetchBinanceAndWhales = useCallback(async () => {
    try {
      setBinanceError(null);
      const [binanceRes, whaleRes, fundingRes, orderbookRes] = await Promise.all([
        fetch("/api/binance"),
        fetch("/api/whales").catch(() => null),
        fetch("/api/funding-rate").catch(() => null),
        fetch("/api/orderbook").catch(() => null),
      ]);
      if (!binanceRes.ok) {
        throw new Error("Binance API call failed");
      }
      const binData: BinanceData = await binanceRes.json();
      setBinanceData(binData);

      if (whaleRes?.ok) {
        const whales: WhaleData = await whaleRes.json();
        whaleRef.current = whales;
        setWhaleData(whales);
      }

      // Parse optional data - pass to scoring if available
      let fundingData = null;
      let orderbookData = null;
      if (fundingRes?.ok) {
        fundingData = await fundingRes.json();
      }
      if (orderbookRes?.ok) {
        orderbookData = await orderbookRes.json();
      }

      const shortTerm = calculateShortTermScore(
        binData,
        whaleRef.current,
        fundingData,
        orderbookData
      );
      setShortTermScore(shortTerm);

      // Check alerts for short-term score
      checkAlerts(shortTerm.total, shortTerm.indicators);
    } catch {
      setBinanceError("Failed to fetch Binance data");
    }
  }, [checkAlerts]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [marketRes, fgRes, onchainRes, levelsRes] = await Promise.all([
        fetch("/api/market"),
        fetch("/api/fear-greed"),
        fetch("/api/onchain"),
        fetch("/api/levels").catch(() => null),
      ]);

      if (!marketRes.ok || !fgRes.ok || !onchainRes.ok) {
        throw new Error("API call failed");
      }

      const marketData: MarketData = await marketRes.json();
      const fgData: FearGreedData = await fgRes.json();
      const onchainData: OnchainData = await onchainRes.json();

      if (levelsRes?.ok) {
        const levels: LevelsData = await levelsRes.json();
        setLevelsData(levels);
      }

      setMarket(marketData);
      setFearGreed(fgData);
      setOnchain(onchainData);

      const calculated = calculateScore(marketData, fgData, onchainData);
      setScore(calculated);
      setLastUpdate(new Date());

      // Check alerts for long-term score
      checkAlerts(calculated.total, calculated.indicators);
    } catch {
      setError("Failed to fetch data. Retrying...");
    } finally {
      setLoading(false);
    }
  }, [checkAlerts]);

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
  const shortTermRec = shortTermScore
    ? getShortTermStyle(shortTermScore.recommendation)
    : null;

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header with tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <h1 className="text-lg sm:text-xl font-bold text-gray-300 whitespace-nowrap">
            BTC Dashboard
          </h1>
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
              <span className="hidden sm:inline text-[10px] text-gray-500 ml-1">[1]</span>
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
              <span className="hidden sm:inline text-[10px] text-gray-500 ml-1">[2]</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Top bar -- changes based on active tab */}
      {activeTab === "invest" ? (
        <TopBar
          market={market}
          total={score.total}
          recommendation={longTermRec}
          scoreLabel="Long Term"
          lastUpdate={lastUpdate}
          notificationPermission={notifPerm}
          onRequestNotifications={requestPermission}
        />
      ) : shortTermScore && shortTermRec ? (
        <TopBar
          market={market}
          total={shortTermScore.total}
          recommendation={shortTermRec}
          scoreLabel="Short Term"
          lastUpdate={lastUpdate}
          notificationPermission={notifPerm}
          onRequestNotifications={requestPermission}
        />
      ) : (
        <div className="panel p-4 text-center text-gray-400">
          {binanceError || "Loading Binance data..."}
        </div>
      )}

      {/* Price chart -- always visible */}
      <PriceChart
        mode={activeTab}
        currentPrice={market.price_usd}
        change24h={market.change_24h}
      />

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
            consensus={score.consensus}
          />
        </>
      ) : shortTermScore ? (
        <>
          {binanceError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {binanceError}
            </div>
          )}

          {/* Momentum strip */}
          <MomentumStrip binanceData={binanceData} />

          {/* Key levels */}
          <KeyLevels levels={levelsData} currentPrice={market.price_usd} />

          {/* Short-term score breakdown */}
          <ScoreBreakdown
            indicators={shortTermScore.indicators}
            total={shortTermScore.total}
            title="Short Term Scores"
            consensus={shortTermScore.consensus}
          />

          {/* Whale panel */}
          <WhalePanel data={whaleData} />
        </>
      ) : (
        <div className="panel p-8 text-center text-gray-400">
          {binanceError || "Loading intraday data..."}
        </div>
      )}

      {/* Event log */}
      <EventLog />

      {/* Footer */}
      <div className="text-center text-xs text-gray-700 py-4">
        Data: Binance, CoinGecko, Alternative.me, Mempool.space | Not financial
        advice
      </div>

      {/* Toast notifications */}
      <AlertBanner toasts={toasts} onDismissToast={dismissToast} />
    </main>
  );
}
