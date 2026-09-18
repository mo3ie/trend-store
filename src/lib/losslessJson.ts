/**
 * Lossless JSON parsing for TikTok identifiers.
 *
 * WHY THIS EXISTS
 * TikTok webhook payloads type ids as JSON NUMBERS, and those ids are 19 digits:
 *
 *   JSON.parse('{"comment_id":6990565363377392901}').comment_id
 *     -> 6990565363377393000          // precision already destroyed
 *
 * Number.MAX_SAFE_INTEGER is 9007199254740991, so `String(parsed.comment_id)` cannot
 * recover the original: the damage happens inside JSON.parse, before String() runs.
 * A corrupted comment_id would break reply targeting AND deduplication.
 *
 * STRATEGY (two paths, same result, both tested)
 *  1. Native: `JSON.parse` reviver source access (V8 "json-parse-with-source", Node >= 22).
 *     The reviver's third argument carries `context.source`, the EXACT original text of the
 *     value, so the id is captured before any float conversion.
 *  2. Fallback for older runtimes: quote the allow-listed id fields in the raw text before
 *     parsing, so they arrive as strings. Escaped quotes (i.e. text inside a JSON string)
 *     are skipped, so a comment whose body contains `"comment_id":123` cannot be rewritten.
 *
 * SCOPE: this module is used ONLY for TikTok webhook payloads. JSON.parse is not replaced
 * anywhere else in the project.
 *
 * This file intentionally has NO imports, so tests can load it directly.
 */

/** Fields whose values must survive as exact text. */
export const TIKTOK_ID_FIELDS = [
  "comment_id",
  "video_id",
  "parent_comment_id",
  "item_id",
] as const;

type Reviver = (this: unknown, key: string, value: unknown, context?: { source?: string }) => unknown;

let nativeSupport: boolean | null = null;

/** True when this runtime gives the reviver the original source text. */
export function losslessJsonSupported(): boolean {
  if (nativeSupport !== null) return nativeSupport;
  try {
    let seen = false;
    const reviver: Reviver = (_k, v, ctx) => {
      if (ctx && typeof ctx.source === "string") seen = true;
      return v;
    };
    JSON.parse('{"probe":1}', reviver as (key: string, value: unknown) => unknown);
    nativeSupport = seen;
  } catch {
    nativeSupport = false;
  }
  return nativeSupport;
}

/** An integer literal only — never a float or exponent, which must not become a string. */
function isIntegerLiteral(source: string): boolean {
  return /^-?\d+$/.test(source);
}

/**
 * Pre-quotes allow-listed id fields in raw JSON text.
 *
 * The `(?<!\\)` guard means an escaped quote — which is how a quote appears INSIDE a JSON
 * string — never starts a match, so ids mentioned in a comment's text are left alone.
 */
export function quoteIdFields(raw: string, fields: readonly string[] = TIKTOK_ID_FIELDS): string {
  if (!fields.length) return raw;
  const names = fields.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`(?<!\\\\)"(${names})"(\\s*:\\s*)(-?\\d+)(?=\\s*[,}\\]])`, "g");
  return raw.replace(pattern, (_m, name: string, sep: string, digits: string) => `"${name}"${sep}"${digits}"`);
}

/**
 * Parses JSON, returning the allow-listed id fields as exact strings.
 * Throws SyntaxError on malformed input, exactly like JSON.parse.
 */
export function parseJsonLossless<T = unknown>(
  raw: string,
  fields: readonly string[] = TIKTOK_ID_FIELDS,
  opts: { forceFallback?: boolean } = {},
): T {
  const useNative = !opts.forceFallback && losslessJsonSupported();

  if (useNative) {
    const reviver: Reviver = (key, value, context) => {
      if (
        fields.includes(key) &&
        typeof value === "number" &&
        context &&
        typeof context.source === "string" &&
        isIntegerLiteral(context.source)
      ) {
        return context.source;
      }
      return value;
    };
    return JSON.parse(raw, reviver as (key: string, value: unknown) => unknown) as T;
  }

  return JSON.parse(quoteIdFields(raw, fields)) as T;
}

/**
 * Normalizes an id that may arrive as string or number into exact text.
 * A number here means it already passed through a lossy parse, so it is reported as such
 * rather than silently trusted.
 */
export function idToString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      // Precision is already gone; the caller must fix its parsing, not paper over it.
      throw new Error("unsafe_integer_id: id exceeded Number.MAX_SAFE_INTEGER before normalization");
    }
    return String(value);
  }
  return String(value);
}
