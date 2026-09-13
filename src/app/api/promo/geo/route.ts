import { NextResponse } from "next/server";
import { searchCities, searchRegions } from "@/services/meta";

// GET — search Libyan geo for ad targeting (?q=... &type=city|region)
// Returns Meta geo "keys" required by the targeting spec (names alone are rejected).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const type = searchParams.get("type") === "region" ? "region" : "city";
  if (q.length < 2) return NextResponse.json({ cities: [] });

  try {
    const cities = type === "region" ? await searchRegions(q) : await searchCities(q);
    return NextResponse.json({ cities, type });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Meta API error";
    return NextResponse.json({ error: msg, cities: [] }, { status: 500 });
  }
}
