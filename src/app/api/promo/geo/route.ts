import { NextResponse } from "next/server";
import { searchCities } from "@/services/meta";

// GET — search Libyan cities for ad targeting (?q=...)
// Returns Meta geo "keys" required by the targeting spec (names alone are rejected).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ cities: [] });

  try {
    const cities = await searchCities(q);
    return NextResponse.json({ cities });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Meta API error";
    return NextResponse.json({ error: msg, cities: [] }, { status: 500 });
  }
}
