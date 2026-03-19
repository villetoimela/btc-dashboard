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

// Try fetching long/short data from a specific Binance domain
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

      // Validate that we got actual array data (not an error object)
      if (Array.isArray(positionData) && positionData.length > 0 &&
          Array.isArray(accountData) && accountData.length > 0 &&
          Array.isArray(globalData) && globalData.length > 0) {
        return { positionData, accountData, globalData };
      }
      console.warn(`${baseUrl}: response was not valid array data`);
      return null;
    }

    const status = [positionRes.status, accountRes.status, globalRes.status];
    console.warn(`${baseUrl} returned non-OK status: ${status.join(", ")}`);
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`${baseUrl} unavailable: ${msg}`);
    return null;
  }
}

export async function GET() {
  try {
    // Try multiple Binance domains in order:
    // 1. api.binance.com - main API domain, serves futures data endpoints without
    //    the geo-block that affects fapi.binance.com (the trading domain)
    // 2. fapi.binance.com - direct futures API, geo-blocked in the US
    const domains = [
      "https://api.binance.com",
      "https://fapi.binance.com",
    ];

    let result: Awaited<ReturnType<typeof tryBinanceDomain>> = null;
    let usedDomain = "";

    for (const domain of domains) {
      result = await tryBinanceDomain(domain);
      if (result) {
        usedDomain = domain;
        break;
      }
    }

    if (result) {
      return NextResponse.json({
        topTraderPositionRatio: parseRatioData(result.positionData),
        topTraderAccountRatio: parseRatioData(result.accountData),
        globalAccountRatio: parseRatioData(result.globalData),
        source: `binance (${usedDomain})`,
      }, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
      });
    }

    // Fallback: return neutral values so the UI doesn't break
    console.warn("Using fallback whale data (all Binance endpoints unavailable from this region)");
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
