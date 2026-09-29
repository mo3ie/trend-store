/**
 * Perceptual image fingerprints (dHash) for matching a commenter's attachment to a
 * product photo.
 *
 * Someone asking "how much is this one?" almost always re-posts the shop's own
 * photo — saved, re-compressed and resized by Facebook along the way. A byte
 * comparison fails on that; a perceptual hash does not, because it encodes the
 * picture's gradient structure rather than its pixels.
 *
 * dHash: shrink to 9x8 greyscale, then emit one bit per adjacent pixel pair
 * ("is the left brighter than the right?") — 64 bits, as 16 hex characters.
 * Two images are the same picture when their bits differ in only a few places.
 */

/** Hamming distance below which two fingerprints are treated as the same photo. */
export const HASH_MATCH_THRESHOLD = 10;

// sharp ships with Next for image optimisation. It is imported lazily so a missing
// binary degrades image matching to a clean error instead of crashing the route.
async function loadSharp() {
  const mod = await import("sharp").catch(() => null);
  return (mod as { default?: unknown } | null)?.default ?? mod ?? null;
}

type SharpLike = (buf: Buffer) => {
  greyscale: () => { resize: (w: number, h: number, o: unknown) => { raw: () => { toBuffer: () => Promise<Buffer> } } };
};

/** 64-bit dHash of an image buffer, as 16 hex characters. Null if undecodable. */
export async function hashImageBuffer(buf: Buffer): Promise<string | null> {
  const sharp = (await loadSharp()) as SharpLike | null;
  if (!sharp) return null;
  try {
    const px = await sharp(buf)
      .greyscale()
      .resize(9, 8, { fit: "fill" })
      .raw()
      .toBuffer();

    let bits = "";
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = px[row * 9 + col];
        const right = px[row * 9 + col + 1];
        bits += left > right ? "1" : "0";
      }
    }
    let hex = "";
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return null;
  }
}

/** Fetch an image by URL and fingerprint it. */
export async function hashImageUrl(url: string): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!r.ok) return null;
    const len = Number(r.headers.get("content-length") || 0);
    if (len > 12 * 1024 * 1024) return null;      // don't pull a huge file to hash it
    return await hashImageBuffer(Buffer.from(await r.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Number of differing bits between two hex fingerprints; 64 when incomparable. */
export function hammingDistance(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

/** The closest fingerprint in `pool`, or null when nothing is close enough. */
export function closestHash(target: string, pool: string[]): { hash: string; distance: number } | null {
  let best: { hash: string; distance: number } | null = null;
  for (const h of pool) {
    const d = hammingDistance(target, h);
    if (!best || d < best.distance) best = { hash: h, distance: d };
  }
  return best && best.distance <= HASH_MATCH_THRESHOLD ? best : null;
}
