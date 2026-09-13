import type { GeoResult } from '../types';

interface NominatimItem {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

function pickName(a: Record<string, string> | undefined, fallback: string): string {
  if (!a) return fallback;
  return (
    a.city ||
    a.town ||
    a.village ||
    a.municipality ||
    a.suburb ||
    a.county ||
    a.state ||
    fallback
  );
}

export async function searchPlaces(query: string): Promise<GeoResult[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=' +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data: NominatimItem[] = await res.json();
  return data.map((it) => {
    const short = it.display_name.split(',')[0].trim();
    return {
      displayName: it.display_name,
      name: pickName(it.address, short) || short,
      country: it.address?.country ?? '',
      lat: parseFloat(it.lat),
      lng: parseFloat(it.lon),
    };
  });
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const it: NominatimItem = await res.json();
  if (!it || !it.lat) return null;
  const short = (it.display_name ?? '').split(',')[0].trim();
  return {
    displayName: it.display_name ?? '',
    name: pickName(it.address, short) || short,
    country: it.address?.country ?? '',
    lat: parseFloat(it.lat),
    lng: parseFloat(it.lon),
  };
}

export function formatCoords(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns} / ${Math.abs(lng).toFixed(4)}° ${ew}`;
}
