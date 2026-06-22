export default function PrivacyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--muted)", fontFamily: "Cairo, sans-serif", direction: "rtl", padding: "60px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8 }}>سياسة الخصوصية</h1>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 48 }}>آخر تحديث: يونيو 2025</p>

        {[
          {
            title: "المعلومات التي نجمعها",
            body: "نجمع المعلومات التي تقدمها عند التسجيل (الاسم، البريد الإلكتروني، رقم الهاتف)، وبيانات الطلبات والمشتريات، وعند استخدام خدمة الإعلانات الرقمية نطلب صلاحيات إدارة إعلانات صفحات فيسبوك الخاصة بك فقط.",
          },
          {
            title: "كيف نستخدم المعلومات",
            body: "نستخدم بياناتك لمعالجة الطلبات وتقديم خدمة الإعلانات الرقمية وإدارة الحملات الإعلانية على Meta نيابةً عنك. لا نبيع بياناتك الشخصية لأي طرف ثالث.",
          },
          {
            title: "خدمة الإعلانات ومنصة Meta",
            body: "عند ربط صفحتك عبر Meta OAuth، نحصل على رمز وصول (Access Token) يُستخدم حصراً لإنشاء وإدارة الحملات الإعلانية التي تطلبها. يمكنك إلغاء هذه الصلاحيات في أي وقت من إعدادات فيسبوك.",
          },
          {
            title: "حفظ البيانات وحمايتها",
            body: "نحفظ بياناتك بشكل آمن على خوادم Supabase. رموز الوصول الخاصة بصفحاتك مشفرة ولا يمكن الوصول إليها إلا من خلال النظام المصرّح.",
          },
          {
            title: "حقوقك",
            body: "يحق لك طلب حذف بياناتك أو تصحيحها في أي وقت. للتواصل معنا أرسل رسالة عبر واتساب أو راسلنا على البريد الإلكتروني الرسمي للمتجر.",
          },
          {
            title: "التواصل",
            body: "لأي استفسار بشأن سياسة الخصوصية، تواصل معنا عبر الموقع أو صفحة ترند ستور على فيسبوك.",
          },
        ].map((s) => (
          <div key={s.title} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{s.title}</h2>
            <p style={{ lineHeight: 1.9, fontSize: 15, color: "#94a3b8" }}>{s.body}</p>
          </div>
        ))}

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 32, marginTop: 16, textAlign: "center", color: "#475569", fontSize: 13 }}>
          © 2025 ترند للإلكترونيات — جميع الحقوق محفوظة
        </div>
      </div>
    </div>
  );
}
