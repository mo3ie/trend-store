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
        "باستخدامك موقع ترند ستور (trendstore-ly.com) وتطبيقه وخدماته — المتجر، المحفظة، الكروت الرقمية، شحن الكهرباء، الشحن المباشر، سوق المستعمل بضمان، الفحص والصيانة، هدية اليوم والألعاب، المساعد الذكي، الإعلانات الرقمية، بوت الرد الآلي، والموظف الذكي — فإنك توافق على هذه الشروط وعلى سياسة الخصوصية. إن لم توافق عليها، يرجى عدم استخدام الخدمة.",
        "By using the Trend Store website (trendstore-ly.com), its app and its services — the store, wallet, digital cards, electricity top-up, direct recharge, the escrow used-device market, diagnosis and repair, the daily gift and games, the AI assistant, digital advertising, the auto-reply bot and the AI Employee — you agree to these terms and to the privacy policy. If you do not agree, please do not use the service.",
      ],
    },
    {
      title: ["الحساب والمسؤولية", "Account & responsibility"],
      body: [
        "أنت مسؤول عن دقة بيانات حسابك وعن الحفاظ على سرية كلمة المرور. أنت مسؤول عن كل النشاط الذي يجري عبر حسابك. حساب واحد لكل شخص؛ الحسابات المتعددة أو الوهمية تُوقف وتُلغى مشاركاتها وجوائزها.",
        "You are responsible for the accuracy of your account details and for keeping your password confidential. You are responsible for all activity that occurs under your account. One account per person; multiple or fake accounts are suspended and their entries and prizes cancelled.",
      ],
    },
    {
      title: ["المتجر والطلبات", "Store & orders"],
      body: [
        "الأسعار بالدينار الليبي كما تظهر عند تأكيد الطلب. يظهر المنتج «متوفر» ما دام في المخزون، وقد نتواصل معك لتعديل الطلب أو إلغائه إذا نفد المنتج قبل التجهيز، ويُعاد لك أي مبلغ مدفوع عنه. الضمان والاستبدال حسب المكتوب في صفحة المنتج أو فاتورة الشراء. الصور والعرض ثلاثي الأبعاد توضيحية وقد يختلف اللون أو الشكل قليلاً.",
        "Prices are in Libyan dinars as shown when the order is confirmed. A product shows «In stock» while it is available; if it runs out before preparation we may contact you to amend or cancel the order, and any amount paid for it is returned. Warranty and exchange are as stated on the product page or the purchase invoice. Photos and 3D views are illustrative and colour or shape may differ slightly.",
      ],
    },
    {
      title: ["المحفظة", "Wallet"],
      body: [
        "رصيد المحفظة يُشحن عبر بوابات الدفع المتاحة ويُستخدم داخل المنصة. أي عملية ما تمّت (كرت أو شحن أو سوق) يُعاد مبلغها للمحفظة. التحويل لمستخدم آخر نهائي بعد تأكيده، فتأكد من المستلم. في حال خطأ في الشحن أو الخصم تواصل معنا ونراجع العملية من سجلاتنا وسجلات البوابة.",
        "Wallet balance is topped up through the available payment gateways and used inside the platform. Any operation that does not complete (card, top-up or market) is refunded to the wallet. A transfer to another user is final once confirmed, so check the recipient. If a top-up or debit goes wrong, contact us and we will review it against our records and the gateway's.",
      ],
    },
    {
      title: ["الكروت الرقمية", "Digital cards"],
      body: [
        "الكرت يُدفع من المحفظة ويُسلَّم كوده في «كروتي». بعد تسليم الكود لا يمكن استرجاعه أو استبداله لأنه قابل للاستخدام فوراً، فاحفظه ولا تشاركه. إذا لم يُنفَّذ الطلب لدى المزوّد يُعاد المبلغ للمحفظة تلقائياً، وإذا كان الطلب قيد المعالجة نكمله ولا نُعيد المبلغ حتى تتأكد النتيجة النهائية.",
        "Cards are paid from the wallet and the code is delivered under «My cards». Once delivered, a code cannot be refunded or exchanged because it is usable immediately, so keep it safe and do not share it. If the supplier does not place the order, the amount is refunded to the wallet automatically; if it is still processing, we complete it and refund only once the final outcome is known.",
      ],
    },
    {
      title: ["شحن الكهرباء والشحن المباشر", "Electricity top-up & direct recharge"],
      body: [
        "أنت مسؤول عن صحة رقم العداد وبيانات المستلم التي تكتبها؛ الشحن لرقم خاطئ قد لا يمكن استرجاعه. السعر بالدينار يظهر قبل الدفع ويشمل رسوم الخدمة، وفي الشحن المباشر يُحسب حسب سعر الصرف لحظة الطلب. يُعاد المبلغ للمحفظة إذا رفضه المزوّد أو فشل الشحن وأُعيد المبلغ لنا، وجزئياً إذا نُفّذ جزء منه. إذا طلب المزوّد تصحيح بيانات المستلم تقدر تصحّحها من «شحناتي». قد يستغرق التنفيذ بعض الوقت حسب الجهة المستلمة.",
        "You are responsible for the meter number and recipient details you enter; a top-up to a wrong number may not be recoverable. The dinar price is shown before payment and includes the service fee; for direct recharge it uses the exchange rate at the time of the order. The amount is refunded to the wallet if the supplier rejects it or the top-up fails and is refunded to us, and partially if only part is executed. If the supplier asks for the recipient details to be corrected you can do so under «My top-ups». Execution may take some time depending on the receiving party.",
      ],
    },
    {
      title: ["سوق المستعمل بضمان", "Escrow used-device market"],
      body: [
        "الإعلانات تُراجع قبل النشر، ويُمنع بيع أجهزة مسروقة أو مقفلة بحساب (iCloud/Google) أو مخالفة للقانون. عند الشراء يُحجز ثمن الجهاز لدى ترند، ويسلّم البائع الجهاز، وللمشتري أيام حماية لفحصه وتأكيد الاستلام أو فتح نزاع. يُحوَّل للبائع الثمن ناقص عمولة المنصة المعلنة بعد التأكيد أو انتهاء أيام الحماية دون نزاع. في النزاع يحكم المحل بعد مراجعة الطرفين، وقراره نهائي داخل المنصة. البائع مسؤول عن صدق وصف الجهاز.",
        "Listings are reviewed before publishing; selling stolen devices, devices locked to an account (iCloud/Google) or anything unlawful is prohibited. On purchase the price is held by Trend, the seller hands over the device, and the buyer has protection days to inspect it and confirm receipt or open a dispute. The seller is paid the price minus the published platform commission after confirmation, or once the protection days pass without a dispute. In a dispute the shop decides after reviewing both sides, and its decision is final within the platform. The seller is responsible for an honest device description.",
      ],
    },
    {
      title: ["الفحص والصيانة", "Diagnosis & repair"],
      body: [
        "فحص المتصفح وتقارير الذكاء الاصطناعي تقديرية للمساعدة في القرار، وليست ضماناً لحالة الجهاز. الفحص العميق مدفوع، ولا يُستهلك كوده إلا إذا كانت البيانات المرفوعة كافية لإصدار شهادة. شروط الصيانة وضمانها حسب ما يُتفق عليه عند استلام الجهاز.",
        "Browser checks and AI reports are estimates to help your decision, not a guarantee of the device's condition. The deep scan is paid, and its code is consumed only if the uploaded data is enough to issue a certificate. Repair terms and warranty are as agreed when the device is received.",
      ],
    },
    {
      title: ["هدية اليوم والألعاب", "Daily gift & games"],
      body: [
        "المشاركة مجانية. هدية اليوم تتطلب حساباً مؤكداً ورقم هاتف ليبي ومشاركة واحدة يومياً لكل شخص وجهاز، والسحب عشوائي قابل للتحقق علناً. الألعاب محاولة واحدة يومياً، والجوائز الأسبوعية لأصحاب أعلى النتائج. نستبعد أي مشاركة أو فوز يثبت فيه الغش أو تعدد الحسابات ونعيد السحب. تُستلم الجائزة بكود الاستلام خلال المدة المعلنة، ولا تُستبدل نقداً إلا إذا أُعلن ذلك.",
        "Participation is free. The daily gift requires a confirmed account, a Libyan phone number and one entry per person and device per day, and the draw is random and publicly verifiable. Games allow one attempt per day, and weekly prizes go to the top scores. We exclude any entry or win involving cheating or multiple accounts and redraw. Prizes are collected with the claim code within the announced period and are not exchangeable for cash unless announced.",
      ],
    },
    {
      title: ["المساعد الذكي «ترندي»", "The «Trendy» assistant"],
      body: [
        "«ترندي» يعتمد على الذكاء الاصطناعي ويقترح فقط من منتجات المتجر، لكنه قد يخطئ. السعر والتوفر المعتمدان هما ما يظهر في صفحة المنتج وعند تأكيد الطلب.",
        "«Trendy» is AI-based and suggests only products from the store, but it can make mistakes. The binding price and availability are those shown on the product page and at order confirmation.",
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
        "البوت يرد تلقائياً على التعليقات المنشورة على صفحاتك أو فيديوهاتك أنت فقط، وفق القواعد التي تحددها بنفسك. الرد علني تحت التعليق، وقد يُرسَل أيضاً في محادثة خاصة حين تسمح المنصة بذلك. ولا نرسل رسالة إلى أي شخص لم يتفاعل مع حسابك: لا رسائل جماعية، ولا رسائل ترويجية غير مطلوبة، ولا مراسلة لمن لم يعلّق أو يراسلك. أنت المسؤول عن نص الردود ودقتها (الأسعار، التوفّر، التفاصيل) وعن التزامها بسياسات فيسبوك وتيك توك والقوانين المعمول بها. نطبّق حدوداً على معدل الردود وسقفاً لكل منشور لحماية حسابك، لكننا لا نضمن عدم اتخاذ المنصة أي إجراء ضد حسابك، ولا نتحمل مسؤولية ذلك.",
        "The bot automatically replies to comments posted on your own Pages or videos only, according to the rules you define yourself. The reply is public, under the comment, and may also be sent in a private conversation where the platform allows it. We never message anyone who has not engaged with your account: no bulk messages, no unsolicited promotional messages, and no messaging people who have neither commented nor written to you. You are responsible for the reply content and its accuracy (prices, availability, details) and for its compliance with Facebook and TikTok policies and applicable law. We apply rate limits and a per-post ceiling to protect your account, but we do not guarantee that the platform will take no action against your account, and we are not liable for such action.",
      ],
    },
    {
      title: ["الاشتراكات والدفع", "Subscriptions & payment"],
      body: [
        "بوت الرد الآلي والإعلانات والموظف الذكي خدمات باشتراك (شهري أو ربع سنوي أو سنوي) حسب الباقة وعدد الصفحات، يُخصم من رصيد محفظتك، وللحسابات الجديدة فترة تجربة مجانية. التجديد التلقائي اختياري ومُطفأ افتراضياً؛ إذا فعّلته يُخصم سعر الباقة من المحفظة عند انتهاء المدة، ويمكنك إيقافه في أي وقت. ونذكّرك قبل انتهاء الاشتراك. المبالغ المدفوعة غير قابلة للاسترداد بعد تفعيل الخدمة، إلا في حال عطل من جانبنا يمنع تشغيلها.",
        "The auto-reply bot, ads and AI Employee are subscription services (monthly, quarterly or yearly) by plan and number of pages, debited from your wallet balance, and new accounts get a free trial period. Auto-renew is optional and off by default; if you turn it on, the plan price is debited from the wallet when the term ends, and you can turn it off at any time. We remind you before a subscription expires. Payments are non-refundable once the service is active, except where a fault on our side prevents it from running.",
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
        "لأي استفسار بخصوص هذه الشروط: trend@trendstore-ly.com، أو عبر الموقع وصفحة ترند ستور على فيسبوك — ترند للإلكترونيات، بنغازي، ليبيا. تخضع هذه الشروط للقوانين المعمول بها في دولة ليبيا.",
        "For any questions about these terms: trend@trendstore-ly.com, or via the website and the Trend Store Facebook page — Trend Electronics, Benghazi, Libya. These terms are governed by the laws in force in Libya.",
      ],
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--muted)", fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", padding: "60px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8 }}>{t("الشروط والأحكام", "Terms of Service")}</h1>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 48 }}>{t("آخر تحديث: نوفمبر 2026", "Last updated: November 2026")}</p>
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
