export const metadata = { title: "غير متصل | محل ترند" };
export const dynamic = "force-static";

// Shown by the service worker when a page is not cached and there is no connection.
export default function Offline() {
  return (
    <div dir="rtl" style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0f1a", color: "#e5e7eb", fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 380 }}>
        <img src="/brand/trend-logo.png" alt="TREND" style={{ width: 96, margin: "0 auto 18px", display: "block" }} />
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>أنت غير متصل بالإنترنت</h1>
        <p style={{ opacity: 0.75, lineHeight: 1.8, marginBottom: 20 }}>الصفحات اللي فتحتها قبل تقدر تتصفحها عادي. الدفع والطلبات والمحفظة تحتاج إنترنت — أول ما ترجع الشبكة كمّل من حيث وقفت.</p>
        <a href="/" style={{ display: "inline-block", padding: "12px 22px", borderRadius: 14, background: "linear-gradient(90deg,#7c3aed,#2563eb)", color: "#fff", fontWeight: 800, textDecoration: "none" }}>حاول مرة ثانية</a>
      </div>
    </div>
  );
}
