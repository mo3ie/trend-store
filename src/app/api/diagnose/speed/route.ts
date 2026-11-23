import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { rateLimited } from "@/lib/catalog";

// Incompressible payload for the speed test, generated once per instance.
let blob: Buffer | null = null;
const MAX = 3_000_000; // stays under the serverless response cap

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const n = Math.max(1, Math.min(MAX, Number(req.nextUrl.searchParams.get("bytes")) || 1));
  if (n > 1000 && rateLimited(`speed:${ip}`, 6, 60_000)) return new Response("slow down", { status: 429 });
  if (!blob) blob = randomBytes(MAX);
  return new Response(new Uint8Array(blob.subarray(0, n)), {
    headers: { "content-type": "application/octet-stream", "cache-control": "no-store", "content-encoding": "identity" },
  });
}
