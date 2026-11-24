import { AnisPartnersClient, PemP256Signer, Money, type CatalogueCard, type RevealedCredential } from "@anis-ly/partners";

/**
 * Anis (developers.anis.ly) — digital cards supplier, through their official SDK
 * (@anis-ly/partners 2.3.0): every request is signed (ECDSA P-256, RFC 9421) and
 * every money/code answer is verified against Anis's published keys before use.
 *
 * Env (server only):
 *   ANIS_AUTHORITY     issued address from the enrolment email (https://…)
 *   ANIS_KEY_ID        credential UUID returned at enrolment
 *   ANIS_PRIVATE_KEY   base64 of the PKCS#8 PEM private key (never leaves the server)
 *   ANIS_WALLET_ID     the Anis wallet to buy from (optional: first wallet is used)
 *   ANIS_PROXY_URL     optional http(s)://user:pass@host:port — fixed-IP egress (Anis allow-lists source IPs;
 *                      Vercel has no fixed IP, so calls go through our server's static address)
 */
export const anisEnabled = () => !!(process.env.ANIS_AUTHORITY && process.env.ANIS_KEY_ID && process.env.ANIS_PRIVATE_KEY);

let clientP: Promise<AnisPartnersClient> | null = null;

async function proxiedFetch(): Promise<typeof globalThis.fetch | undefined> {
  const proxy = (process.env.ANIS_PROXY_URL || "").trim();
  if (!proxy) return undefined;
  const { fetch: ufetch, ProxyAgent } = await import("undici");
  const dispatcher = new ProxyAgent(proxy);
  return ((input: RequestInfo | URL, init?: RequestInit) =>
    ufetch(input as never, { ...(init as object), dispatcher } as never)) as unknown as typeof globalThis.fetch;
}

export function anis(): Promise<AnisPartnersClient> {
  if (!anisEnabled()) throw new Error("anis_not_configured");
  clientP ??= (async () => {
    const raw = process.env.ANIS_PRIVATE_KEY!.trim();
    const pem = raw.includes("BEGIN") ? raw.replace(/\\n/g, "\n") : Buffer.from(raw, "base64").toString("utf8");
    const signer = (await PemP256Signer.fromPem(pem)).forKey(process.env.ANIS_KEY_ID!.trim());
    return AnisPartnersClient.create({
      options: { authority: process.env.ANIS_AUTHORITY!.trim(), acceptLanguage: "ar", signatureLifetimeSeconds: 60, timeoutMs: 25000, name: "trend-store" },
      signer,
      fetch: await proxiedFetch(),
    });
  })().catch((e) => { clientP = null; throw e; });
  return clientP;
}

let walletCache: string | null = null;
export async function anisWallet(): Promise<string> {
  const env = (process.env.ANIS_WALLET_ID || "").trim();
  if (env) return env;
  if (walletCache) return walletCache;
  const c = await anis();
  for await (const w of c.wallets.list()) { walletCache = w.id; return w.id; }
  throw new Error("anis_no_wallet");
}

export async function anisBalance(): Promise<{ amount: number; currency: string } | null> {
  const c = await anis();
  const w = await c.wallets.get(await anisWallet());
  return { amount: Number(w.balance.amount), currency: w.balance.currency };
}

/** Walks the whole wallet-priced catalogue (categories → subcategories → cards). */
export async function anisCatalogue(): Promise<{ card: CatalogueCard; subName: string; subLogo?: string; type: string; disclaimer?: string }[]> {
  const c = await anis(), wid = await anisWallet();
  const out: { card: CatalogueCard; subName: string; subLogo?: string; type: string; disclaimer?: string }[] = [];
  for await (const cat of c.catalogue.listCategories(wid)) {
    for await (const sub of c.catalogue.listSubcategories(wid, cat.id)) {
      for await (const card of c.catalogue.listCards(wid, sub.id)) {
        out.push({ card, subName: sub.name?.ar || sub.name?.en || "", subLogo: sub.logo || cat.logo, type: sub.categoryType, disclaimer: sub.disclaimer?.ar || sub.disclaimer?.en });
      }
    }
  }
  return out;
}

