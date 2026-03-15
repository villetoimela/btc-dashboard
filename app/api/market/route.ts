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
    // Fetch from Binance.US (avoids HTTP 451 geo-block on Netlify US servers)
    // EUR price: convert USD via frankfurter.app since Binance.US has no BTCEUR pair
    const [dailyKlinesRes, tickerRes, eurRateRes, globalRes] = await Promise.all([
      fetchWithTimeout(
        "https://api.binance.us/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=365"
      ),
      fetchWithTimeout(
        "https://api.binance.us/api/v3/ticker/24hr?symbol=BTCUSDT"
      ),
      // Free forex rate API — failure is non-fatal, we'll use a fallback rate
      fetchWithTimeout(
        "https://api.frankfurter.app/latest?from=USD&to=EUR"
      ).catch(() => null),
      // CoinGecko only for BTC dominance and market cap — failure is non-fatal
      fetchWithTimeout("https://api.coingecko.com/api/v3/global").catch(() => null),
    ]);

    if (!dailyKlinesRes.ok || !tickerRes.ok) {
      const errors = [];
      if (!dailyKlinesRes.ok) errors.push(`klines: ${dailyKlinesRes.status} ${await dailyKlinesRes.text().catch(() => "")}`);
      if (!tickerRes.ok) errors.push(`ticker: ${tickerRes.status} ${await tickerRes.text().catch(() => "")}`);
      throw new Error(`Binance API error: ${errors.join("; ")}`);
    }

    const dailyKlines: unknown[][] = await dailyKlinesRes.json();
    const tickerData = await tickerRes.json();

    // Parse Binance data
    const priceUsd = parseFloat(tickerData.lastPrice);

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
    const change24h = parseFloat(tickerData.priceChangePercent) || 0;
    const volume24h = parseFloat(tickerData.quoteVolume) || 0; // Quote volume is already in USD

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
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
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
