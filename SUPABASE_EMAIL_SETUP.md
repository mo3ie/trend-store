# إعداد بريد Supabase الاحترافي (يخدم كل المشاريع — Supabase واحد مشترك)

## أولاً: لماذا لا يصل رابط استعادة كلمة المرور؟

`resetPasswordForEmail` يرسل رابطاً يعيد التوجيه إلى `…/reset-password`.
**Supabase يرفض إرسال بريد الاستعادة إذا لم يكن رابط التوجيه ضمن قائمة Redirect URLs المسموحة.**
لذلك يصل رمز الدخول (OTP) — لأنه لا يستخدم redirect — ولا يصل رابط الاستعادة.

### الحل (دقيقة واحدة)
لوحة Supabase → **Authentication → URL Configuration → Redirect URLs** → أضِف:

```
https://trendstore-ly.com/**
https://order.trendstore-ly.com/**
https://trendy.trendstore-ly.com/**
https://medsprint.trendstore-ly.com/**
http://localhost:3000/**
```

و **Site URL** = `https://trendstore-ly.com`

---

## ثانياً: القوالب الاحترافية

لوحة Supabase → **Authentication → Email Templates**. لكل قالب: غيّر **Subject** والصق **Message body (HTML)**.

> ملاحظة: Supabase له **مجموعة قوالب واحدة لكل المشاريع** (لأنها تشترك في نفس المشروع). القوالب أدناه بالعربية بعلامة "ترند". مشروع MedSprint (إنجليزي طبي) سيستلم نفس القوالب — إن أردت قوالب منفصلة لكل مشروع لاحقاً نرسل البريد عبر Resend API مباشرة بدل قوالب Supabase.

---

### 1) Magic Link  (رمز الدخول OTP)
**Subject:**
```
رمز الدخول إلى ترند
```
**Message body (HTML):**
```html
<div dir="rtl" style="margin:0;background:#0b0f1a;padding:24px;font-family:Tahoma,Arial,sans-serif">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#0f1320;border:1px solid #2a2150;border-radius:16px;overflow:hidden">
    <tr><td style="background:#7c3aed;padding:18px 24px;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:4px">TREND</span>
    </td></tr>
    <tr><td style="padding:28px 24px;color:#e5e7eb;text-align:center">
      <h2 style="margin:0 0 8px;color:#fff;font-size:18px">رمز الدخول الخاص بك</h2>
      <p style="margin:0 0 18px;color:#9ca3af;font-size:14px">أدخل هذا الرمز في صفحة الدخول لإكمال تسجيل دخولك.</p>
      <div style="display:inline-block;background:#000;border:1px solid #7c3aed;border-radius:12px;padding:14px 26px;color:#fff;font-size:30px;font-weight:800;letter-spacing:10px">{{ .Token }}</div>
      <p style="margin:18px 0 0;color:#6b7280;font-size:12px">صالح لمدة ساعة واحدة. إن لم تطلب هذا الرمز، تجاهل هذه الرسالة بأمان.</p>
    </td></tr>
    <tr><td style="background:#0b0f1a;padding:14px;text-align:center;color:#4b5563;font-size:11px">© ترند للإلكترونيات</td></tr>
  </table>
</div>
```

---

### 2) Reset Password  (استعادة كلمة المرور)
**Subject:**
```
إعادة تعيين كلمة المرور — ترند
```
**Message body (HTML):**
```html
<div dir="rtl" style="margin:0;background:#0b0f1a;padding:24px;font-family:Tahoma,Arial,sans-serif">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#0f1320;border:1px solid #2a2150;border-radius:16px;overflow:hidden">
    <tr><td style="background:#7c3aed;padding:18px 24px;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:4px">TREND</span>
    </td></tr>
    <tr><td style="padding:28px 24px;color:#e5e7eb;text-align:center">
      <h2 style="margin:0 0 8px;color:#fff;font-size:18px">طلب إعادة تعيين كلمة المرور</h2>
      <p style="margin:0 0 22px;color:#9ca3af;font-size:14px">اضغط الزر أدناه لتعيين كلمة مرور جديدة لحسابك.</p>
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 32px;border-radius:10px">تعيين كلمة مرور جديدة</a>
      <p style="margin:22px 0 0;color:#6b7280;font-size:12px">صالح لمدة ساعة. إن لم تطلب ذلك، تجاهل هذه الرسالة — حسابك آمن.</p>
    </td></tr>
    <tr><td style="background:#0b0f1a;padding:14px;text-align:center;color:#4b5563;font-size:11px">© ترند للإلكترونيات</td></tr>
  </table>
</div>
```

---

### 3) Confirm signup  (تأكيد البريد عند التسجيل)
**Subject:**
```
أكّد بريدك الإلكتروني — ترند
```
**Message body (HTML):**
```html
<div dir="rtl" style="margin:0;background:#0b0f1a;padding:24px;font-family:Tahoma,Arial,sans-serif">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#0f1320;border:1px solid #2a2150;border-radius:16px;overflow:hidden">
    <tr><td style="background:#7c3aed;padding:18px 24px;text-align:center">
      <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:4px">TREND</span>
    </td></tr>
    <tr><td style="padding:28px 24px;color:#e5e7eb;text-align:center">
      <h2 style="margin:0 0 8px;color:#fff;font-size:18px">مرحباً بك في ترند 👋</h2>
      <p style="margin:0 0 22px;color:#9ca3af;font-size:14px">اضغط الزر لتأكيد بريدك وتفعيل حسابك.</p>
      <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 32px;border-radius:10px">تأكيد البريد الإلكتروني</a>
      <p style="margin:22px 0 0;color:#6b7280;font-size:12px">إن لم تنشئ هذا الحساب، تجاهل هذه الرسالة.</p>
    </td></tr>
    <tr><td style="background:#0b0f1a;padding:14px;text-align:center;color:#4b5563;font-size:11px">© ترند للإلكترونيات</td></tr>
  </table>
</div>
```

---

## ثالثاً: نقطة مهمة عن "الرمز" مقابل "الرابط"
- قالب **Magic Link** أعلاه يعرض رمز 6 أرقام عبر `{{ .Token }}` — هذا ما تتوقعه واجهة الدخول.
- قوالب **Reset / Confirm** تستخدم رابطاً عبر `{{ .ConfirmationURL }}`.
- لا تحذف هذه المتغيّرات عند التعديل وإلا تتعطّل الرسائل.
