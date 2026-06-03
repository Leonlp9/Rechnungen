import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoPlace, RouteResult } from '@/lib/geocoding';

interface Props {
  from: GeoPlace;
  to: GeoPlace;
  route?: RouteResult | null;
  className?: string;
}

// Fix Leaflet default marker icons for Vite bundler
function fixLeafletIcons() {
  // Use CircleMarker instead to avoid icon URL issues entirely
}

const START_COLOR = '#22c55e';  // green
const END_COLOR   = '#ef4444';  // red
const ROUTE_COLOR = '#3b82f6';  // blue

export function FahrtRouteMap({ from, to, route, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const layersRef    = useRef<L.Layer[]>([]);

  // Initialise map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    fixLeafletIcons();

    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Update markers & route when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old layers
    layersRef.current.forEach((l) => l.remove());
    layersRef.current = [];

    const addLayer = (l: L.Layer) => { l.addTo(map); layersRef.current.push(l); };

    // Start marker (green circle)
    addLayer(
      L.circleMarker([from.lat, from.lon], { radius: 9, color: '#fff', weight: 2, fillColor: START_COLOR, fillOpacity: 1 })
        .bindPopup(`<b>Abfahrt</b><br/>${from.shortName}`)
    );

    // End marker (red circle)
    addLayer(
      L.circleMarker([to.lat, to.lon], { radius: 9, color: '#fff', weight: 2, fillColor: END_COLOR, fillOpacity: 1 })
        .bindPopup(`<b>Ziel</b><br/>${to.shortName}`)
    );

    if (route && route.coordinates.length > 0) {
      // Draw route polyline
      const latLngs = route.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
      addLayer(L.polyline(latLngs, { color: ROUTE_COLOR, weight: 4, opacity: 0.85 }));
      map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24] });
    } else {
      // No route yet: just fit to the two points
      const bounds = L.latLngBounds([[from.lat, from.lon], [to.lat, to.lon]]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [from, to, route]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ minHeight: 260 }}
    />
  );
}

