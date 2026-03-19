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

// Try fetching hourly klines + ticker from a Binance domain
async function tryBinanceHourly(baseUrl: string): Promise<{
  klinesData: unknown[][];
  tickerData: Record<string, unknown>;
} | null> {
  try {
    const [klinesRes, tickerRes] = await Promise.all([
      fetchWithTimeout(`${baseUrl}/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=168`),
      fetchWithTimeout(`${baseUrl}/api/v3/ticker/24hr?symbol=BTCUSDT`),
    ]);

    if (!klinesRes.ok || !tickerRes.ok) {
      const status = [klinesRes.status, tickerRes.status];
      console.warn(`${baseUrl} returned non-OK: ${status.join(", ")}`);
      return null;
    }

    const klinesData = await klinesRes.json();
    const tickerData = await tickerRes.json();

    if (!Array.isArray(klinesData) || klinesData.length === 0) {
      console.warn(`${baseUrl}: klines response was not a valid array`);
      return null;
    }

    return { klinesData, tickerData };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`${baseUrl} failed: ${msg}`);
    return null;
  }
}

export async function GET() {
  try {
    // Try Binance.US first (avoids HTTP 451 geo-block on Netlify US servers),
    // fall back to api.binance.com if .US is down
    const binanceResult =
      await tryBinanceHourly("https://api.binance.us") ??
      await tryBinanceHourly("https://api.binance.com");

    if (!binanceResult) {
      throw new Error("All Binance endpoints failed for hourly data");
    }

    const { klinesData, tickerData } = binanceResult;

    // Parse klines: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBaseVol, takerBuyQuoteVol, ignore]
    const candles = klinesData.map((k) => ({
      time: Number(k[0]),
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));

    const currentPrice = candles[candles.length - 1]?.close ?? 0;

    // Calculate 1h change from candles
    const price1hAgo = candles.length >= 2 ? candles[candles.length - 2].close : currentPrice;
    const change_1h = price1hAgo > 0 ? ((currentPrice - price1hAgo) / price1hAgo) * 100 : 0;

    // Calculate 4h change from candles
    const price4hAgo = candles.length >= 5 ? candles[candles.length - 5].close : currentPrice;
    const change_4h = price4hAgo > 0 ? ((currentPrice - price4hAgo) / price4hAgo) * 100 : 0;

    // 24h change and volume from ticker
    const change_24h = parseFloat(String(tickerData.priceChangePercent)) || 0;
    const volume_24h = parseFloat(String(tickerData.quoteVolume)) || 0;

    return NextResponse.json({
      candles,
      current_price: currentPrice,
      change_1h,
      change_4h,
      change_24h,
      volume_24h,
    }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Binance API error:", message);
    return NextResponse.json(
      { error: "Failed to fetch Binance data", details: message },
      { status: 500 }
    );
  }
}
