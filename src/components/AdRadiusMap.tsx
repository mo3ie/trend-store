"use client";
// Bundle Leaflet's stylesheet with the component so it is guaranteed present
// BEFORE the map initializes. (Injecting it as a runtime <link> let the map init
// race ahead of its CSS, which rendered the panes with broken sizing — the map
// "took half the screen and wouldn't pan".)
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { Search, Crosshair, Loader2 } from "lucide-react";

export interface MapPin { lat: number; lng: number; radius: number; address?: string }

interface Props {
  value: MapPin | null;
  onChange: (pin: MapPin | null) => void;
  light: boolean;
  rtl: boolean;
  t: (ar: string, en: string) => string;
}

const PINK = "#d6409f";

// Pin-on-map + radius targeting. Produces one FB custom_location
// (latitude/longitude/radius) — the "drop a pin, then widen the circle" flow.
export default function AdRadiusMap({ value, onChange, light, rtl, t }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null);
  const mapObj    = useRef<any>(null);
  const marker    = useRef<any>(null);
  const circle    = useRef<any>(null);
  const Lref      = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [radius, setRadius] = useState(value?.radius ?? 10);
  const [query, setQuery]   = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating]   = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [ready, setReady] = useState(false);

  const c = light
    ? { input: "#f4eefb", border: "rgba(120,60,160,0.2)", text: "#1e1330", menu: "#fff", dim: "#8b7d97" }
    : { input: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.14)", text: "#f6eefb", menu: "#1a1226", dim: "#7a6d88" };

  function drawCircle(lat: number, lng: number, r: number) {
    const Lf = Lref.current; const map = mapObj.current;
    if (!Lf || !map) return;
    if (circle.current) circle.current.setLatLng([lat, lng]).setRadius(r * 1000);
    else circle.current = Lf.circle([lat, lng], { radius: r * 1000, color: PINK, fillColor: PINK, fillOpacity: 0.12, weight: 2 }).addTo(map);
  }

  function place(lat: number, lng: number, r: number, address?: string, fly = true) {
    const Lf = Lref.current; const map = mapObj.current;
    if (!Lf || !map) return;
    if (marker.current) marker.current.setLatLng([lat, lng]);
    else {
      marker.current = Lf.marker([lat, lng], { draggable: true }).addTo(map);
      marker.current.on("dragend", () => {
        const p = marker.current.getLatLng();
        drawCircle(p.lat, p.lng, radiusRef.current);
        onChangeRef.current({ lat: p.lat, lng: p.lng, radius: radiusRef.current });
      });
    }
    drawCircle(lat, lng, r);
    if (fly) map.setView([lat, lng], Math.max(map.getZoom(), 11));
  }

  // keep latest radius for event handlers
  const radiusRef = useRef(radius);
  radiusRef.current = radius;

  useEffect(() => {
    if (typeof window === "undefined") return;
    import("leaflet").then((L) => {
      const Lf = L.default || (L as any);
      Lref.current = Lf;
      delete (Lf.Icon.Default.prototype as any)._getIconUrl;
      Lf.Icon.Default.mergeOptions({
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      if (mapRef.current && !(mapRef.current as any)._leaflet_id) {
        const map = Lf.map(mapRef.current).setView([value?.lat ?? 27.0, value?.lng ?? 17.5], value ? 11 : 5.4);
        Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
        mapObj.current = map;
        setReady(true);
        // The map mounts inside a collapsible panel; recompute its size once the
        // browser has settled the container so tiles and dragging are correct.
        setTimeout(() => map.invalidateSize(), 60);
        setTimeout(() => map.invalidateSize(), 300);
        if (value) place(value.lat, value.lng, value.radius, value.address, false);
        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          place(lat, lng, radiusRef.current, undefined, false);
          onChangeRef.current({ lat, lng, radius: radiusRef.current });
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // radius slider → resize circle + report
  useEffect(() => {
    if (!marker.current) return;
    const p = marker.current.getLatLng();
    drawCircle(p.lat, p.lng, radius);
    onChangeRef.current({ lat: p.lat, lng: p.lng, radius });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius]);

  async function search() {
    if (!query.trim()) return;
    setSearching(true); setResults([]);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + " Libya")}&format=json&limit=4&accept-language=ar`);
      setResults(await res.json());
    } catch { /* ignore */ }
    setSearching(false);
  }
  function pick(r: any) {
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    setResults([]); setQuery(r.display_name.split(",")[0]);
    place(lat, lng, radius, r.display_name);
    onChangeRef.current({ lat, lng, radius, address: r.display_name });
  }
  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); const { latitude: lat, longitude: lng } = pos.coords; place(lat, lng, radius); onChangeRef.current({ lat, lng, radius }); },
      () => setLocating(false), { enableHighAccuracy: true }
    );
  }

  const inputStyle: React.CSSProperties = { flex: 1, background: c.input, border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", color: c.text, fontSize: 13, outline: "none", fontFamily: "inherit" };
  const btnStyle: React.CSSProperties = { background: `${PINK}22`, border: `1px solid ${PINK}55`, borderRadius: 10, padding: "0 12px", color: PINK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ position: "relative", display: "flex", gap: 8 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
          placeholder={t("ابحث عن موقع (مثال: قاريونس، مصراتة)", "Search a place (e.g. Misrata)")} style={inputStyle} />
        <button type="button" onClick={search} disabled={searching} style={btnStyle}>{searching ? <Loader2 size={16} className="spin" /> : <Search size={16} />}</button>
        <button type="button" onClick={locate} disabled={locating} title={t("موقعي", "My location")} style={{ ...btnStyle, background: "rgba(59,130,246,0.14)", border: "1px solid rgba(59,130,246,0.4)", color: "#3b82f6" }}>{locating ? <Loader2 size={16} className="spin" /> : <Crosshair size={16} />}</button>
        {results.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 6px)", insetInlineStart: 0, insetInlineEnd: 0, zIndex: 1000, background: c.menu, border: `1px solid ${c.border}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.28)", overflow: "hidden" }}>
            {results.map((r, i) => (
              <button key={i} type="button" onClick={() => pick(r)} style={{ width: "100%", textAlign: rtl ? "right" : "left", padding: "10px 14px", background: "transparent", border: "none", borderBottom: `1px solid ${c.border}`, cursor: "pointer", color: c.text, fontSize: 12.5, fontFamily: "inherit", display: "flex", gap: 8 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={mapRef} style={{ height: 260, borderRadius: 14, overflow: "hidden", border: `1px solid ${c.border}`, background: c.input }} />
      {!ready && <p style={{ color: c.dim, fontSize: 12, textAlign: "center" }}><Loader2 size={13} className="spin" /> {t("جارٍ تحميل الخريطة…", "Loading map…")}</p>}

      {value ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12.5, color: c.text }}>{t("نطاق التغطية حول الدبوس", "Coverage radius around the pin")}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: PINK }}>{radius} {t("كم", "km")}</span>
          </div>
          <input type="range" min={1} max={80} value={radius} onChange={(e) => setRadius(Number(e.target.value))} style={{ width: "100%", accentColor: PINK }} />
          <button type="button" onClick={() => { if (marker.current) { mapObj.current.removeLayer(marker.current); marker.current = null; } if (circle.current) { mapObj.current.removeLayer(circle.current); circle.current = null; } onChange(null); }}
            style={{ marginTop: 8, background: "none", border: "none", color: "#ef4444", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
            {t("إزالة الدبوس", "Remove pin")}
          </button>
        </div>
      ) : (
        <p style={{ color: c.dim, fontSize: 12, textAlign: "center", lineHeight: 1.6 }}>📍 {t("انقر على الخريطة لوضع دبوس، ثم وسّع القطر بالمؤشر.", "Tap the map to drop a pin, then widen the radius with the slider.")}</p>
      )}
    </div>
  );
}
