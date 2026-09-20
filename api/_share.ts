// lz-string is CommonJS with no ESM build, and Node's lexer can't pick named
// exports out of its UMD wrapper — the default import is the whole module
import LZString from 'lz-string';
import { COUPLE_POINT_KEYS, LOCATION_KEYS, TOP_KEYS } from '../src/lib/shareKeys.js';
import { getTheme } from '../src/data/themes.js';
import type { Theme } from '../src/types';

/**
 * Just enough of a share code to describe the poster it points at.
 *
 * The app's own decoder in lib/share.ts merges every field against the store's
 * defaults, which would mean importing zustand into a serverless function. A
 * link preview only needs the names, the distance and the colours, so this
 * reads those straight off the packed payload using the shared alias tables.
 */
export interface SharePreview {
  title: string;
  subtitle: string;
  meta: string;
  theme: Theme;
  couple: boolean;
}

const EARTH_R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

function haversineKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return (2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)))) / 1000;
}

interface Point {
  name: string;
  country: string;
  lat: number;
  lng: number;
  label: string;
}

function readPoint(raw: unknown): Point | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const get = (key: keyof typeof COUPLE_POINT_KEYS) => o[COUPLE_POINT_KEYS[key]];
  const lat = Number(get('lat'));
  const lng = Number(get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    name: String(get('name') ?? ''),
    country: String(get('country') ?? ''),
    label: String(get('label') ?? ''),
    lat,
    lng,
  };
}

const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function readShare(code: string): SharePreview | null {
  let packed: Record<string, unknown>;
  try {
    const json = LZString.decompressFromEncodedURIComponent(code);
    if (!json) return null;
    packed = JSON.parse(json) as Record<string, unknown>;
    if (!packed || typeof packed !== 'object') return null;
  } catch {
    return null;
  }

  const theme = getTheme(String(packed[TOP_KEYS.themeId] ?? 'midnight-blue'));

  const locRaw = packed[TOP_KEYS.location] as Record<string, unknown> | undefined;
  const location = {
    name: String(locRaw?.[LOCATION_KEYS.name] ?? 'Tashkent'),
    country: String(locRaw?.[LOCATION_KEYS.country] ?? 'Uzbekistan'),
  };

  const coupleRaw = packed[TOP_KEYS.couple] as Record<string, unknown> | undefined;
  const a = readPoint(coupleRaw?.a);
  const b = readPoint(coupleRaw?.b);
  const coupleOn = coupleRaw?.e !== false && !!a && !!b;

  if (coupleOn && a && b) {
    const sep = typeof coupleRaw?.s === 'string' ? (coupleRaw.s as string) : '♥';
    const named = !!(a.label.trim() || b.label.trim());
    const nameA = (a.label.trim() || a.name).toUpperCase();
    const nameB = (b.label.trim() || b.name).toUpperCase();
    const pair = (x: string, y: string) => (x && y && x !== y ? `${x} — ${y}` : x || y);

    const km = haversineKm(a, b);
    const miles = coupleRaw?.u === 'mi';
    const value = miles ? km / 1.609344 : km;
    const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
    const date = typeof coupleRaw?.d === 'string' ? (coupleRaw.d as string).trim() : '';

    return {
      title: `${nameA} ${sep} ${nameB}`,
      subtitle: (named ? pair(a.name, b.name) : pair(a.country, b.country)).toUpperCase(),
      meta: [`${group(rounded)} ${miles ? 'MI' : 'KM'}`, date].filter(Boolean).join(' · '),
      theme,
      couple: true,
    };
  }

  return {
    title: location.name.toUpperCase(),
    subtitle: location.country.toUpperCase(),
    meta: '',
    theme,
    couple: false,
  };
}
