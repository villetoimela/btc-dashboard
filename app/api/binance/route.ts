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

export async function GET() {
  try {
    const [klinesRes, tickerRes] = await Promise.all([
      fetchWithTimeout(
        "https://api.binance.us/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=168"
      ),
      fetchWithTimeout(
        "https://api.binance.us/api/v3/ticker/24hr?symbol=BTCUSDT"
      ),
    ]);

    if (!klinesRes.ok || !tickerRes.ok) {
      const errors = [];
      if (!klinesRes.ok) errors.push(`klines: ${klinesRes.status} ${await klinesRes.text().catch(() => "")}`);
      if (!tickerRes.ok) errors.push(`ticker: ${tickerRes.status} ${await tickerRes.text().catch(() => "")}`);
      throw new Error(`Binance API error: ${errors.join("; ")}`);
    }

    const klinesData: unknown[][] = await klinesRes.json();
    const tickerData = await tickerRes.json();

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
    const change_24h = parseFloat(tickerData.priceChangePercent) || 0;
    const volume_24h = parseFloat(tickerData.quoteVolume) || 0;

    return NextResponse.json({
      candles,
      current_price: currentPrice,
      change_1h,
      change_4h,
      change_24h,
      volume_24h,
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
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
