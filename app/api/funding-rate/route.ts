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

interface BinanceFundingEntry {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
}

async function tryFundingRate(baseUrl: string): Promise<BinanceFundingEntry[] | null> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/fapi/v1/fundingRate?symbol=BTCUSDT&limit=21`
    );

    if (!res.ok) {
      console.warn(`${baseUrl} returned status ${res.status} for funding rate`);
      return null;
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`${baseUrl}: funding rate response was not a valid array`);
      return null;
    }

    return data as BinanceFundingEntry[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`${baseUrl} funding rate failed: ${msg}`);
    return null;
  }
}

export async function GET() {
  try {
    const data =
      (await tryFundingRate("https://fapi.binance.com")) ??
      (await tryFundingRate("https://api.binance.com"));

    if (!data) {
      // Return 500 so scoring skips this indicator entirely
      // (returning neutral data would inject a false bullish signal)
      console.warn("Funding rate unavailable from all endpoints");
      return NextResponse.json(
        { error: "Funding rate unavailable" },
        { status: 502 }
      );
    }

    const sorted = [...data].sort((a, b) => a.fundingTime - b.fundingTime);

    const history = sorted.map((entry) => ({
      time: entry.fundingTime,
      rate: parseFloat(entry.fundingRate),
    }));

    const currentRate = history[history.length - 1]?.rate ?? 0;

    const avgRate7d =
      history.length > 0
        ? history.reduce((sum, h) => sum + h.rate, 0) / history.length
        : 0;

    return NextResponse.json(
      {
        current_rate: currentRate,
        avg_rate_7d: avgRate7d,
        history,
        source: "binance",
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Funding rate API error:", message);
    return NextResponse.json(
      { error: "Failed to fetch funding rate data", details: message },
      { status: 500 }
    );
  }
}
