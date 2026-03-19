"use client";

import { useState } from "react";

const STORAGE_KEY = "btc-dash-event-log";
const MAX_EVENTS = 20;

export interface DashEvent {
  time: number;
  text: string;
}

export function getEventLog(): DashEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DashEvent[];
  } catch {
    return [];
  }
}

export function addEvent(text: string): DashEvent[] {
  const events = getEventLog();
  events.push({ time: Date.now(), text });
  const pruned = events.slice(-MAX_EVENTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
  return pruned;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function EventLog() {
  const [expanded, setExpanded] = useState(false);
  const events = getEventLog();

  if (events.length === 0) return null;

  const displayEvents = expanded ? events.slice().reverse() : events.slice(-3).reverse();

  return (
    <div className="panel">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-400">Event Log</h3>
        {events.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {expanded ? "Show less" : `Show all (${events.length})`}
          </button>
        )}
      </div>
      <div className="space-y-1">
        {displayEvents.map((ev, i) => (
          <div key={`${ev.time}-${i}`} className="flex items-start gap-2 text-xs">
            <span className="text-gray-600 font-mono whitespace-nowrap">{formatTime(ev.time)}</span>
            <span className="text-gray-400">{ev.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
