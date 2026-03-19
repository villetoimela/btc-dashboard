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

// Try fetching klines + ticker from a Binance domain, returns null if it fails
async function tryBinanceMarket(baseUrl: string): Promise<{
  dailyKlines: unknown[][];
  tickerData: Record<string, unknown>;
} | null> {
  try {
    const [dailyKlinesRes, tickerRes] = await Promise.all([
      fetchWithTimeout(`${baseUrl}/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=365`),
      fetchWithTimeout(`${baseUrl}/api/v3/ticker/24hr?symbol=BTCUSDT`),
    ]);

    if (!dailyKlinesRes.ok || !tickerRes.ok) {
      const status = [dailyKlinesRes.status, tickerRes.status];
      console.warn(`${baseUrl} returned non-OK: ${status.join(", ")}`);
      return null;
    }

    const dailyKlines = await dailyKlinesRes.json();
    const tickerData = await tickerRes.json();

    if (!Array.isArray(dailyKlines) || dailyKlines.length === 0) {
      console.warn(`${baseUrl}: klines response was not a valid array`);
      return null;
    }

    return { dailyKlines, tickerData };
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
      await tryBinanceMarket("https://api.binance.us") ??
      await tryBinanceMarket("https://api.binance.com");

    if (!binanceResult) {
      throw new Error("All Binance endpoints failed for market data");
    }

    const { dailyKlines, tickerData } = binanceResult;

    // EUR price: convert USD via frankfurter.app since Binance.US has no BTCEUR pair
    const [eurRateRes, globalRes] = await Promise.all([
      fetchWithTimeout(
        "https://api.frankfurter.app/latest?from=USD&to=EUR"
      ).catch(() => null),
      fetchWithTimeout("https://api.coingecko.com/api/v3/global").catch(() => null),
    ]);

    // Parse Binance data
    const priceUsd = parseFloat(String(tickerData.lastPrice));

    // Calculate EUR price from USD/EUR exchange rate
    let usdToEur = 0.92; // reasonable fallback rate
    if (eurRateRes && eurRateRes.ok) {
      try {
        const eurRateData = await eurRateRes.json();
        usdToEur = eurRateData.rates?.EUR || usdToEur;
      } catch {
        console.warn("Failed to parse EUR rate, using fallback rate");
      }
    } else {
      console.warn("EUR rate fetch failed, using fallback rate");
    }
    const priceEur = priceUsd * usdToEur;
    const change24h = parseFloat(String(tickerData.priceChangePercent)) || 0;
    const volume24h = parseFloat(String(tickerData.quoteVolume)) || 0; // Quote volume is already in USD

    // Parse daily klines into history arrays
    // Kline format: [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades, takerBuyBaseVol, takerBuyQuoteVol, ignore]
    const pricesHistory: [number, number][] = dailyKlines.map((k) => [
      Number(k[0]),
      parseFloat(k[4] as string),
    ]);

    const volumesHistory: [number, number][] = dailyKlines.map((k) => [
      Number(k[0]),
      parseFloat(k[7] as string),
    ]);

    // Parse OHLCV candles for candlestick chart
    const candlesHistory = dailyKlines.map((k) => ({
      time: Number(k[0]),
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
    }));

    // Calculate 7d and 30d changes from daily candles
    const currentClose = pricesHistory.length > 0
      ? pricesHistory[pricesHistory.length - 1][1]
      : priceUsd;

    const price7dAgo = pricesHistory.length >= 8
      ? pricesHistory[pricesHistory.length - 8][1]
      : currentClose;

    const price30dAgo = pricesHistory.length >= 31
      ? pricesHistory[pricesHistory.length - 31][1]
      : currentClose;

    const change7d = price7dAgo > 0
      ? ((currentClose - price7dAgo) / price7dAgo) * 100
      : 0;

    const change30d = price30dAgo > 0
      ? ((currentClose - price30dAgo) / price30dAgo) * 100
      : 0;

    // CoinGecko global data — graceful fallback
    let btcDominance = 60; // fallback
    let marketCap = 0; // fallback

    if (globalRes && globalRes.ok) {
      try {
        const globalData = await globalRes.json();
        const global = globalData.data;
        btcDominance = global.market_cap_percentage?.btc || 60;
        // Calculate BTC market cap from total market cap * BTC percentage
        const totalMarketCapUsd = global.total_market_cap?.usd || 0;
        marketCap = totalMarketCapUsd * (btcDominance / 100);
      } catch {
        console.warn("Failed to parse CoinGecko global data, using fallbacks");
      }
    }

    return NextResponse.json({
      price_usd: priceUsd,
      price_eur: priceEur,
      change_24h: change24h,
      change_7d: change7d,
      change_30d: change30d,
      market_cap: marketCap,
      volume_24h: volume24h,
      btc_dominance: btcDominance,
      prices_history: pricesHistory,
      volumes_history: volumesHistory,
      candles_history: candlesHistory,
    }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Market API error:", message);
    return NextResponse.json(
      { error: "Failed to fetch market data", details: message },
      { status: 500 }
    );
  }
}
