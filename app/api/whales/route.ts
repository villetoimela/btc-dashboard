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

export async function GET() {
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

    if (!positionRes.ok || !accountRes.ok || !globalRes.ok) {
      throw new Error("Binance Futures API error");
    }

    const positionData: BinanceLongShortEntry[] = await positionRes.json();
    const accountData: BinanceLongShortEntry[] = await accountRes.json();
    const globalData: BinanceLongShortEntry[] = await globalRes.json();

    return NextResponse.json({
      topTraderPositionRatio: parseRatioData(positionData),
      topTraderAccountRatio: parseRatioData(accountData),
      globalAccountRatio: parseRatioData(globalData),
    }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Whale data API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch whale data" },
      { status: 500 }
    );
  }
}
