// DPay payment provider implementation
import type { PaymentProvider, PaymentSession } from "./index";

const DPAY_URL =
  process.env.DPAY_MODE === "Production"
    ? "https://dpay.ly/api/payment/sessions/open"
    : "https://dpay.ly/api/sandbox/payment/sessions/open";

export class DPayProvider implements PaymentProvider {
  name = "dpay";

  async createSession(params: {
    amount:      number;
    campaignId:  string;
    userId:      string;
    method?:     string;
    phone?:      string;
    callbackUrl: string;
    returnUrl:   string;
  }): Promise<PaymentSession> {
    const payload: Record<string, unknown> = {
      amount:       Math.round(params.amount),
      currency:     "LYD",
      order_id:     params.campaignId,
      pay_method:   params.method || "edfali",
      callback_url: params.callbackUrl,
      return_url:   params.returnUrl,
    };

    if (params.method === "moamalat") {
      payload.customer_phone = params.phone || "0910000000";
    }

    const res = await fetch(DPAY_URL, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${process.env.DPAY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.payment_link) {
      throw new Error(data?.message || "فشل إنشاء جلسة الدفع");
    }

    return {
      sessionId:   data.session_id,
      paymentLink: data.payment_link,
    };
  }
}
