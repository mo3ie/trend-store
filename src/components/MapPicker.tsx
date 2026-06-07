"use client";
import { useEffect, useRef } from "react";

interface Props {
  lat?: number;
  lng?: number;
  onSelect: (coords: { lat: number; lng: number }) => void;
}

export default function MapPicker({ lat, lng, onSelect }: Props) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const markerRef  = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!document.getElementById("leaflet-css")) {
      const link  = document.createElement("link");
      link.id     = "leaflet-css";
      link.rel    = "stylesheet";
      link.href   = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    import("leaflet").then((L) => {
      const Lf = L.default || L as any;
      delete Lf.Icon.Default.prototype._getIconUrl;
      Lf.Icon.Default.mergeOptions({
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (mapRef.current && !(mapRef.current as any)._leaflet_id) {
        const map = Lf.map(mapRef.current).setView([lat || 32.9, lng || 13.1], 12);
        Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);

        if (lat && lng) {
          markerRef.current = Lf.marker([lat, lng]).addTo(map);
        }

        map.on("click", (e: any) => {
          const { lat: cLat, lng: cLng } = e.latlng;
          if (markerRef.current) {
            markerRef.current.setLatLng([cLat, cLng]);
          } else {
            markerRef.current = Lf.marker([cLat, cLng]).addTo(map);
          }
          onSelect({ lat: cLat, lng: cLng });
        });
      }
    });
  }, []);

  return (
    <div>
      <div ref={mapRef} className="rounded-xl overflow-hidden border border-purple-500/30" style={{ height: 240 }} />
      <p className="text-gray-500 text-xs mt-2 text-center">🗺️ انقر على الخريطة لتحديد موقعك</p>
    </div>
  );
}
