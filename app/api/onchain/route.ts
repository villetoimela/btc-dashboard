import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HALVING_INTERVAL = 210000;
// Last halving was block 840000 (April 2024)
const LAST_HALVING_BLOCK = 840000;
const NEXT_HALVING_BLOCK = LAST_HALVING_BLOCK + HALVING_INTERVAL; // 1050000

async function fetchJSON(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchText(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [
      mempoolBlock,
      mempoolFees,
      mempoolMempool,
      hashrateData,
    ] = await Promise.all([
      fetchText("https://mempool.space/api/blocks/tip/height"),
      fetchJSON("https://mempool.space/api/v1/fees/recommended"),
      fetchJSON("https://mempool.space/api/mempool"),
      fetchJSON("https://mempool.space/api/v1/mining/hashrate/1m"),
    ]);

    const currentBlock = mempoolBlock ? parseInt(mempoolBlock) : 0;
    const blocksUntilHalving = NEXT_HALVING_BLOCK - currentBlock;
    const minutesUntilHalving = blocksUntilHalving * 10; // ~10 min per block
    const halvingDate = new Date(
      Date.now() + minutesUntilHalving * 60 * 1000
    ).toISOString();

    // Hashrate from mempool.space
    let hashrate = 0;
    let hashrateChange30d = 0;
    if (hashrateData?.hashrates?.length > 0) {
      const rates = hashrateData.hashrates;
      const latestHR = rates[rates.length - 1]?.avgHashrate || 0;
      hashrate = latestHR / 1e18; // Convert to EH/s
      if (rates.length > 1) {
        const olderHR = rates[0]?.avgHashrate || latestHR;
        hashrateChange30d = olderHR > 0 ? ((latestHR - olderHR) / olderHR) * 100 : 0;
      }
    }

    // Mempool data
    const mempoolSize = mempoolMempool?.vsize || 0;
    const mempoolTxCount = mempoolMempool?.count || 0;

    // Fees
    const avgFee = mempoolFees?.halfHourFee || 0;

    // Active addresses - rough estimate based on mempool tx count
    const activeAddresses = mempoolTxCount * 2.5;

    return NextResponse.json({
      hashrate,
      hashrate_change_30d: hashrateChange30d,
      active_addresses: Math.round(activeAddresses),
      active_addresses_change: null,
      mempool_size: mempoolSize,
      mempool_tx_count: mempoolTxCount,
      avg_fee_sat_vb: avgFee,
      halving_block: NEXT_HALVING_BLOCK,
      current_block: currentBlock,
      blocks_until_halving: blocksUntilHalving,
      estimated_halving_date: halvingDate,
    }, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
    });
  } catch (error) {
    console.error("Onchain API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch onchain data" },
      { status: 500 }
    );
  }
}
