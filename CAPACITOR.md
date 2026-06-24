# Native app (Capacitor) — ترند

The store is shipped to the App Store / Google Play as a native shell that
loads the live production site (`https://trendstore-ly.com`) in a native
WebView. We use the **remote `server.url`** approach because the storefront
is a full SSR Next.js app (API routes, middleware, Supabase SSR) and can't
be statically exported.

- Config: [`capacitor.config.ts`](./capacitor.config.ts) — `appId: com.trendstorely.app`, `server.url` = production.
- Offline fallback: [`www/index.html`](./www/index.html) (shown if the site is unreachable).
- App label: **ترند** (Android `res/values/strings.xml`; iOS `CFBundleDisplayName`).
- Icons & splash: generated from `assets/logo.png` onto `#0b0f1a`.

When you change the icon or config, re-run:

```bash
npm run cap:assets   # regenerate icons/splash from assets/logo.png
npm run cap:sync     # copy config + plugins into native projects
```

> Note: because the app points at the live URL, **content updates ship by
> deploying the website** — no app-store update needed. You only rebuild the
> app for native changes (icon, plugins, permissions, store metadata).

---

## Prerequisites (not installed on the dev machine yet)

- **Android:** [Android Studio](https://developer.android.com/studio) (bundles JDK 17 + Android SDK).
- **iOS:** a **Mac** with Xcode + CocoaPods. The iOS folder is created on the Mac (see below); the config in `capacitor.config.ts` is already iOS-ready.

---

## Android — build & publish

```bash
# 1. open the project in Android Studio
npm run cap:android

# 2. or build a release bundle from the CLI (JDK + SDK on PATH):
cd android
./gradlew bundleRelease     # → android/app/build/outputs/bundle/release/app-release.aab
./gradlew assembleRelease   # → APK, for sideload testing
```

### Signing (required for Play Store)
1. Create a keystore (once, keep it safe — losing it blocks future updates):
   ```bash
   keytool -genkey -v -keystore trend-release.keystore -alias trend -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Add to `android/keystore.properties` (git-ignored) and reference it in
   `android/app/build.gradle` `signingConfigs` → `release`.
3. Build `bundleRelease` and upload the `.aab` to the **Google Play Console**
   (requires a one-time $25 developer account).

## iOS — build & publish (Mac only)

```bash
npx cap add ios       # creates the ios/ project (run on the Mac)
npm run cap:sync
npm run cap:ios       # opens Xcode
```
In Xcode: set the team/signing, bump the version, Product → Archive →
distribute to **App Store Connect** (requires the $99/yr Apple Developer
Program). Submit for review.

---

## Store-review note (important)

Apple (guideline 4.2) and, to a lesser degree, Google may reject an app that
is *only* a website wrapper. Before submitting, add native value — most
cheaply **push notifications** (`@capacitor/push-notifications`) for order
status, and use the native splash/status-bar already configured. Tie pushes
to the existing order/notification flow.
