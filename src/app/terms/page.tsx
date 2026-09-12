"use client";

import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

// Terms of Service — required by the Meta and TikTok app-review forms, which both
// demand a public ToS URL alongside the privacy policy.
export default function TermsPage() {
  const { t, rtl } = useLang();

  const sections: { title: [string, string]; body: [string, string] }[] = [
    {
      title: ["قبول الشروط", "Acceptance of terms"],
      body: [
        "باستخدامك موقع ترند ستور وخدماته (المتجر الإلكتروني، الإعلانات الرقمية، بوت الرد الآلي) فإنك توافق على هذه الشروط. إن لم توافق عليها، يرجى عدم استخدام الخدمة.",
        "By using the Trend Store website and its services (online store, digital advertising, auto-reply bot) you agree to these terms. If you do not agree, please do not use the service.",
      ],
    },
    {
      title: ["الحساب والمسؤولية", "Account & responsibility"],
      body: [
        "أنت مسؤول عن دقة بيانات حسابك وعن الحفاظ على سرية كلمة المرور. أنت مسؤول عن كل النشاط الذي يجري عبر حسابك.",
        "You are responsible for the accuracy of your account details and for keeping your password confidential. You are responsible for all activity that occurs under your account.",
      ],
    },
    {
      title: ["خدمة الإعلانات الرقمية", "Digital advertising service"],
      body: [
        "عند طلب حملة إعلانية، تفوّضنا بإنشائها وإدارتها على منصة Meta نيابةً عنك مقابل الميزانية والعمولة المتفق عليهما. أنت المسؤول الوحيد عن محتوى المنشور المموّل ومطابقته لسياسات المنصة. لا نضمن نتائج أو مبيعات محددة، ولا نتحمل مسؤولية رفض المنصة للإعلان أو تعليق حسابك بسبب مخالفة سياساتها.",
        "When you request a campaign, you authorize us to create and manage it on Meta on your behalf, for the agreed budget and commission. You are solely responsible for the content of the boosted post and its compliance with platform policies. We do not guarantee specific results or sales, and we are not liable if the platform rejects the ad or restricts your account for violating its policies.",
      ],
    },
    {
      title: ["بوت الرد الآلي", "Auto-reply bot"],
      body: [
        "البوت يرد تلقائياً على التعليقات المنشورة على صفحاتك أو فيديوهاتك أنت فقط، وفق القواعد التي تحددها بنفسك. أنت المسؤول عن نص الردود ودقتها (الأسعار، التوفّر، التفاصيل) وعن التزامها بسياسات فيسبوك وتيك توك والقوانين المعمول بها. نطبّق حدوداً زمنية على معدل الردود لحماية حسابك، لكننا لا نضمن عدم اتخاذ المنصة أي إجراء ضد حسابك، ولا نتحمل مسؤولية ذلك.",
        "The bot automatically replies to comments posted on your own Pages or videos only, according to the rules you define yourself. You are responsible for the reply content and its accuracy (prices, availability, details) and for its compliance with Facebook and TikTok policies and applicable law. We apply rate limits to protect your account, but we do not guarantee that the platform will take no action against your account, and we are not liable for such action.",
      ],
    },
    {
      title: ["الاشتراكات والدفع", "Subscriptions & payment"],
      body: [
        "بوت الرد الآلي خدمة باشتراك شهري لكل صفحة/حساب، يُخصم من رصيد محفظتك. الاشتراك لا يتجدد تلقائياً — يتوقف البوت عند انتهاء المدة ما لم تجدّد. المبالغ المدفوعة غير قابلة للاسترداد بعد تفعيل الخدمة، إلا في حال عطل من جانبنا يمنع تشغيلها.",
        "The auto-reply bot is a monthly subscription per page/account, debited from your wallet balance. Subscriptions do not auto-renew — the bot stops at the end of the period unless you renew. Payments are non-refundable once the service is active, except where a fault on our side prevents it from running.",
      ],
    },
    {
      title: ["الاستخدام المحظور", "Prohibited use"],
      body: [
        "يُمنع استخدام خدماتنا لإرسال رسائل مزعجة (سبام)، أو نشر محتوى مضلل أو مخالف للقانون، أو انتحال صفة الغير، أو الالتفاف على سياسات فيسبوك وتيك توك. نحتفظ بحق إيقاف أي حساب يخالف ذلك دون استرداد.",
        "You may not use our services to send spam, publish misleading or unlawful content, impersonate others, or circumvent Facebook and TikTok policies. We reserve the right to suspend any account in violation, without refund.",
      ],
    },
    {
      title: ["إلغاء الربط وحذف البيانات", "Disconnecting & data deletion"],
      body: [
        "يمكنك إلغاء ربط أي صفحة أو حساب وإيقاف البوت في أي وقت من داخل الموقع، كما يمكنك سحب الصلاحيات مباشرةً من إعدادات فيسبوك أو تيك توك. عند إلغاء الربط نتوقف عن الوصول إلى بياناتك، ويمكنك طلب حذفها نهائياً.",
        "You can disconnect any page or account and turn the bot off at any time from within the site, and you can revoke permissions directly from your Facebook or TikTok settings. Once disconnected we stop accessing your data, and you may request its permanent deletion.",
      ],
    },
    {
      title: ["حدود المسؤولية", "Limitation of liability"],
      body: [
        "تُقدَّم الخدمة \"كما هي\". لا نتحمل مسؤولية أي أضرار غير مباشرة أو خسارة أرباح ناتجة عن استخدام الخدمة، وتقتصر مسؤوليتنا في جميع الأحوال على المبلغ الذي دفعته مقابل الخدمة محل النزاع.",
        "The service is provided \"as is\". We are not liable for any indirect damages or loss of profits arising from use of the service, and our liability is in all cases limited to the amount you paid for the service in question.",
      ],
    },
    {
      title: ["تعديل الشروط", "Changes to these terms"],
      body: [
        "قد نحدّث هذه الشروط من وقت لآخر، ويسري التحديث فور نشره على هذه الصفحة. استمرارك في استخدام الخدمة يعني قبولك للنسخة المحدّثة.",
        "We may update these terms from time to time; updates take effect once published on this page. Continued use of the service means you accept the updated version.",
      ],
    },
    {
      title: ["التواصل", "Contact"],
      body: [
        "لأي استفسار بخصوص هذه الشروط، تواصل معنا عبر الموقع أو صفحة ترند ستور على فيسبوك.",
        "For any questions about these terms, contact us via the website or the Trend Store Facebook page.",
      ],
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--muted)", fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", padding: "60px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8 }}>{t("الشروط والأحكام", "Terms of Service")}</h1>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 48 }}>{t("آخر تحديث: يوليو 2026", "Last updated: July 2026")}</p>
          </div>
          <LangToggle />
        </div>

        {sections.map((s) => (
          <div key={s.title[0]} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{t(s.title[0], s.title[1])}</h2>
            <p style={{ lineHeight: 1.9, fontSize: 15, color: "#94a3b8" }}>{t(s.body[0], s.body[1])}</p>
          </div>
        ))}

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 32, marginTop: 16, textAlign: "center", color: "#475569", fontSize: 13 }}>
          {t("© 2026 ترند للإلكترونيات — جميع الحقوق محفوظة", "© 2026 Trend Electronics — All rights reserved")}
        </div>
      </div>
    </div>
  );
}
