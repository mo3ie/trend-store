"use client";

import { useLang } from "@/hooks/useLang";
import LangToggle from "@/components/LangToggle";

export default function PrivacyPage() {
  const { t, rtl } = useLang();
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--muted)", fontFamily: "Cairo, sans-serif", direction: rtl ? "rtl" : "ltr", padding: "60px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8 }}>{t("سياسة الخصوصية", "Privacy Policy")}</h1>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 48 }}>{t("آخر تحديث: أكتوبر 2026", "Last updated: October 2026")}</p>
          </div>
          <LangToggle />
        </div>

        {[
          {
            title: ["المعلومات التي نجمعها", "Information we collect"],
            body: [
              "نجمع المعلومات التي تقدمها عند التسجيل (الاسم، البريد الإلكتروني، رقم الهاتف)، وبيانات الطلبات والمشتريات، وعند استخدام خدمة الإعلانات الرقمية نطلب صلاحيات إدارة إعلانات صفحات فيسبوك الخاصة بك فقط.",
              "We collect the information you provide when registering (name, email, phone number), order and purchase data, and — when you use the digital advertising service — only the permissions needed to manage ads for your own Facebook pages.",
            ],
          },
          {
            title: ["كيف نستخدم المعلومات", "How we use information"],
            body: [
              "نستخدم بياناتك لمعالجة الطلبات وتقديم خدمات التسويق التي تشترك فيها — الإعلانات والرد الآلي والموظف الذكي — على المنصات التي تربطها بنفسك. لا نبيع بياناتك الشخصية، ولا نستخدمها لأي غرض خارج الخدمة التي طلبتها.",
              "We use your data to process orders and to provide the marketing services you subscribe to — ads, auto-reply and the AI Employee — on the platforms you connect yourself. We do not sell your personal data, and we do not use it for any purpose beyond the service you asked for.",
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
            title: ["حفظ البيانات وحمايتها", "Data storage & protection"],
            body: [
              "تُحفظ بياناتك في قاعدة بيانات Supabase على خوادم داخل الاتحاد الأوروبي (أيرلندا). رموز الوصول الخاصة بحساباتك مشفّرة في قاعدة البيانات بمعيار AES-256-GCM، ولا تظهر في المتصفح إطلاقاً ولا تُسجَّل في أي سجل. كل الاتصالات عبر HTTPS حصراً. الوصول إلى بياناتك محصور بحسابك بعد تسجيل دخول موثّق. عند فك ربط أي حساب نُبطل الرمز لدى المنصة ونحذفه من قاعدة بياناتنا. يُحفظ سجل الردود لعرض النشاط لك ومنع تكرار الرد، ويمكنك طلب حذفه في أي وقت.",
              "Your data is stored in a Supabase database on servers within the European Union (Ireland). Your account access tokens are encrypted at rest with AES-256-GCM, never reach the browser, and are never written to any log. All traffic is HTTPS only. Access to your data is limited to your own authenticated account. When an account is disconnected we revoke the token with the platform and delete it from our database. The reply log is kept to show you your activity and prevent duplicate replies, and you can request its deletion at any time.",
            ],
          },
          {
            title: ["مزوّدو الخدمة (معالجو البيانات)", "Service providers (data processors)"],
            body: [
              "لتشغيل الخدمة نستعين بمزوّدين محدودين، ولا يستخدم أيٌّ منهم بياناتك لأغراضه: Supabase لقاعدة البيانات والاستضافة (الاتحاد الأوروبي)، وVercel لتشغيل الموقع، وGroq لتوليد نص الردود الذكية عند تفعيلها، وبوّابات الدفع المحلية لمعالجة المدفوعات. نرسل إلى مزوّد الذكاء الاصطناعي نص التعليق وبيانات منتجاتك المعلنة فقط لتوليد الرد — ولا نرسل بياناتك الشخصية ولا رموز الوصول. نحن لا نبيع بياناتك ولا نشاركها لأغراض إعلانية.",
              "We rely on a limited set of providers to run the service, none of whom use your data for their own purposes: Supabase for the database and hosting (EU), Vercel for running the site, Groq for generating smart-reply text when you enable it, and local payment gateways for processing payments. We send the AI provider only the comment text and your published product details in order to generate a reply — never your personal data and never access tokens. We do not sell your data and we do not share it for advertising purposes.",
            ],
          },
          {
            title: ["حقوقك", "Your rights"],
            body: [
              "يحق لك طلب نسخة من بياناتك أو تصحيحها أو حذفها في أي وقت. تحذف وحدك معظمها فوراً: فك ربط أي حساب يُبطل رمز الوصول لدى المنصة ويحذفه من قاعدة بياناتنا، وإيقاف البوت يوقف كل معالجة. ولما تبقّى، راسلنا على trend@trendstore-ly.com ونستجيب خلال ثلاثين يوماً.",
              "You have the right to request a copy of your data, its correction, or its deletion at any time. Most of it you can delete yourself immediately: disconnecting an account revokes the access token with the platform and deletes it from our database, and turning the bot off stops all processing. For anything else, write to trend@trendstore-ly.com and we will respond within thirty days.",
            ],
          },
          {
            title: ["التواصل", "Contact"],
            body: [
              "لأي استفسار بشأن هذه السياسة أو حماية البيانات: trend@trendstore-ly.com — ترند للإلكترونيات، بنغازي، ليبيا.",
              "For any question about this policy or about data protection: trend@trendstore-ly.com — Trend Electronics, Benghazi, Libya.",
            ],
          },
        ].map((s) => (
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
