"use client";
import { useEffect, useRef, useState } from "react";
import { Search, MapPin, Loader } from "lucide-react";

interface Props {
  lat?: number;
  lng?: number;
  onSelect: (coords: { lat: number; lng: number; address?: string }) => void;
}

export default function MapPicker({ lat, lng, onSelect }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null);
  const markerRef = useRef<any>(null);
  const mapObjRef = useRef<any>(null);

  const [searchText, setSearchText]   = useState("");
  const [searching,  setSearching]    = useState(false);
  const [locating,   setLocating]     = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id    = "leaflet-css";
      link.rel   = "stylesheet";
      link.href  = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      const Lf = L.default || (L as any);
      delete (Lf.Icon.Default.prototype as any)._getIconUrl;
      Lf.Icon.Default.mergeOptions({
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (mapRef.current && !(mapRef.current as any)._leaflet_id) {
        const map = Lf.map(mapRef.current).setView([lat || 32.115, lng || 20.067], lat ? 14 : 7);
        Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);

        mapObjRef.current = map;

        if (lat && lng) {
          markerRef.current = Lf.marker([lat, lng]).addTo(map);
        }

        map.on("click", (e: any) => {
          const { lat: cLat, lng: cLng } = e.latlng;
          placeMarker(Lf, map, cLat, cLng);
          onSelect({ lat: cLat, lng: cLng });
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeMarker(Lf: any, map: any, cLat: number, cLng: number) {
    if (markerRef.current) {
      markerRef.current.setLatLng([cLat, cLng]);
    } else {
      markerRef.current = Lf.marker([cLat, cLng]).addTo(map);
    }
    map.setView([cLat, cLng], Math.max(map.getZoom(), 14));
  }

  async function handleSearch() {
    if (!searchText.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchText + " Libya")}&format=json&limit=4&accept-language=ar`,
        { headers: { "User-Agent": "TrendStore/1.0" } }
      );
      const data = await res.json();
      setSearchResults(data);
    } catch {
      // ignore
    }
    setSearching(false);
  }

  function selectResult(result: any) {
    const cLat = parseFloat(result.lat);
    const cLng = parseFloat(result.lon);
    setSearchResults([]);
    setSearchText(result.display_name.split(",")[0]);
    if (mapObjRef.current) {
      import("leaflet").then((L) => {
        const Lf = L.default || (L as any);
        placeMarker(Lf, mapObjRef.current, cLat, cLng);
      });
    }
    onSelect({ lat: cLat, lng: cLng, address: result.display_name });
  }

  function handleLocateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const cLat = pos.coords.latitude;
        const cLng = pos.coords.longitude;
        setLocating(false);
        if (mapObjRef.current) {
          import("leaflet").then((L) => {
            const Lf = L.default || (L as any);
            placeMarker(Lf, mapObjRef.current, cLat, cLng);
          });
        }
        onSelect({ lat: cLat, lng: cLng });
      },
      () => setLocating(false),
      { enableHighAccuracy: true }
    );
  }

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="ابحث عن موقع... (مثال: قاريونس، بنغازي)"
              className="w-full px-4 py-2.5 pr-10 rounded-xl bg-[var(--input)] border border-purple-500/30 text-[var(--text)] text-sm focus:outline-none focus:border-purple-500/60 transition-all placeholder:text-[var(--muted-2)]"
            />
            {searching && (
              <Loader size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 animate-spin" />
            )}
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            className="px-3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-[var(--text)] text-sm font-medium transition-all flex items-center gap-1.5 shrink-0"
          >
            <Search size={15} />
            بحث
          </button>
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="px-3 py-2.5 rounded-xl bg-blue-600/80 hover:bg-blue-500 text-[var(--text)] text-sm font-medium transition-all flex items-center gap-1.5 shrink-0"
            title="موقعي الحالي"
          >
            {locating
              ? <Loader size={15} className="animate-spin" />
              : <MapPin size={15} />
            }
          </button>
        </div>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-[1000] mt-1 bg-[var(--surface)] border border-purple-500/30 rounded-xl shadow-2xl overflow-hidden">
            {searchResults.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectResult(r)}
                className="w-full px-4 py-2.5 text-right text-sm text-[var(--muted)] hover:bg-purple-500/10 hover:text-[var(--text)] transition-colors flex items-start gap-2 border-b border-[var(--border)] last:border-b-0"
              >
                <MapPin size={14} className="text-purple-400 mt-0.5 shrink-0" />
                <span className="truncate">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div ref={mapRef} className="rounded-xl overflow-hidden border border-purple-500/30" style={{ height: 260 }} />
      <p className="text-[var(--muted-2)] text-xs text-center">🗺️ ابحث عن موقع أو انقر على الخريطة لتحديده</p>
    </div>
  );
}
