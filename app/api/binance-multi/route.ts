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

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function parseKlines(klinesData: unknown[][]): Candle[] {
  return klinesData.map((k) => ({
    time: Number(k[0]),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));
}

function calculateRSI(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50; // Not enough data, return neutral

  const closes = candles.map((c) => c.close);
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  // Use the last `period` changes for initial average
  const recentChanges = changes.slice(-period);
  let avgGain = 0;
  let avgLoss = 0;

  for (const change of recentChanges) {
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

async function tryKlines(
  baseUrl: string,
  interval: string,
  limit: number
): Promise<unknown[][] | null> {
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`
    );

    if (!res.ok) {
      console.warn(`${baseUrl} returned status ${res.status} for ${interval} klines`);
      return null;
    }

    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`${baseUrl}: ${interval} klines response was not a valid array`);
      return null;
    }

    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`${baseUrl} ${interval} klines failed: ${msg}`);
    return null;
  }
}

async function fetchKlinesWithFallback(
  interval: string,
  limit: number
): Promise<unknown[][] | null> {
  return (
    (await tryKlines("https://api.binance.us", interval, limit)) ??
    (await tryKlines("https://api.binance.com", interval, limit))
  );
}

function safeChange(candles: Candle[], currentIdx: number, pastOffset: number): number {
  const current = candles[currentIdx];
  const past = candles[currentIdx - pastOffset];
  if (!current || !past || past.close === 0) return 0;
  return ((current.close - past.close) / past.close) * 100;
}

export async function GET() {
  try {
    // Fetch both timeframes in parallel
    const [raw15m, raw4h] = await Promise.all([
      fetchKlinesWithFallback("15m", 96),
      fetchKlinesWithFallback("4h", 42),
    ]);

    if (!raw15m || !raw4h) {
      throw new Error("Failed to fetch multi-timeframe candle data from all endpoints");
    }

    const candles15m = parseKlines(raw15m);
    const candles4h = parseKlines(raw4h);

    const currentPrice = candles15m[candles15m.length - 1]?.close ?? 0;

    const lastIdx15m = candles15m.length - 1;
    const lastIdx4h = candles4h.length - 1;

    // change_15m: last vs second-to-last 15m candle
    const change15m = safeChange(candles15m, lastIdx15m, 1);

    // change_1h_from_15m: last vs 4-candles-ago 15m (4 * 15m = 1h)
    const change1hFrom15m = safeChange(candles15m, lastIdx15m, 4);

    // change_4h: last vs second-to-last 4h candle
    const change4h = safeChange(candles4h, lastIdx4h, 1);

    // change_12h: last vs 3-candles-ago 4h (3 * 4h = 12h)
    const change12h = safeChange(candles4h, lastIdx4h, 3);

    // Calculate RSI for each timeframe
    const rsi15m = calculateRSI(candles15m);
    const rsi4h = calculateRSI(candles4h);

    return NextResponse.json(
      {
        candles_15m: candles15m,
        candles_4h: candles4h,
        current_price: currentPrice,
        change_15m: Math.round(change15m * 100) / 100,
        change_1h_from_15m: Math.round(change1hFrom15m * 100) / 100,
        change_4h: Math.round(change4h * 100) / 100,
        change_12h: Math.round(change12h * 100) / 100,
        rsi_15m: Math.round(rsi15m * 100) / 100,
        rsi_4h: Math.round(rsi4h * 100) / 100,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Binance multi-timeframe API error:", message);
    return NextResponse.json(
      { error: "Failed to fetch multi-timeframe data", details: message },
      { status: 500 }
    );
  }
}
