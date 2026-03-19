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

async function tryDailyKlines(baseUrl: string): Promise<unknown[][] | null> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=365`
    );

    if (!res.ok) {
      console.warn(`${baseUrl} returned status ${res.status} for daily klines`);
      return null;
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`${baseUrl}: daily klines response was not a valid array`);
      return null;
    }

    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`${baseUrl} daily klines failed: ${msg}`);
    return null;
  }
}

interface AthInfo {
  ath: number;
  ath_date: string;
}

async function fetchAthData(): Promise<AthInfo | null> {
  try {
    const res = await fetchWithTimeout(
      "https://api.coingecko.com/api/v3/coins/bitcoin",
      10000
    );

    if (!res.ok) {
      console.warn(`CoinGecko returned status ${res.status}`);
      return null;
    }

    const data = await res.json();
    const ath = data?.market_data?.ath?.usd;
    const athDate = data?.market_data?.ath_date?.usd;

    if (typeof ath !== "number" || !athDate) {
      console.warn("CoinGecko ATH data was incomplete");
      return null;
    }

    // Extract date portion from ISO string
    const dateStr = typeof athDate === "string" ? athDate.split("T")[0] : "";

    return { ath, ath_date: dateStr };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`CoinGecko ATH fetch failed (non-fatal): ${msg}`);
    return null;
  }
}

function getHighLow(
  candles: { high: number; low: number }[]
): { high: number; low: number } {
  let high = -Infinity;
  let low = Infinity;
  for (const c of candles) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  return { high, low };
}

export async function GET() {
  try {
    // Fetch daily klines and ATH data in parallel
    const [rawKlines, athInfo] = await Promise.all([
      (async () => {
        return (
          (await tryDailyKlines("https://api.binance.us")) ??
          (await tryDailyKlines("https://api.binance.com"))
        );
      })(),
      fetchAthData(),
    ]);

    if (!rawKlines) {
      throw new Error("All Binance endpoints failed for daily klines");
    }

    // Parse klines: [openTime, open, high, low, close, volume, ...]
    const candles = rawKlines.map((k) => ({
      time: Number(k[0]),
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));

    const currentPrice = candles[candles.length - 1]?.close ?? 0;

    // Last 1 day (most recent candle)
    const candles1d = candles.slice(-1);
    const { high: high24h, low: low24h } = getHighLow(candles1d);

    // Last 7 days
    const candles7d = candles.slice(-7);
    const { high: high7d, low: low7d } = getHighLow(candles7d);

    // Last 30 days
    const candles30d = candles.slice(-30);
    const { high: high30d, low: low30d } = getHighLow(candles30d);

    // range_30d_position: where current price sits within the 30d range (0 = at low, 1 = at high)
    const range30d = high30d - low30d;
    const range30dPosition = range30d > 0 ? (currentPrice - low30d) / range30d : 0.5;

    // price_percentile_365d: percentage of daily closes below current price
    const dailyCloses = candles.map((c) => c.close);
    const closesBelow = dailyCloses.filter((c) => c < currentPrice).length;
    const pricePercentile365d =
      dailyCloses.length > 0 ? (closesBelow / dailyCloses.length) * 100 : 50;

    // ATH data: use CoinGecko if available, otherwise derive from 365d data
    const ath = athInfo?.ath ?? getHighLow(candles).high;
    const athDate = athInfo?.ath_date ?? "";
    const distanceFromAthPercent =
      ath > 0 ? ((currentPrice - ath) / ath) * 100 : 0;

    return NextResponse.json(
      {
        high_24h: high24h,
        low_24h: low24h,
        high_7d: high7d,
        low_7d: low7d,
        high_30d: high30d,
        low_30d: low30d,
        ath,
        ath_date: athDate,
        distance_from_ath_percent: Math.round(distanceFromAthPercent * 100) / 100,
        range_30d_position: Math.round(range30dPosition * 1000) / 1000,
        price_percentile_365d: Math.round(pricePercentile365d * 100) / 100,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Levels API error:", message);
    return NextResponse.json(
      { error: "Failed to fetch price level data", details: message },
      { status: 500 }
    );
  }
}
