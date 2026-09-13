import { NextResponse } from "next/server";
import { searchInterests } from "@/services/meta";

// GET — search Meta detailed-targeting interests (?q=...). Returns interest ids +
// names + audience size, for the create-campaign detailed targeting.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ interests: [] });

  try {
    const interests = await searchInterests(q);
    return NextResponse.json({ interests });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Meta API error";
    return NextResponse.json({ error: msg, interests: [] }, { status: 500 });
  }
}
