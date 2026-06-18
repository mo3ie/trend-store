# Yusor Pay (يسر باي) — وسيط العنوان الثابت / static-IP relay

## لماذا هذا الوسيط؟

خوادم Vercel (serverless) ليس لها عنوان IP **صادر** ثابت — تخرج من عناوين متغيّرة.
لذلك لا يمكن لمسارات أن يضعها في القائمة البيضاء (whitelist). هذا الوسيط يعمل على
خادم **بعنوان IPv4 ثابت** (تعطيه أنت لمسارات) ويمرّر الطلبات إلى خادم يسر باي:

```
Vercel  ── x-relay-key ──►  هذا الوسيط (IP ثابت، مُصرّح)  ──►  160.19.103.122:40120
```

كل كود التطبيق يبقى كما هو — نغيّر فقط `YUSOR_BASE_URL` في Vercel ليشير للوسيط.

الخادم الحالي: **`66.23.237.231`** (InterServer VPS، نيوجيرسي/أمريكا).

---

## 1) تثبيت Node على الخادم (إن لم يكن مثبتًا)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # تأكد 14+
```

## 2) نسخ ملفات الوسيط للخادم

```bash
sudo mkdir -p /opt/yusor-relay
# انسخ server.js و package.json من مجلد relay/ إلى /opt/yusor-relay
# (scp أو git clone أو لصق يدوي)
```

## 3) ⚡ اختبار الوصول أولًا (قبل أي شيء مع مسارات)

شغّل الوسيط مؤقتًا واسأله: هل تصل من هذا الخادم إلى يسر باي؟

```bash
cd /opt/yusor-relay
RELAY_KEY=test node server.js &
curl -s http://localhost:8080/__relay/health ; echo
```

- `{"reachable":true,...}`  → 🎉 الخادم الأمريكي يصل ليسر باي. تابع للخطوة 4.
- `{"reachable":false,"error":"ETIMEDOUT"}` → الخادم لا يصل (إما يحتاج whitelist، أو
  يسر باي يقبل فقط من داخل ليبيا). **هذا الناتج بالذات نعطيه لمسارات** ونسألهم:
  هل عنوان `66.23.237.231` مسموح؟ وهل الخدمة قابلة للوصول من خارج ليبيا؟

أوقف الاختبار: `kill %1`

## 4) التشغيل الدائم (systemd)

```bash
# عدّل yusor-relay.service: ضع RELAY_KEY الحقيقي (نفس قيمة YUSOR_RELAY_KEY على Vercel)
sudo cp yusor-relay.service /etc/systemd/system/yusor-relay.service
sudo systemctl daemon-reload
sudo systemctl enable --now yusor-relay
sudo systemctl status yusor-relay
# سجلات حية:
journalctl -u yusor-relay -f
```

افتح المنفذ في الجدار الناري:

```bash
sudo ufw allow 8080/tcp   # أو 443 إن استخدمت Caddy/TLS
```

## 5) (موصى به للإنتاج) TLS عبر نطاق فرعي

الطلبات تحمل PIN التاجر ورقم البطاقة وOTP — يجب تشفيرها. بدون TLS تمرّ كنص صريح.

1. أضف سجل DNS:  `relay.trendstore-ly.com  A  66.23.237.231`
2. ثبّت Caddy وشغّله بملف `Caddyfile` المرفق (يجلب شهادة Let's Encrypt تلقائيًا).
3. على Vercel استخدم `https://relay.trendstore-ly.com/YusorOnline` بدل `http://IP:8080`.

## 6) ضبط Vercel

في إعدادات مشروع trend-store على Vercel (Production):

```
YUSOR_BASE_URL  = http://66.23.237.231:8080/YusorOnline      (أو https://relay.trendstore-ly.com/YusorOnline مع TLS)
YUSOR_RELAY_KEY = <نفس RELAY_KEY على الخادم>
```

ثم أعد النشر. التطبيق يضيف ترويسة `x-relay-key` تلقائيًا (انظر src/lib/yusor.ts).

## 7) أعطِ مسارات العنوان الصحيح

اطلب من مسارات وضع **`66.23.237.231`** في القائمة البيضاء — **هذا فقط**.
(العنوانان السابقان `76.76.21.21` و`160.19.103.122` خاطئان: الأول عنوان Vercel
الوارد، والثاني خادم مسارات نفسه.)

---

### الأمان
- `RELAY_KEY` إلزامي — الوسيط يرفض العمل بدونه (لمنع أن يصبح بروكسي مفتوحًا).
- أي طلب بلا الترويسة الصحيحة → 403.
- `/__relay/health` مفتوح عمدًا لكنه لا يكشف أي سر (فحص اتصال TCP فقط).
