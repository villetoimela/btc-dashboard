import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function fetchWithTimeout(url: string, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch {
    clearTimeout(id);
    throw new Error(`Fetch timeout: ${url}`);
  }
}

interface BinanceLongShortEntry {
  symbol: string;
  longShortRatio: string;
  longAccount: string;
  shortAccount: string;
  timestamp: number;
}

function parseRatioData(entries: BinanceLongShortEntry[]) {
  const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
  const latest = sorted[sorted.length - 1];

  const longPercent = parseFloat(latest.longAccount) * 100;
  const shortPercent = parseFloat(latest.shortAccount) * 100;
  const ratio = parseFloat(latest.longShortRatio);

  const history = sorted.map((e) => ({
    time: e.timestamp,
    longPercent: parseFloat(e.longAccount) * 100,
    shortPercent: parseFloat(e.shortAccount) * 100,
  }));

  return { longPercent, shortPercent, ratio, history };
}

function makeFallbackRatio() {
  return {
    longPercent: 50,
    shortPercent: 50,
    ratio: 1,
    history: [],
  };
}

// Try Binance futures data from a specific domain
async function tryBinanceDomain(baseUrl: string): Promise<{
  positionData: BinanceLongShortEntry[];
  accountData: BinanceLongShortEntry[];
  globalData: BinanceLongShortEntry[];
} | null> {
  try {
    const [positionRes, accountRes, globalRes] = await Promise.all([
      fetchWithTimeout(
        `${baseUrl}/futures/data/topLongShortPositionRatio?symbol=BTCUSDT&period=1h&limit=24`
      ),
      fetchWithTimeout(
        `${baseUrl}/futures/data/topLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=24`
      ),
      fetchWithTimeout(
        `${baseUrl}/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=24`
      ),
    ]);

    if (positionRes.ok && accountRes.ok && globalRes.ok) {
      const positionData = await positionRes.json();
      const accountData = await accountRes.json();
      const globalData = await globalRes.json();

      if (Array.isArray(positionData) && positionData.length > 0 &&
          Array.isArray(accountData) && accountData.length > 0 &&
          Array.isArray(globalData) && globalData.length > 0) {
        return { positionData, accountData, globalData };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Bybit long/short ratio as fallback (not geo-blocked)
interface BybitRatioEntry {
  symbol: string;
  buyRatio: string;
  sellRatio: string;
  timestamp: string;
}

async function tryBybit() {
  try {
    const res = await fetchWithTimeout(
      "https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=BTCUSDT&period=1h&limit=24"
    );
    if (!res.ok) return null;

    const json = await res.json();
    const list = json?.result?.list;
    if (!Array.isArray(list) || list.length === 0) return null;

    // Bybit format: { buyRatio: "0.55", sellRatio: "0.45", timestamp: "1234567890" }
    const sorted = [...list].sort(
      (a: BybitRatioEntry, b: BybitRatioEntry) =>
        parseInt(a.timestamp) - parseInt(b.timestamp)
    );
    const latest = sorted[sorted.length - 1];

    const longPercent = parseFloat(latest.buyRatio) * 100;
    const shortPercent = parseFloat(latest.sellRatio) * 100;
    const ratio = shortPercent > 0 ? longPercent / shortPercent : 1;

    const history = sorted.map((e: BybitRatioEntry) => ({
      time: parseInt(e.timestamp) * 1000,
      longPercent: parseFloat(e.buyRatio) * 100,
      shortPercent: parseFloat(e.sellRatio) * 100,
    }));

    const ratioData = { longPercent, shortPercent, ratio, history };

    // Bybit only gives global account ratio, use it for all 3
    return {
      topTraderPositionRatio: ratioData,
      topTraderAccountRatio: ratioData,
      globalAccountRatio: ratioData,
      source: "bybit",
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    // 1. Try Binance domains
    const domains = [
      "https://fapi.binance.com",
      "https://api.binance.com",
    ];

    for (const domain of domains) {
      const result = await tryBinanceDomain(domain);
      if (result) {
        return NextResponse.json({
          topTraderPositionRatio: parseRatioData(result.positionData),
          topTraderAccountRatio: parseRatioData(result.accountData),
          globalAccountRatio: parseRatioData(result.globalData),
          source: `binance (${domain})`,
        }, {
          headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
        });
      }
    }

    // 2. Try Bybit as fallback
    const bybitResult = await tryBybit();
    if (bybitResult) {
      return NextResponse.json(bybitResult, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
      });
    }

    // 3. Final fallback: neutral values
    console.warn("All whale data sources unavailable");
    return NextResponse.json({
      topTraderPositionRatio: makeFallbackRatio(),
      topTraderAccountRatio: makeFallbackRatio(),
      globalAccountRatio: makeFallbackRatio(),
      source: "fallback",
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Whale data API error:", message);
    return NextResponse.json(
      { error: "Failed to fetch whale data", details: message },
      { status: 500 }
    );
  }
}
