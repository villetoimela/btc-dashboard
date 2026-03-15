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

export async function GET() {
  try {
    // Try Binance futures API first (works when server is not in the US)
    // Falls back to CoinGlass public data, then to neutral fallback values
    let positionData: BinanceLongShortEntry[] | null = null;
    let accountData: BinanceLongShortEntry[] | null = null;
    let globalData: BinanceLongShortEntry[] | null = null;

    // Attempt Binance futures API
    try {
      const [positionRes, accountRes, globalRes] = await Promise.all([
        fetchWithTimeout(
          "https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=BTCUSDT&period=1h&limit=24"
        ),
        fetchWithTimeout(
          "https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=24"
        ),
        fetchWithTimeout(
          "https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=24"
        ),
      ]);

      if (positionRes.ok && accountRes.ok && globalRes.ok) {
        positionData = await positionRes.json();
        accountData = await accountRes.json();
        globalData = await globalRes.json();
      } else {
        const status = [positionRes.status, accountRes.status, globalRes.status];
        console.warn(`Binance Futures API returned non-OK status: ${status.join(", ")}`);
      }
    } catch (binanceError) {
      const msg = binanceError instanceof Error ? binanceError.message : String(binanceError);
      console.warn("Binance Futures API unavailable (likely geo-blocked):", msg);
    }

    // If Binance futures data is available, use it
    if (positionData && accountData && globalData) {
      return NextResponse.json({
        topTraderPositionRatio: parseRatioData(positionData),
        topTraderAccountRatio: parseRatioData(accountData),
        globalAccountRatio: parseRatioData(globalData),
        source: "binance",
      }, {
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
      });
    }

    // Fallback: return neutral values so the UI doesn't break
    console.warn("Using fallback whale data (Binance Futures API unavailable from this region)");
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
