"use client";

import type { OnchainData } from "../lib/types";

export default function CyclePanel({ onchain }: { onchain: OnchainData }) {
  const HALVING_INTERVAL_BLOCKS = 210000;
  const LAST_HALVING = onchain.halving_block - HALVING_INTERVAL_BLOCKS;
  const blocksSinceHalving = onchain.current_block - LAST_HALVING;
  const daysSinceHalving = Math.round(blocksSinceHalving / 144);
  const daysUntilHalving = Math.round(onchain.blocks_until_halving / 144);
  const cycleProgress = (blocksSinceHalving / HALVING_INTERVAL_BLOCKS) * 100;

  // Cycle position relative to ~4 year cycle
  return (
    <div className="panel">
      <h2 className="text-lg font-semibold mb-3">Cycle Analysis</h2>

      <div className="space-y-4">
        {/* Halving countdown */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">Next Halving</span>
            <span className="font-medium text-yellow-400">
              {daysUntilHalving > 0 ? `${daysUntilHalving}d` : "Completed"}
            </span>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Since Last Halving</span>
            <span className="font-medium">{daysSinceHalving}d</span>
          </div>
        </div>

        {/* Cycle progress bar */}
        <div>
          <div className="text-xs text-gray-500 mb-1">Cycle Position</div>
          <div className="w-full bg-[#242836] rounded-full h-4 overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(cycleProgress, 100)}%`,
                background: `linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)`,
              }}
            />
            {/* Phase markers */}
            <div className="absolute top-0 left-1/4 w-px h-full bg-gray-600 opacity-50" />
            <div className="absolute top-0 left-1/2 w-px h-full bg-gray-600 opacity-50" />
            <div className="absolute top-0 left-3/4 w-px h-full bg-gray-600 opacity-50" />
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 mt-1">
            <span>Halving</span>
            <span>Accumulation</span>
            <span>Bull Phase</span>
            <span>Peak</span>
          </div>
        </div>

        {/* Block info */}
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Current Block</span>
            <span className="font-mono">{onchain.current_block.toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between">
            <span>Next Halving Block</span>
            <span className="font-mono">{onchain.halving_block.toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between">
            <span>Blocks Remaining</span>
            <span className="font-mono">
              {onchain.blocks_until_halving.toLocaleString("en-US")}
            </span>
          </div>
        </div>

        {/* Historical comparison */}
        <div>
          <div className="text-xs text-gray-500 mb-2">
            Same point in previous cycles
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-gray-400 flex-1">2016-2020 cycle</span>
              <span className="text-gray-300">
                {daysSinceHalving <= 365
                  ? "Accumulation"
                  : daysSinceHalving <= 540
                    ? "Early rally"
                    : daysSinceHalving <= 730
                      ? "Bull run"
                      : "Bear market"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-gray-400 flex-1">2020-2024 cycle</span>
              <span className="text-gray-300">
                {daysSinceHalving <= 365
                  ? "Accumulation"
                  : daysSinceHalving <= 540
                    ? "Early rally"
                    : daysSinceHalving <= 730
                      ? "Bull run"
                      : "Bear market"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
