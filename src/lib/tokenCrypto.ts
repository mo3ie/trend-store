import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * Envelope encryption for third-party credentials at rest (AES-256-GCM).
 *
 * SERVER ONLY. The key comes from TOKEN_ENCRYPTION_KEY — never a NEXT_PUBLIC_* var,
 * so it is not inlined into the client bundle.
 *
 * Ciphertext format:  v1.<iv b64url>.<authTag b64url>.<ciphertext b64url>
 * The version prefix lets a future key rotation decrypt old values.
 *
 * Generate a key with:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

const VERSION = "v1";
const KEY_BYTES = 32;   // AES-256
const IV_BYTES = 12;    // GCM standard nonce

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("tokenCrypto is server-only and must never run in the browser");
  }
}

function loadKey(): Buffer | null {
  const raw = (process.env.TOKEN_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) return null;
  return key;
}

/** True when a usable 32-byte base64 key is configured. */
export function encryptionConfigured(): boolean {
  return loadKey() !== null;
}

/**
 * Encrypts a secret. Throws when no key is configured — callers must never silently
 * fall back to storing plaintext credentials.
 */
export function encryptSecret(plaintext: string): string {
  assertServer();
  const key = loadKey();
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY is missing or not a 32-byte base64 key — refusing to store a credential in plaintext");
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

/** Decrypts a value produced by encryptSecret. Returns null if it cannot be read. */
export function decryptSecret(value: string | null | undefined): string | null {
  assertServer();
  if (!value) return null;
  const key = loadKey();
  if (!key) return null;

  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const ct = Buffer.from(parts[3], "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  } catch {
    // Wrong key, tampered ciphertext, or a format we do not understand.
    return null;
  }
}

/** Random URL-safe token, used for OAuth state and cookie bindings (32 bytes min). */
export function randomToken(bytes = 32): string {
  return randomBytes(Math.max(bytes, 32)).toString("base64url");
}

/** sha256 hex — what we persist instead of the secret itself. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant-time compare of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Redacts anything secret-shaped before it reaches a log line.
 * Never log a raw token, refresh token, authorization code, client secret or state —
 * pass it through here if a value must appear at all.
 */
export function redact(value: string | null | undefined): string {
  if (!value) return "<empty>";
  return `<redacted:${value.length}>`;
}
