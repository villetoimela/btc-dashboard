import { NextResponse } from "next/server";

export const revalidate = 3600; // 1h cache

export async function GET() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=31", {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error("Fear & Greed API error");
    }

    const data = await res.json();
    const entries = data.data || [];

    const current = entries[0] || { value: "50", value_classification: "Neutral" };
    const history = entries.map((e: { value: string; timestamp: string }) => ({
      value: parseInt(e.value),
      timestamp: e.timestamp,
    }));

    return NextResponse.json({
      value: parseInt(current.value),
      value_classification: current.value_classification,
      history: history.reverse(), // oldest first
    });
  } catch (error) {
    console.error("Fear & Greed API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch fear & greed data" },
      { status: 500 }
    );
  }
}