export type AnisCode = { code: string; serial?: string; expiry?: string };
const toCodes = (cs: readonly RevealedCredential[]): AnisCode[] =>
  cs.map((c) => ({ code: String(c.voucher || ""), ...(c.serialNumber ? { serial: c.serialNumber } : {}), ...(c.expiryDate ? { expiry: c.expiryDate } : {}) }));

export type AnisOutcome =
  | { kind: "delivered"; codes: AnisCode[]; invoiceId?: string }
  | { kind: "pending"; reason: string }            // processing / unknown → resume later with the SAME id
  | { kind: "notPlaced"; code: string };           // final: nothing charged → safe to refund

/**
 * Create OR resume an order. `operationId` is our card_orders.id (persisted BEFORE sending) and the request
 * must be byte-identical on every resume, so it is rebuilt from the values stored on the order.
 */
export async function anisOrder(operationId: string, req: { cardId: string; qty: number; unitCost: string }, resume = false): Promise<AnisOutcome> {
  const c = await anis(), wid = await anisWallet();
  const unit = Money.of(Number(req.unitCost).toFixed(3), "LYD");
  const body = { cardId: req.cardId, quantity: req.qty, expectedUnitPrice: unit, expectedTotal: unit.multiply(req.qty), externalReference: `trend-${operationId.slice(0, 8)}` };
  let r;
  try {
    r = resume ? await c.orders.resume(wid, operationId, body) : await c.orders.create(wid, operationId, body);
  } catch (e) {
    // Anything thrown after the request may have left: outcome unknown, never refund blindly.
    return { kind: "pending", reason: (e as Error).name || "error" };
  }
  if (r.kind === "completed") {
    if (r.credentials.length && !r.codesWithheld) return { kind: "delivered", codes: toCodes(r.credentials), invoiceId: r.order.invoiceId };
    return revealInvoice(r.order.invoiceId);
  }
  if (r.kind === "replayed") return revealInvoice(r.order.invoiceId);
  if (r.kind === "notPlaced") return { kind: "notPlaced", code: r.refusal.rawCode || r.refusal.code };
  return { kind: "pending", reason: r.kind };
}

async function revealInvoice(invoiceId?: string): Promise<AnisOutcome> {
  if (!invoiceId) return { kind: "pending", reason: "no_invoice" };
  try {
    const c = await anis();
    const col = await c.ownedCards.revealInvoice(await anisWallet(), invoiceId);
    const codes = toCodes(col.items);
    return codes.length && codes.every((x) => x.code) ? { kind: "delivered", codes, invoiceId } : { kind: "pending", reason: "codes_withheld" };
  } catch (e) {
    return { kind: "pending", reason: (e as Error).name || "reveal_error" };
  }
}

/** Arabic text for a final refusal shown to the customer. */
export function anisRefusalAr(code: string): string {
  return ({
    price_changed: "تغيّر سعر الكرت عند المزوّد",
    insufficient_balance: "رصيد المزوّد غير كافٍ حالياً",
    quantity_unavailable: "الكمية غير متوفرة حالياً",
    card_unavailable: "الكرت غير متوفر حالياً",
    daily_limit_exceeded: "تم الوصول لحد الشراء اليومي",
    spending_limit_exceeded: "تم الوصول لحد الشراء اليومي",
    validation_failed: "بيانات غير صحيحة — تأكد من الرقم والمبلغ",
    amount_out_of_range: "المبلغ خارج الحدود المسموحة",
    meter_rejected: "رقم العداد غير مقبول — تأكد منه",
    package_unavailable: "الباقة غير متوفرة حالياً",
    direct_recharge_product_unavailable: "الخدمة غير متاحة حالياً",
  } as Record<string, string>)[code] || `رفض المزوّد (${code})`;
}
