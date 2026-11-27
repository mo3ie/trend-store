"use client";

import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

// Privacy policy — covers EVERY service on the platform. When a feature that touches personal
// data is added or changed, add/update its section here (and in /terms) and bump the date.
const SECTIONS: { title: [string, string]; body: [string, string] }[] = [
  {
    title: ["من نحن ونطاق هذه السياسة", "Who we are & scope"],
    body: [
      "محل ترند للإلكترونيات (بنغازي، ليبيا) يدير موقع trendstore-ly.com وتطبيقه القابل للتثبيت، وكل خدماته: المتجر، المحفظة، الكروت الرقمية، شحن الكهرباء، الشحن المباشر، سوق المستعمل بضمان، فحص الأجهزة والصيانة، هدية اليوم والألعاب، المساعد الذكي «ترندي»، وخدمات أصحاب الصفحات (الإعلانات، بوت الرد الآلي، الموظف الذكي). تشرح هذه السياسة ما نجمعه في كل خدمة، ولماذا، ومع من نشاركه.",
      "Trend Electronics (Benghazi, Libya) operates trendstore-ly.com, its installable app and all of its services: the store, wallet, digital cards, electricity top-up, direct recharge, the escrow used-device market, device diagnosis and repair, the daily gift and games, the «Trendy» AI assistant, and the page-owner services (ads, auto-reply bot, AI Employee). This policy explains what we collect in each service, why, and who we share it with.",
    ],
  },
  {
    title: ["المعلومات التي نجمعها", "Information we collect"],
    body: [
      "• بيانات الحساب: الاسم، البريد الإلكتروني (أو حساب جوجل عند الدخول به)، رقم الهاتف، والعنوان.\n• الطلبات والصيانة: المنتجات، العنوان، الهاتف، الملاحظات وحالة الطلب، وطلبات الصيانة وحالتها.\n• المحفظة والمدفوعات: عمليات الشحن والخصم والتحويل ومرجع العملية لدى بوابة الدفع. لا نحفظ أرقام بطاقاتك المصرفية ولا رموز التحقق — تُدخلها لدى البوابة نفسها.\n• الكروت والكهرباء والشحن المباشر: المنتج والمبلغ، رقم العداد، بيانات المستلم التي تكتبها (رقم حساب أو هاتف أو محفظة)، والأكواد والإيصالات ورموز الشحن التي تصلك.\n• سوق المستعمل: إعلاناتك وصورها ووصف الجهاز، والطلبات والنزاعات.\n• فحص الأجهزة: نتائج الفحص من المتصفح وإجاباتك، وفي الفحص العميق ملخص بيانات التحليلات أو صور شاشات الإعدادات، ورقم IMEI إذا أدخلته.\n• هدية اليوم والألعاب: مشاركتك وإجاباتك ونتائجك، ومعرّف عشوائي للجهاز يُحفظ في متصفحك، وبصمة مشفّرة لعنوان الشبكة — لمنع الحسابات الوهمية فقط.\n• استخدام الموقع: الصفحات التي تفتحها ومدة بقائك فيها، ونص الأزرار والروابط التي تضغطها، ونوع جهازك والموقع الذي أتيت منه — مرتبطة بحسابك إن كنت مسجّلاً، وبمعرّف عشوائي في متصفحك إن لم تكن. لا نسجّل أبداً ما تكتبه في الخانات، وتُحذف بعد نحو ستة أشهر. نستخدمها لتحسين المتجر وخدمتك ولا نبيعها ولا نشاركها.\n• خدمات أصحاب الصفحات: صلاحيات الصفحات والحسابات التي تربطها بنفسك (التفاصيل في الأقسام التالية).",
      "• Account data: name, email (or your Google account if you sign in with it), phone number and address.\n• Orders & repairs: items, address, phone, notes and order status, plus repair requests and their status.\n• Wallet & payments: top-ups, debits, transfers and the gateway's transaction reference. We never store your bank card numbers or verification codes — you enter them on the gateway itself.\n• Cards, electricity & direct recharge: product and amount, meter number, the recipient details you type (account, phone or wallet number), and the codes, receipts and top-up tokens you receive.\n• Used-device market: your listings, photos and device description, orders and disputes.\n• Device diagnosis: browser test results and your answers; for the deep scan, a summary of the analytics data or the settings screenshots, and the IMEI if you enter it.\n• Daily gift & games: your entry, answers and scores, a random device identifier stored in your browser, and a hashed fingerprint of your network address — solely to stop fake accounts.\n• Page-owner services: the permissions for the pages and accounts you connect yourself (details below).",
    ],
  },
  {
    title: ["كيف نستخدم المعلومات", "How we use information"],
    body: [
      "نستخدم بياناتك فقط لتقديم الخدمة التي طلبتها: تنفيذ الطلبات والتوصيل والصيانة، تشغيل المحفظة وتنفيذ الشحن والكروت، حماية البائع والمشتري في السوق، إصدار تقارير الفحص، إجراء السحب والمسابقات بعدل ومنع الغش، إرسال الإشعارات الخاصة بطلباتك، وتقديم خدمات التسويق التي تشترك فيها. لا نبيع بياناتك الشخصية، ولا نستخدمها لأي غرض خارج الخدمة التي طلبتها.",
      "We use your data only to provide the service you asked for: fulfilling orders, delivery and repairs, running the wallet and executing top-ups and cards, protecting buyer and seller in the market, issuing diagnosis reports, running draws and contests fairly and preventing cheating, sending notifications about your orders, and providing the marketing services you subscribe to. We do not sell your personal data, and we do not use it for any purpose beyond the service you asked for.",
    ],
  },
  {
    title: ["ما يراه الآخرون", "What others can see"],
    body: [
      "• سوق المستعمل: يرى الطرف الآخر في الصفقة اسمك مختصراً ورقم هاتفك لإتمام التسليم فقط، ويرى الجميع الإعلان بعد مراجعته ونشره.\n• هدية اليوم: تُنشر قائمة المشاركات برموز مشفّرة لا تكشف هويتك، ويظهر اسم الفائز مختصراً، حتى يتحقق أي شخص من عدالة السحب.\n• الألعاب: يظهر اسمك مختصراً ونتيجتك في الترتيب الأسبوعي.\n• تقرير الفحص: يفتحه فقط من يملك رابطه، فشاركه مع من تريد فقط.",
      "• Used-device market: the other party in a deal sees your shortened name and phone number, only to complete the handover; approved listings are public.\n• Daily gift: the entry list is published as hashed tags that do not reveal your identity, and the winner's name is shown shortened, so anyone can verify the draw.\n• Games: your shortened name and score appear on the weekly leaderboard.\n• Diagnosis reports: only people who have the report link can open it, so share it only with whom you choose.",
    ],
  },
  {
    title: ["المساعد الذكي «ترندي» والذكاء الاصطناعي", "The «Trendy» assistant & AI"],
    body: [
      "رسائلك لـ«ترندي» تُرسل لمزوّد ذكاء اصطناعي مع قائمة منتجات المتجر لتوليد الرد، ولا نحفظ المحادثة على خوادمنا — تبقى في متصفحك حتى تغلقه. صوت ترندي يصدر من محرّك الصوت المدمج في جهازك. لا تكتب في المحادثة كلمات سر أو أرقام بطاقات. نستخدم أيضاً أدوات ذكاء اصطناعي لكتابة تقارير الفحص، وقراءة صور الإعدادات في الفحص العميق، وكتابة أوصاف المنتجات من مصادر منشورة على الإنترنت.",
      "Your messages to «Trendy» are sent to an AI provider, together with the store's product list, to generate the reply; we do not store the conversation on our servers — it stays in your browser until you close it. Trendy's voice comes from your device's built-in speech engine. Do not type passwords or card numbers in the chat. We also use AI tools to write diagnosis reports, read settings screenshots in the deep scan, and write product descriptions from sources published online.",
    ],
  },
  {
    title: ["الفحص العميق للأجهزة", "Deep device scan"],
    body: [
      "ملف «بيانات التحليلات» من الآيفون يُقرأ داخل متصفحك، ولا يصلنا منه إلا ملخص الفحص (البطارية والأعطال) وليس الملف كاملاً. صور شاشات الإعدادات تُرسل لمزوّد ذكاء اصطناعي لاستخراج القراءات منها فقط. رقم IMEI (إن أدخلته) يُرسل لمزوّد فحص الأجهزة لمعرفة حالة القفل والحظر والضمان. قصّ من الصور أي معلومة شخصية لا تخص الفحص قبل رفعها.",
      "The iPhone «Analytics Data» file is read inside your browser; we receive only the scan summary (battery and faults), never the whole file. Settings screenshots are sent to an AI provider only to extract the readings. The IMEI (if you enter it) is sent to a device-check provider to learn its lock, blacklist and warranty status. Crop out any personal information unrelated to the scan before uploading.",
    ],
  },
  {
    title: ["التخزين في جهازك والتطبيق", "On-device storage & the app"],
    body: [
      "نستخدم ملفات تعريف الارتباط الضرورية لتسجيل الدخول فقط، والتخزين المحلي في متصفحك للسلة واللغة والمظهر ومكان الروبوت ومعرّف الجهاز. التطبيق القابل للتثبيت يحفظ نسخاً من الصفحات العامة وصور المنتجات ليفتح أسرع، ولا يحفظ أبداً صفحات المحفظة والطلبات والحساب والدفع — تُطلب دائماً مباشرة من الإنترنت. لا نستخدم ملفات تتبّع إعلانية من جهات أخرى في المتجر.",
      "We use essential cookies for sign-in only, and your browser's local storage for the cart, language, theme, robot position and device identifier. The installable app keeps copies of public pages and product images so it opens faster, and never stores wallet, order, account or payment pages — those are always fetched live. We do not use third-party advertising trackers in the store.",
    ],
  },
  {
    title: ["خدمة الإعلانات ومنصة Meta", "Advertising service & Meta"],
    body: [
      "عند ربط صفحتك عبر Meta OAuth، نحصل على رمز وصول (Access Token) يُستخدم حصراً لإنشاء وإدارة الحملات الإعلانية التي تطلبها. يمكنك إلغاء هذه الصلاحيات في أي وقت من إعدادات فيسبوك.",
      "When you connect your page via Meta OAuth, we receive an access token used solely to create and manage the ad campaigns you request. You can revoke these permissions at any time from your Facebook settings.",
    ],
  },
  {
    title: ["بوت الرد الآلي (فيسبوك وتيك توك)", "Auto-reply bot (Facebook & TikTok)"],
    body: [
      "عند اشتراكك في خدمة بوت الرد الآلي، تمنحنا صلاحية قراءة التعليقات المنشورة على صفحاتك أو فيديوهاتك أنت فقط، والرد عليها نيابةً عنك. يكون الرد علنياً تحت التعليق، وقد يُرسَل أيضاً في محادثة خاصة حين تسمح المنصة بذلك — وذلك وفق قواعد كل منصة: على فيسبوك نرد على صاحب التعليق مباشرة، وعلى تيك توك لا تُرسَل رسالة خاصة إلا ضمن محادثة تسمح المنصة بفتحها. لا نقرأ رسائلك الخاصة ولا تعليقات حسابات لا تملكها، ولا نبدأ محادثة مع أي شخص لم يتفاعل مع حسابك. نحفظ نص التعليق ومعرّفه لغرض واحد: منع تكرار الرد وعرض سجل النشاط لك. يمكنك إيقاف البوت أو إلغاء الصلاحيات في أي وقت.",
      "When you subscribe to the auto-reply bot, you grant us permission to read comments posted on your own Pages or videos only, and to reply to them on your behalf. The reply is public, under the comment, and may also be sent in a private conversation where the platform allows it — subject to each platform's rules: on Facebook we reply to the commenter directly; on TikTok a private message is only sent within a conversation the platform permits opening. We do not read your private messages, nor comments on accounts you do not own, and we never start a conversation with someone who has not engaged with your account. We store the comment text and its ID for one purpose: preventing duplicate replies and showing you an activity log. You can turn the bot off or revoke permissions at any time.",
    ],
  },
  {
    title: ["تيك توك", "TikTok"],
    body: [
      "عند ربط حساب تيك توك التجاري الخاص بك، نستخدم صلاحيات تيك توك الرسمية لقراءة فيديوهاتك وتعليقاتها والرد عليها، وذلك حصراً على الحساب الذي ربطته بنفسك. الرد علني تحت التعليق. وإذا مُنحت صلاحية الرسائل التجارية (Business Messaging) وسمحت إعدادات المنصة، فقد نرد أيضاً داخل محادثة خاصة — ولا نبدأ محادثة مع مستخدم لم يبدأها هو أو لم تسمح المنصة بفتحها له. ننشر الفيديوهات نيابةً عنك فقط حين تطلب ذلك صراحةً من لوحة التحكم. لا نستخدم بياناتك لأي غرض آخر ولا نبيعها.",
      "When you connect your TikTok Business account, we use TikTok's official permissions to read your videos and their comments and to reply to them — exclusively on the account you connected yourself. The reply is public, under the comment. If Business Messaging permission is granted and the platform's settings allow it, we may also reply inside a private conversation — we never start a conversation with a user who has not started one, or where the platform does not permit opening one. We publish videos on your behalf only when you explicitly request it from the dashboard. We do not use your data for any other purpose and we do not sell it.",
    ],
  },
  {
    title: ["الموظف الذكي", "AI Employee"],
    body: [
      "عند استخدامك «الموظف الذكي» نحفظ هوية علامتك التجارية وكتالوج منتجاتك وخطط المحتوى التي يولّدها لك، ونرسل وصف المنشور لمزوّدي الذكاء الاصطناعي وتوليد الصور لإنتاج المحتوى. لا يُنشر شيء على صفحاتك إلا بطلبك.",
      "When you use the «AI Employee» we store your brand identity, product catalogue and the content plans it generates for you, and send post briefs to AI text and image providers to produce the content. Nothing is published to your pages unless you request it.",
    ],
  },
  {
    title: ["حفظ البيانات وحمايتها", "Data storage & protection"],
    body: [
      "تُحفظ بياناتك في قاعدة بيانات Supabase على خوادم داخل الاتحاد الأوروبي (أيرلندا). رموز الوصول الخاصة بحساباتك مشفّرة بمعيار AES-256-GCM، ولا تظهر في المتصفح إطلاقاً ولا تُسجَّل في أي سجل. مفاتيح الربط مع مزوّدي الدفع والكروت تبقى على الخادم فقط، وطلبات الكروت والشحن موقّعة رقمياً وتُتحقق ردودها قبل اعتمادها. كل الاتصالات عبر HTTPS حصراً، والوصول إلى بياناتك محصور بحسابك بعد تسجيل دخول موثّق. عند فك ربط أي حساب نُبطل الرمز لدى المنصة ونحذفه من قاعدة بياناتنا.",
      "Your data is stored in a Supabase database on servers within the European Union (Ireland). Your account access tokens are encrypted at rest with AES-256-GCM, never reach the browser, and are never written to any log. Keys for payment and card suppliers stay on the server only, and card and top-up requests are digitally signed with their answers verified before use. All traffic is HTTPS only, and access to your data is limited to your own authenticated account. When an account is disconnected we revoke the token with the platform and delete it from our database.",
    ],
  },
  {
    title: ["مزوّدو الخدمة (معالجو البيانات)", "Service providers (data processors)"],
    body: [
      "نستعين بمزوّدين محدودين، كلٌّ يستلم فقط ما يلزم لمهمته ولا يستخدمه لأغراضه:\n• Supabase لقاعدة البيانات والملفات، وVercel لتشغيل الموقع، وخادمنا الخاص لتمرير الطلبات لبعض بوابات الدفع والمزوّدين.\n• بوابات الدفع المحلية (معاملات، إدفع لي، موبي كاش، يُسر، مصرفي باي) لمعالجة الشحن والدفع.\n• شركة أنيس (Anis) لتنفيذ الكروت الرقمية وشحن الكهرباء والشحن المباشر — تستلم المنتج والمبلغ ورقم العداد أو بيانات المستلم فقط، دون اسمك أو بريدك.\n• مزوّدو الذكاء الاصطناعي (مثل Groq وGoogle Gemini وAnthropic) لتوليد الردود والتقارير والأوصاف — دون رموز الوصول أو بيانات الدفع.\n• Meta وTikTok عند ربط حساباتك بخدمات الإعلانات والبوت.\n• مزوّد فحص IMEI عند استخدامك له.\nلا نبيع بياناتك ولا نشاركها لأغراض إعلانية، ونفصح عنها للجهات الرسمية فقط إذا ألزمنا القانون بذلك.",
      "We rely on a limited set of providers, each receiving only what its task needs and none using it for its own purposes:\n• Supabase for the database and files, Vercel to run the site, and our own server to relay requests to some payment gateways and suppliers.\n• Local payment gateways (Moamalat, Edfali, MobiCash, Yusor, Masarafi Pay) to process top-ups and payments.\n• Anis, to fulfil digital cards, electricity top-ups and direct recharges — it receives only the product, the amount and the meter number or recipient details, never your name or email.\n• AI providers (such as Groq, Google Gemini and Anthropic) to generate replies, reports and descriptions — never access tokens or payment data.\n• Meta and TikTok when you connect your accounts to the ads and bot services.\n• An IMEI-check provider when you use it.\nWe do not sell your data or share it for advertising, and we disclose it to authorities only where the law requires us to.",
    ],
  },
  {
    title: ["مدة الاحتفاظ", "Retention"],
    body: [
      "نحتفظ ببيانات حسابك ما دام الحساب قائماً. سجلات المدفوعات والمحفظة والطلبات نحتفظ بها المدة اللازمة للمحاسبة وحل النزاعات والالتزامات القانونية حتى بعد حذف الحساب. بيانات منع الغش في السحب والألعاب تُستخدم لفترة محدودة. يُحفظ سجل ردود البوت لعرض النشاط لك ومنع تكرار الرد، ويمكنك طلب حذفه في أي وقت. عند حذف الحساب نحذف باقي البيانات أو نُجهّلها.",
      "We keep your account data while the account exists. Payment, wallet and order records are kept as long as needed for accounting, dispute resolution and legal obligations, even after the account is deleted. Anti-fraud data for draws and games is used for a limited period. The bot reply log is kept to show you your activity and prevent duplicate replies, and you can request its deletion at any time. When an account is deleted we delete or anonymise the rest.",
    ],
  },
  {
    title: ["القُصّر", "Minors"],
    body: [
      "الخدمات المالية (المحفظة والشراء والسوق والجوائز) مخصصة للبالغين. لا نجمع عن قصد بيانات أطفال دون 13 سنة، وإذا علمنا بذلك نحذفها.",
      "Financial services (wallet, purchases, the market and prizes) are intended for adults. We do not knowingly collect data from children under 13, and we delete it if we learn of it.",
    ],
  },
  {
    title: ["حقوقك", "Your rights"],
    body: [
      "يحق لك طلب نسخة من بياناتك أو تصحيحها أو حذفها في أي وقت، وتعدّل بيانات حسابك بنفسك من «حسابي». في خدمات الصفحات تحذف معظمها بنفسك فوراً: فك ربط أي حساب يُبطل رمز الوصول لدى المنصة ويحذفه من قاعدة بياناتنا، وإيقاف البوت يوقف كل معالجة. ولما تبقّى، راسلنا على trend@trendstore-ly.com ونستجيب خلال ثلاثين يوماً.",
      "You have the right to request a copy of your data, its correction, or its deletion at any time, and you can edit your account details yourself under «My account». For the page services, most of it you can delete yourself immediately: disconnecting an account revokes the access token with the platform and deletes it from our database, and turning the bot off stops all processing. For anything else, write to trend@trendstore-ly.com and we will respond within thirty days.",
    ],
  },
  {
    title: ["تعديل هذه السياسة", "Changes to this policy"],
    body: [
      "عند إضافة خدمة جديدة أو تغيير طريقة استخدام البيانات نحدّث هذه الصفحة وتاريخها أعلاه، ونُعلمك داخل الموقع إذا كان التغيير جوهرياً.",
      "When we add a new service or change how data is used we update this page and the date above, and notify you on the site if the change is material.",
    ],
  },
  {
    title: ["التواصل", "Contact"],
    body: [
      "لأي استفسار بشأن هذه السياسة أو حماية البيانات: trend@trendstore-ly.com — ترند للإلكترونيات، بنغازي، ليبيا.",
      "For any question about this policy or about data protection: trend@trendstore-ly.com — Trend Electronics, Benghazi, Libya.",
    ],
  },
];

export default function PrivacyPage() {
  const { t, rtl } = useLang();
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--muted)", fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", padding: "60px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8 }}>{t("سياسة الخصوصية", "Privacy Policy")}</h1>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 48 }}>{t("آخر تحديث: نوفمبر 2026", "Last updated: November 2026")}</p>
          </div>
          <LangToggle />
        </div>

        {SECTIONS.map((s) => (
          <div key={s.title[0]} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{t(s.title[0], s.title[1])}</h2>
            <p style={{ lineHeight: 1.9, fontSize: 15, color: "#94a3b8", whiteSpace: "pre-line" }}>{t(s.body[0], s.body[1])}</p>
          </div>
        ))}

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 32, marginTop: 16, textAlign: "center", color: "#475569", fontSize: 13 }}>
          {t("© 2026 ترند للإلكترونيات — جميع الحقوق محفوظة", "© 2026 Trend Electronics — All rights reserved")}
        </div>
      </div>
    </div>
  );
}
