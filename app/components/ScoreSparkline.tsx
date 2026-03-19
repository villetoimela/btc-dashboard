"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "btc-dash-score-history";
const MAX_ENTRIES = 168;

interface ScoreEntry {
  time: number;
  score: number;
}

function getHistory(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScoreEntry[];
  } catch {
    return [];
  }
}

function saveEntry(score: number): ScoreEntry[] {
  const history = getHistory();
  const now = Date.now();
  // Avoid duplicate entries within 30 seconds
  if (history.length > 0 && now - history[history.length - 1].time < 30000) {
    history[history.length - 1].score = score;
  } else {
    history.push({ time: now, score });
  }
  // Prune to max entries
  const pruned = history.slice(-MAX_ENTRIES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  return pruned;
}

function getScoreColor(score: number): string {
  if (score > 60) return "#22c55e";
  if (score >= 40) return "#eab308";
  return "#ef4444";
}

interface ScoreSparklineProps {
  score: number;
}

export function useScoreTrend(score: number): { arrow: string; color: string } | null {
  const history = getHistory();
  if (history.length < 2) return null;
  const oneHourAgo = Date.now() - 3600000;
  const older = history.filter((h) => h.time <= oneHourAgo);
  if (older.length === 0) return null;
  const oldScore = older[older.length - 1].score;
  if (score > oldScore) return { arrow: "\u2191", color: "#22c55e" };
  if (score < oldScore) return { arrow: "\u2193", color: "#ef4444" };
  return null;
}

export default function ScoreSparkline({ score }: ScoreSparklineProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const history = saveEntry(score);
    if (!svgRef.current || history.length < 2) return;

    const svg = svgRef.current;
    const width = 80;
    const height = 24;
    const padding = 2;

    const scores = history.map((h) => h.score);
    const min = Math.min(...scores, 0);
    const max = Math.max(...scores, 100);
    const range = max - min || 1;

    const points = scores.map((s, i) => {
      const x = padding + (i / (scores.length - 1)) * (width - padding * 2);
      const y = height - padding - ((s - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    });

    // Update polyline
    const polyline = svg.querySelector("polyline");
    if (polyline) {
      polyline.setAttribute("points", points.join(" "));
    }

    // Update last dot
    const circle = svg.querySelector("circle");
    if (circle && points.length > 0) {
      const lastPoint = points[points.length - 1].split(",");
      circle.setAttribute("cx", lastPoint[0]);
      circle.setAttribute("cy", lastPoint[1]);
      circle.setAttribute("fill", getScoreColor(score));
    }
  }, [score]);

  return (
    <svg
      ref={svgRef}
      width="80"
      height="24"
      viewBox="0 0 80 24"
      className="inline-block ml-2"
      style={{ verticalAlign: "middle" }}
    >
      <polyline
        points=""
        fill="none"
        stroke="#6b7280"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="0" cy="0" r="2.5" fill="#6b7280" />
    </svg>
  );
}
