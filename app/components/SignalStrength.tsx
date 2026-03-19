"use client";

interface SignalStrengthProps {
  score: number;
  color: string;
}

/**
 * Shows 1-3 signal bars based on distance from nearest scoring threshold.
 * Thresholds for long-term: 25, 40, 55, 75
 * Thresholds for short-term: 30, 42, 58, 70
 * We use a generic approach: check distance from nearest of common thresholds.
 */
export default function SignalStrength({ score, color }: SignalStrengthProps) {
  const thresholds = [25, 30, 40, 42, 55, 58, 70, 75];
  const distances = thresholds.map((t) => Math.abs(score - t));
  const minDistance = Math.min(...distances);

  let bars = 1;
  if (minDistance >= 15) bars = 3;
  else if (minDistance >= 5) bars = 2;

  return (
    <div className="flex items-end gap-[2px] h-4" title={`Signal strength: ${bars}/3`}>
      {[1, 2, 3].map((level) => (
        <div
          key={level}
          className="rounded-sm transition-all duration-300"
          style={{
            width: 4,
            height: level === 1 ? 6 : level === 2 ? 10 : 14,
            backgroundColor: level <= bars ? color : "#3d4253",
          }}
        />
      ))}
    </div>
  );
}
