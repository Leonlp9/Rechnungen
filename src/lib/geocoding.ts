/**
 * Geocoding & Routing via freie APIs (kein API-Key erforderlich)
 * - Nominatim (OpenStreetMap) für Adresssuche
 * - OSRM für Routing
 *
 * Alle Ergebnisse werden in einem Modul-Level-Cache gespeichert →
 * pro Adresse/Route nur eine API-Anfrage pro App-Session.
 */

export interface GeoPlace {
  displayName: string;
  shortName: string;
  lat: number;
  lon: number;
  placeId: string;
}

export interface RouteResult {
  /** Strecke in Metern */
  distance: number;
  /** Fahrtzeit in Sekunden */
  duration: number;
  /** Koordinaten-Paare [lon, lat] für die Polyline */
  coordinates: [number, number][];
}

// ── Caches ──────────────────────────────────────────────────────────────────
const searchCache = new Map<string, GeoPlace[]>();
const routeCache  = new Map<string, RouteResult | null>();
const geocodeCache = new Map<string, GeoPlace | null>();

// ── Nominatim: Adresssuche ──────────────────────────────────────────────────

/** Gibt Vorschläge für eine Suchanfrage zurück (min. 3 Zeichen). */
export async function searchPlaces(query: string): Promise<GeoPlace[]> {
  const key = query.trim().toLowerCase();
  if (key.length < 3) return [];
  if (searchCache.has(key)) return searchCache.get(key)!;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '6');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'de');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Klevr-RechnungsManager/1.0' },
    });
    const data: NominatimResult[] = await res.json();

    const places: GeoPlace[] = data.map((item) => ({
      displayName: item.display_name,
      shortName: buildShortName(item),
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      placeId: String(item.place_id),
    }));

    searchCache.set(key, places);
    return places;
  } catch {
    return [];
  }
}

/** Geocodiert eine gespeicherte Adresszeichenkette zu einem GeoPlace. */
export async function geocodeAddress(address: string): Promise<GeoPlace | null> {
  const key = address.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  const results = await searchPlaces(address);
  const result = results[0] ?? null;
  geocodeCache.set(key, result);
  return result;
}

// ── OSRM: Routing ────────────────────────────────────────────────────────────

/** Holt eine Route zwischen zwei Koordinaten von OSRM. */
export async function getRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): Promise<RouteResult | null> {
  const key = `${from.lat.toFixed(5)},${from.lon.toFixed(5)}|${to.lat.toFixed(5)},${to.lon.toFixed(5)}`;
  if (routeCache.has(key)) return routeCache.get(key)!;

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== 'Ok' || !data.routes?.[0]) {
      routeCache.set(key, null);
      return null;
    }

    const r = data.routes[0];
    const result: RouteResult = {
      distance: r.distance,
      duration: r.duration,
      coordinates: r.geometry.coordinates as [number, number][],
    };
    routeCache.set(key, result);
    return result;
  } catch {
    routeCache.set(key, null);
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildShortName(item: NominatimResult): string {
  const a = item.address;
  if (!a) return item.display_name.split(',')[0];
  const parts = [
    a.road || a.pedestrian || a.path,
    a.house_number,
    a.city || a.town || a.village || a.municipality,
    a.postcode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : item.display_name.split(',')[0];
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    pedestrian?: string;
    path?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
    country?: string;
  };
}

