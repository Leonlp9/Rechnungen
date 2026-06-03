import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Fahrt } from '@/lib/db';
import { geocodeAddress, getRoute } from '@/lib/geocoding';

interface Props {
  fahrten: Fahrt[];
  className?: string;
}

interface ResolvedFahrt {
  fahrt: Fahrt;
  latLngs: [number, number][];
}

export function AlleFahrtenMap({ fahrten, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const [progress, setProgress] = useState(0);
  const [total, setTotal]       = useState(0);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    // Default view: Germany
    map.setView([51.1657, 10.4515], 6);
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || fahrten.length === 0) { setResolving(false); return; }
    const map = mapRef.current;

    setTotal(fahrten.length);
    setProgress(0);
    setResolving(true);

    let cancelled = false;
    const allBounds: [number, number][] = [];

    (async () => {
      const resolved: ResolvedFahrt[] = [];

      for (const fahrt of fahrten) {
        if (cancelled) break;

        let fromLat = fahrt.abfahrt_lat ?? undefined;
        let fromLon = fahrt.abfahrt_lon ?? undefined;
        let toLat   = fahrt.ziel_lat   ?? undefined;
        let toLon   = fahrt.ziel_lon   ?? undefined;

        // Geocode if no stored coords
        if (!fromLat || !fromLon) {
          const p = await geocodeAddress(fahrt.abfahrt);
          if (p) { fromLat = p.lat; fromLon = p.lon; }
        }
        if (!toLat || !toLon) {
          const p = await geocodeAddress(fahrt.ziel);
          if (p) { toLat = p.lat; toLon = p.lon; }
        }

        if (fromLat && fromLon && toLat && toLon) {
          const route = await getRoute(
            { lat: fromLat, lon: fromLon },
            { lat: toLat,   lon: toLon   },
          );
          const latLngs: [number, number][] = route?.coordinates.map(([lon, lat]) => [lat, lon]) ?? [
            [fromLat, fromLon],
            [toLat,   toLon],
          ];
          resolved.push({ fahrt, latLngs });
          allBounds.push(...latLngs);
        }

        setProgress((p) => p + 1);
      }

      if (cancelled) return;
      setResolving(false);

      // Draw all routes
      resolved.forEach(({ fahrt, latLngs }) => {
        const isDienst = fahrt.art === 'dienst';
        const color    = isDienst ? '#3b82f6' : '#9ca3af';
        const line     = L.polyline(latLngs, { color, weight: isDienst ? 4 : 2.5, opacity: isDienst ? 0.85 : 0.6 });

        const popupContent = `
          <div style="font-size:12px;min-width:160px">
            <b>${new Date(fahrt.datum).toLocaleDateString('de-DE')}</b><br/>
            ${fahrt.abfahrt} → ${fahrt.ziel}<br/>
            <span style="color:${isDienst ? '#16a34a' : '#6b7280'}">${isDienst ? '💼 Dienst' : '🏠 Privat'}</span>
            &nbsp;· ${fahrt.km.toFixed(1)} km<br/>
            <i>${fahrt.zweck}</i>
          </div>`;
        line.bindPopup(popupContent);
        line.addTo(map);

        // Start/End dots
        L.circleMarker(latLngs[0], { radius: 5, color: '#fff', weight: 1.5, fillColor: '#22c55e', fillOpacity: 1 }).addTo(map);
        L.circleMarker(latLngs[latLngs.length - 1], { radius: 5, color: '#fff', weight: 1.5, fillColor: '#ef4444', fillOpacity: 1 }).addTo(map);
      });

      if (allBounds.length > 0) {
        map.fitBounds(L.latLngBounds(allBounds), { padding: [24, 24] });
      }
    })();

    return () => { cancelled = true; };
  }, [fahrten]);

  return (
    <div className="relative h-full w-full">
      {resolving && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-background/90 backdrop-blur rounded-lg px-4 py-2 shadow text-xs text-muted-foreground flex items-center gap-2">
          <span className="animate-spin inline-block w-3 h-3 border-2 border-primary border-t-transparent rounded-full" />
          Lade Routen… {progress} / {total}
        </div>
      )}
      <div ref={containerRef} className={className} style={{ height: '100%', minHeight: 400 }} />
    </div>
  );
}


