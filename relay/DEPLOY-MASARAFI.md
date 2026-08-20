# نشر وسيط مصرفي باي (Masarafi Pay) — mTLS relay ثانٍ

مصرفي باي (مصرف الجمهورية) خدمة منفصلة تمامًا عن يسر باي: خادم ومنفذ وشهادة
mTLS مختلفة. نشغّل **وسيطًا ثانيًا** بنفس كود `server.js` لكن بمنفذ 8081 وشهادة
مصرفي، ونوجّه إليه عبر Caddy حسب المسار `/JUMOnline*`. يسر باي يبقى كما هو دون أي
تغيير في خدمته (:8080).

- الخادم (نفس VPS): `66.23.237.231`
- مضيف مصرفي الإنتاجي: `https://musrefypay-online.mitflink.ly:40110/JUMOnline`
- منفذ الوسيط الجديد: `8081`
- سر الوسيط (RELAY_KEY = MUSRFY_RELAY_KEY على Vercel):
  `005cf04b7d337fd4efa279a126c0f370d5789ba6622a0db859cfd6b5f3438866`

الشهادات (على جهاز التطوير): `C:\Users\BMC\masarafi-pay-cert\`
- `signed/trendstore-ly.com.pem`        → client.pem (شهادة العميل)
- `trendstore-masarafi.key`             → client.key (المفتاح الخاص المطابق)
- `signed/MASARATMUSRFYCAONLINE.pem`    → ca.pem (سلسلة CA)

---

## 1) رفع الشهادات إلى الخادم (من جهاز التطوير)

```bash
KEY=~/.ssh/yusor_relay_deploy
ssh -i $KEY root@66.23.237.231 'mkdir -p /opt/musrfy-relay/certs'
scp -i $KEY "/c/Users/BMC/masarafi-pay-cert/signed/trendstore-ly.com.pem"      root@66.23.237.231:/opt/musrfy-relay/certs/client.pem
scp -i $KEY "/c/Users/BMC/masarafi-pay-cert/trendstore-masarafi.key"           root@66.23.237.231:/opt/musrfy-relay/certs/client.key
scp -i $KEY "/c/Users/BMC/masarafi-pay-cert/signed/MASARATMUSRFYCAONLINE.pem"  root@66.23.237.231:/opt/musrfy-relay/certs/ca.pem
```

## 2) نسخ كود الوسيط (نفس server.js) + وحدة systemd

```bash
scp -i $KEY "/c/Users/BMC/trend-store/relay/server.js"           root@66.23.237.231:/opt/musrfy-relay/server.js
scp -i $KEY "/c/Users/BMC/trend-store/relay/musrfy-relay.service" root@66.23.237.231:/etc/systemd/system/musrfy-relay.service
```

على الخادم — ضع السر الحقيقي واضبط الصلاحيات:

```bash
ssh -i $KEY root@66.23.237.231 '
  chmod 600 /opt/musrfy-relay/certs/client.key
  sed -i "s/RELAY_KEY=CHANGE_ME/RELAY_KEY=005cf04b7d337fd4efa279a126c0f370d5789ba6622a0db859cfd6b5f3438866/" /etc/systemd/system/musrfy-relay.service
  systemctl daemon-reload
  systemctl enable --now musrfy-relay
  sleep 1
  systemctl --no-pager status musrfy-relay | head -12
'
```

## 3) اختبار الوصول من الخادم (mTLS)

```bash
# صحة الوسيط (يجب reachable:true, tls:true, mtls:true)
ssh -i $KEY root@66.23.237.231 'curl -s http://localhost:8081/__relay/health; echo'

# نداء Signin حقيقي عبر mTLS مباشرة (يجب HTTP 200 + توكن)
ssh -i $KEY root@66.23.237.231 '
curl -s -o /dev/null -w "%{http_code}\n" --max-time 20 \
  --cert /opt/musrfy-relay/certs/client.pem \
  --key  /opt/musrfy-relay/certs/client.key \
  --cacert /opt/musrfy-relay/certs/ca.pem \
  -H "Content-Type: application/json" \
  -X POST https://musrefypay-online.mitflink.ly:40110/JUMOnline/api/OnlinePaymentServices/Signin \
  -d "{\"userId\":157629,\"pin\":\"51215240\",\"providerId\":4716179,\"authUserType\":0}"
'
```

## 4) توجيه Caddy حسب المسار (يبقي يسر باي كما هو)

عدّل `/etc/caddy/Caddyfile` ليصبح:

```
relay.trendstore-ly.com {
	# مصرفي باي → الوسيط الثاني :8081
	@masarafi path /JUMOnline*
	reverse_proxy @masarafi localhost:8081

	# يسر باي (وكل ما عداه) → الوسيط الأول :8080 (دون تغيير)
	reverse_proxy localhost:8080
}
```

ثم:

```bash
ssh -i $KEY root@66.23.237.231 'systemctl reload caddy || systemctl restart caddy'
# افتح المنفذ محليًا فقط إن لزم (Caddy يصل localhost:8081 داخليًا — لا حاجة لفتحه للعالم)
```

بديل بلا تعديل كتلة يسر: نطاق فرعي جديد `relay-jum.trendstore-ly.com`
(يتطلب إضافة سجل DNS ‏A إلى 66.23.237.231، ثم كتلة Caddy مستقلة تُوجّه إلى :8081،
وضبط `MUSRFY_BASE_URL=https://relay-jum.trendstore-ly.com/JUMOnline`).

## 5) متغيّرات البيئة على Vercel (Production)

```
MUSRFY_BASE_URL        = https://relay.trendstore-ly.com/JUMOnline
MUSRFY_RELAY_KEY       = 005cf04b7d337fd4efa279a126c0f370d5789ba6622a0db859cfd6b5f3438866
MUSRFY_USER_ID         = 157629
MUSRFY_PIN             = 51215240
MUSRFY_PROVIDER_ID     = 4716179
MUSRFY_AUTH_USER_TYPE  = 0
```

ثم أعد النشر (redeploy). للإطلاق للجميع لاحقًا: `NEXT_PUBLIC_MASARAFI_ENABLED=true`
(حاليًا مصرفي باي يظهر للأدمن فقط للاختبار، تمامًا كيسر باي).

## 6) الاختبار النهائي داخل التطبيق

في www.trendstore-ly.com كأدمن: سلة → مصرفي باي (مصرف الجمهورية) → رقم بطاقة
الجمهورية → OTP → تأكيد. عند النجاح يذهب لصفحة النجاح `?via=masarafi`.
