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
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: 48 }}>{t("آخر تحديث: يونيو 2025", "Last updated: June 2025")}</p>
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
              "نستخدم بياناتك لمعالجة الطلبات وتقديم خدمة الإعلانات الرقمية وإدارة الحملات الإعلانية على Meta نيابةً عنك. لا نبيع بياناتك الشخصية لأي طرف ثالث.",
              "We use your data to process orders, provide the digital advertising service, and manage Meta ad campaigns on your behalf. We do not sell your personal data to any third party.",
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
              "عند اشتراكك في خدمة بوت الرد الآلي، تمنحنا صلاحية قراءة التعليقات المنشورة على صفحاتك أو فيديوهاتك أنت فقط، والرد عليها نيابةً عنك — علنياً أو برسالة خاصة (فيسبوك فقط). لا نقرأ رسائلك الخاصة ولا تعليقات حسابات لا تملكها. نحفظ نص التعليق ومعرّفه لغرض واحد: منع تكرار الرد وعرض سجل النشاط لك. يمكنك إيقاف البوت أو إلغاء الصلاحيات في أي وقت.",
              "When you subscribe to the auto-reply bot, you grant us permission to read comments posted on your own Pages or videos only, and to reply to them on your behalf — publicly or by private message (Facebook only). We do not read your private messages, nor comments on accounts you do not own. We store the comment text and its ID for one purpose: preventing duplicate replies and showing you an activity log. You can turn the bot off or revoke permissions at any time.",
            ],
          },
          {
            title: ["تيك توك", "TikTok"],
            body: [
              "عند ربط حساب تيك توك التجاري الخاص بك، نستخدم صلاحيات تيك توك الرسمية لقراءة فيديوهاتك وتعليقاتها والرد عليها علنياً فقط، وذلك حصراً على الحساب الذي ربطته بنفسك. لا نستخدم بياناتك لأي غرض آخر، ولا نشاركها مع أي طرف ثالث.",
              "When you connect your TikTok Business account, we use TikTok's official permissions to read your videos and their comments and to reply publicly — exclusively on the account you connected yourself. We do not use your data for any other purpose, and we do not share it with any third party.",
            ],
          },
          {
            title: ["حفظ البيانات وحمايتها", "Data storage & protection"],
            body: [
              "نحفظ بياناتك بشكل آمن على خوادم Supabase. رموز الوصول الخاصة بصفحاتك مشفرة ولا يمكن الوصول إليها إلا من خلال النظام المصرّح.",
              "We store your data securely on Supabase servers. Your page access tokens are encrypted and accessible only through the authorized system.",
            ],
          },
          {
            title: ["حقوقك", "Your rights"],
            body: [
              "يحق لك طلب حذف بياناتك أو تصحيحها في أي وقت. للتواصل معنا أرسل رسالة عبر واتساب أو راسلنا على البريد الإلكتروني الرسمي للمتجر.",
              "You have the right to request deletion or correction of your data at any time. To contact us, message us on WhatsApp or email the store's official address.",
            ],
          },
          {
            title: ["التواصل", "Contact"],
            body: [
              "لأي استفسار بشأن سياسة الخصوصية، تواصل معنا عبر الموقع أو صفحة ترند ستور على فيسبوك.",
              "For any questions about this privacy policy, contact us via the website or the Trend Store Facebook page.",
            ],
          },
        ].map((s) => (
          <div key={s.title[0]} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{t(s.title[0], s.title[1])}</h2>
            <p style={{ lineHeight: 1.9, fontSize: 15, color: "#94a3b8" }}>{t(s.body[0], s.body[1])}</p>
          </div>
        ))}

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 32, marginTop: 16, textAlign: "center", color: "#475569", fontSize: 13 }}>
          {t("© 2025 ترند للإلكترونيات — جميع الحقوق محفوظة", "© 2025 Trend Electronics — All rights reserved")}
        </div>
      </div>
    </div>
  );
}
