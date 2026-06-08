// Payment abstraction layer — add new providers without changing campaign logic

export interface PaymentSession {
  sessionId:    string;
  paymentLink?: string; // redirect URL for gateway
  inline?:      boolean; // true = inline OTP (e.g. Edfali direct)
}

export interface PaymentProvider {
  name: string;
  createSession(params: {
    amount:     number;
    campaignId: string;
    userId:     string;
    method?:    string;
    phone?:     string;
    callbackUrl: string;
    returnUrl:   string;
  }): Promise<PaymentSession>;
}

// Registry — import providers here and add to map
import { DPayProvider } from "./dpay";

const providers: Record<string, PaymentProvider> = {
  dpay:    new DPayProvider(),
  edfali:  new DPayProvider(), // DPay handles Edfali internally
  moamalat: new DPayProvider(),
  mobicash: new DPayProvider(),
  masrefypay: new DPayProvider(),
  yousrpay: new DPayProvider(),
};

export function getProvider(method: string): PaymentProvider {
  const key = ["edfali", "moamalat", "mobicash", "masrefypay", "yousrpay", "saharpay"].includes(method)
    ? "dpay"
    : method;
  const p = providers[key];
  if (!p) throw new Error(`Payment provider not found: ${method}`);
  return p;
}
