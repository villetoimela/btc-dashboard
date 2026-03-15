"use client";

import type { OnchainData } from "../lib/types";

export default function OnchainPanel({ onchain }: { onchain: OnchainData }) {
  return (
    <div className="panel">
      <h2 className="text-lg font-semibold mb-3">On-chain data</h2>
      <div className="space-y-0">
        {/* Hashrate */}
        <div className="indicator-row">
          <div>
            <div className="text-sm font-medium">Hashrate</div>
            <div className="text-xs text-gray-500">Network computing power</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono">
              {onchain.hashrate.toFixed(1)} EH/s
            </div>
            <div className="text-xs">
              <span
                className={
                  onchain.hashrate_change_30d > 0
                    ? "text-green-400"
                    : "text-red-400"
                }
              >
                {onchain.hashrate_change_30d > 0 ? "+" : ""}
                {onchain.hashrate_change_30d.toFixed(1)}%
              </span>
              <span className="text-gray-600"> (30d)</span>
            </div>
          </div>
        </div>

        {/* Mempool */}
        <div className="indicator-row">
          <div>
            <div className="text-sm font-medium">Mempool</div>
            <div className="text-xs text-gray-500">Pending transactions</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono">
              {onchain.mempool_tx_count.toLocaleString("en-US")} tx
            </div>
            <div className="text-xs text-gray-500">
              {(onchain.mempool_size / 1e6).toFixed(1)} MB
            </div>
          </div>
        </div>

        {/* Fees */}
        <div className="indicator-row">
          <div>
            <div className="text-sm font-medium">Average Fee</div>
            <div className="text-xs text-gray-500">Recommended fee</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono">
              {onchain.avg_fee_sat_vb} sat/vB
            </div>
            <div className="text-xs text-gray-500">
              {onchain.avg_fee_sat_vb < 10
                ? "Low"
                : onchain.avg_fee_sat_vb < 30
                  ? "Normal"
                  : "High"}
            </div>
          </div>
        </div>

        {/* Active addresses estimate */}
        <div className="indicator-row">
          <div>
            <div className="text-sm font-medium">Active Addresses</div>
            <div className="text-xs text-gray-500">Estimate based on mempool</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono">
              ~{(onchain.active_addresses / 1000).toFixed(0)}k
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
