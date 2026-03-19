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

interface BinanceDepthResponse {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

async function tryOrderBook(baseUrl: string): Promise<BinanceDepthResponse | null> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/api/v3/depth?symbol=BTCUSDT&limit=20`
    );

    if (!res.ok) {
      console.warn(`${baseUrl} returned status ${res.status} for order book`);
      return null;
    }

    const data = await res.json();

    if (!data.bids || !data.asks || !Array.isArray(data.bids) || !Array.isArray(data.asks)) {
      console.warn(`${baseUrl}: order book response was not valid`);
      return null;
    }

    return data as BinanceDepthResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`${baseUrl} order book failed: ${msg}`);
    return null;
  }
}

export async function GET() {
  try {
    const data =
      (await tryOrderBook("https://api.binance.com")) ??
      (await tryOrderBook("https://api.binance.us"));

    if (!data) {
      throw new Error("All Binance endpoints failed for order book data");
    }

    const bidVolume = data.bids.reduce(
      (sum, [, qty]) => sum + parseFloat(qty),
      0
    );
    const askVolume = data.asks.reduce(
      (sum, [, qty]) => sum + parseFloat(qty),
      0
    );

    const topBid = parseFloat(data.bids[0]?.[0] ?? "0");
    const topAsk = parseFloat(data.asks[0]?.[0] ?? "0");

    const imbalanceRatio = askVolume > 0 ? bidVolume / askVolume : 1;
    const spreadPercent = topBid > 0 ? ((topAsk - topBid) / topBid) * 100 : 0;

    return NextResponse.json(
      {
        bid_volume: Math.round(bidVolume * 1000) / 1000,
        ask_volume: Math.round(askVolume * 1000) / 1000,
        imbalance_ratio: Math.round(imbalanceRatio * 1000) / 1000,
        spread_percent: Math.round(spreadPercent * 10000) / 10000,
        top_bid: topBid,
        top_ask: topAsk,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Order book API error:", message);
    return NextResponse.json(
      { error: "Failed to fetch order book data", details: message },
      { status: 500 }
    );
  }
}
