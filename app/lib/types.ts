export interface MarketData {
  price_usd: number;
  price_eur: number;
  change_24h: number;
  change_7d: number;
  change_30d: number;
  market_cap: number;
  volume_24h: number;
  btc_dominance: number;
  prices_history: [number, number][]; // [timestamp, price]
  volumes_history: [number, number][]; // [timestamp, volume]
}

export interface FearGreedData {
  value: number;
  value_classification: string;
  history: { value: number; timestamp: string }[];
}

export interface OnchainData {
  hashrate: number;
  hashrate_change_30d: number;
  active_addresses: number;
  active_addresses_change: number;
  mempool_size: number;
  mempool_tx_count: number;
  avg_fee_sat_vb: number;
  halving_block: number;
  current_block: number;
  blocks_until_halving: number;
  estimated_halving_date: string;
}

export interface IndicatorResult {
  name: string;
  value: number | string;
  signal: "bullish" | "neutral" | "bearish";
  score: number; // -1 to 1
  weight: number;
  description: string;
}

export type Recommendation = "OSTA" | "KERAA" | "ODOTA" | "VAROVAINEN" | "ALA_OSTA";

export type ShortTermRec = "OSTA_NYT" | "NOUSU" | "NEUTRAALI" | "LASKU" | "MYY";

export interface DashboardScore {
  total: number; // 0-100
  recommendation: Recommendation;
  indicators: IndicatorResult[];
}

export interface ShortTermScore {
  total: number; // 0-100
  recommendation: ShortTermRec;
  indicators: IndicatorResult[];
}

export interface BinanceCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BinanceData {
  candles: BinanceCandle[];
  current_price: number;
  change_1h: number;
  change_4h: number;
  change_24h: number;
  volume_24h: number;
}

export interface LongShortRatio {
  longPercent: number;
  shortPercent: number;
  ratio: number;
  history: { time: number; longPercent: number; shortPercent: number }[];
}

export interface WhaleData {
  topTraderPositionRatio: LongShortRatio;
  topTraderAccountRatio: LongShortRatio;
  globalAccountRatio: LongShortRatio;
}
