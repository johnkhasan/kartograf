import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { DEFAULT_STATE, type AppState } from '../store';

/** Fields eligible for a share link (uploaded marker images excluded — too large for a URL). */
const SHARE_KEYS = [
  'location',
  'center',
  'zoom',
  'themeId',
  'customTheme',
  'layoutId',
  'styleOpts',
  'layers',
  'markerSize',
  'markerColor',
  'route',
  'routeWidth',
  'couple',
  'settings',
] as const;

type ShareState = Pick<AppState, (typeof SHARE_KEYS)[number]> & {
  markers: AppState['markers'];
};

/**
 * Short aliases for every field that can end up in a share link. Full,
 * descriptive names cost real bytes once compressed (LZ only exploits
 * repetition *within* one small JSON string, so verbose keys used once
 * each are barely compressed), so the payload uses these instead. Purely
 * an encoding detail — a one-time change is fine since this feature ships
 * with no real links out in the wild yet.
 */
const TOP_KEYS: Record<string, string> = {
  location: 'p',
  center: 'c',
  zoom: 'z',
  themeId: 't',
  customTheme: 'x',
  layoutId: 'l',
  styleOpts: 'o',
  layers: 'y',
  markerSize: 'ms',
  markerColor: 'mc',
  route: 'r',
  routeWidth: 'rw',
  settings: 'se',
  markers: 'mk',
  couple: 'cp',
};

const LOCATION_KEYS: Record<string, string> = { name: 'n', country: 'c', lat: 'a', lng: 'g' };
const STYLE_KEYS: Record<string, string> = {
  showOverlay: 'ov',
  showCity: 'ci',
  showCountry: 'co',
  showCoords: 'cd',
  font: 'f',
  customTitle: 'ti',
  customSubtitle: 'su',
  frame: 'fr',
  textPos: 'tp',
  textAlign: 'tl',
  textOffset: 'to',
  textScale: 'ts',
  textTracking: 'tk',
  divider: 'dv',
  grain: 'gr',
  border: 'br',
};
const LAYER_KEYS: Record<string, string> = {
  landcover: 'lc',
  buildings: 'bl',
  water: 'wa',
  parks: 'pk',
  roads: 'rd',
  rail: 'ra',
  aeroway: 'ae',
  boundaries: 'bd',
};
const SETTINGS_KEYS: Record<string, string> = { scale: 'sc', format: 'fm', bleedMm: 'bl' };
const COUPLE_KEYS: Record<string, string> = {
  enabled: 'e',
  a: 'a',
  b: 'b',
  date: 'd',
  units: 'u',
  separator: 's',
  showDistance: 'sd',
  curve: 'cv',
  dashed: 'dh',
  lineWidth: 'w',
};
const COUPLE_POINT_KEYS: Record<string, string> = {
  name: 'n',
  country: 'c',
  lat: 'a',
  lng: 'g',
  label: 'l',
};
const MARKER_KEYS: Record<string, string> = { icon: 'i', lng: 'g', lat: 'a', label: 'l' };

function invert(m: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]));
}

function rename(obj: object, map: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[map[k] ?? k] = v;
  return out;
}

/** Only the sub-fields that differ from `def` are kept, using short keys. */
function diffObject(
  current: object,
  def: object,
  keyMap: Record<string, string>
): Record<string, unknown> {
  const defRec = def as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(current)) {
    if (JSON.stringify(v) !== JSON.stringify(defRec[k])) out[keyMap[k] ?? k] = v;
  }
  return out;
}

function undiffObject<T extends object>(
  packed: Record<string, unknown>,
  def: T,
  keyMap: Record<string, string>
): T {
  const inv = invert(keyMap);
  const out: Record<string, unknown> = { ...(def as Record<string, unknown>) };
  for (const [k, v] of Object.entries(packed)) out[inv[k] ?? k] = v;
  return out as T;
}

let markerSeq = 0;
const freshMarkerId = () => `sh${Date.now().toString(36)}${(++markerSeq).toString(36)}`;

/**
 * Builds the compact payload for a share link: every top-level field is
 * dropped when it matches DEFAULT_STATE, `styleOpts`/`layers` are diffed
 * field-by-field (so toggling one option doesn't drag the whole object
 * along), `location` and `markers` use short keys, and marker ids (only
 * meaningful within this session) are stripped — the receiving side
 * regenerates them. The result is then LZ-compressed for the URL.
 */
function packShare(s: AppState): Record<string, unknown> {
  const packed: Record<string, unknown> = {};

  const scalarKeys = [
    'center',
    'zoom',
    'themeId',
    'customTheme',
    'layoutId',
    'markerSize',
    'markerColor',
    'route',
    'routeWidth',
  ] as const;
  for (const k of scalarKeys) {
    if (JSON.stringify(s[k]) !== JSON.stringify(DEFAULT_STATE[k])) packed[TOP_KEYS[k]] = s[k];
  }

  if (JSON.stringify(s.location) !== JSON.stringify(DEFAULT_STATE.location)) {
    packed[TOP_KEYS.location] = rename(s.location, LOCATION_KEYS);
  }

  const styleDiff = diffObject(s.styleOpts, DEFAULT_STATE.styleOpts, STYLE_KEYS);
  if (Object.keys(styleDiff).length) packed[TOP_KEYS.styleOpts] = styleDiff;

  const layersDiff = diffObject(s.layers, DEFAULT_STATE.layers, LAYER_KEYS);
  if (Object.keys(layersDiff).length) packed[TOP_KEYS.layers] = layersDiff;

  const settingsDiff = diffObject(s.settings, DEFAULT_STATE.settings, SETTINGS_KEYS);
  if (Object.keys(settingsDiff).length) packed[TOP_KEYS.settings] = settingsDiff;

  const coupleDiff = diffObject(s.couple, DEFAULT_STATE.couple, COUPLE_KEYS);
  for (const side of ['a', 'b'] as const) {
    const point = coupleDiff[COUPLE_KEYS[side]];
    if (point) coupleDiff[COUPLE_KEYS[side]] = rename(point as object, COUPLE_POINT_KEYS);
  }
  if (Object.keys(coupleDiff).length) packed[TOP_KEYS.couple] = coupleDiff;

  // only built-in icon markers survive a share link; ids are regenerated on load
  const markers = s.markers.filter((m) => !m.icon.startsWith('up:'));
  if (markers.length) {
    packed[TOP_KEYS.markers] = markers.map((m) => rename(m, MARKER_KEYS));
  }

  return packed;
}

function unpackShare(packed: Record<string, unknown>): Partial<ShareState> {
  const inv = invert(TOP_KEYS);
  const out: Record<string, unknown> = {};

  for (const [shortKey, value] of Object.entries(packed)) {
    const key = inv[shortKey] ?? shortKey;
    if (key === 'location') {
      out.location = undiffObject(value as Record<string, unknown>, DEFAULT_STATE.location, LOCATION_KEYS);
    } else if (key === 'styleOpts') {
      out.styleOpts = undiffObject(
        value as Record<string, unknown>,
        DEFAULT_STATE.styleOpts,
        STYLE_KEYS
      );
    } else if (key === 'layers') {
      out.layers = undiffObject(value as Record<string, unknown>, DEFAULT_STATE.layers, LAYER_KEYS);
    } else if (key === 'settings') {
      out.settings = undiffObject(
        value as Record<string, unknown>,
        DEFAULT_STATE.settings,
        SETTINGS_KEYS
      );
    } else if (key === 'couple') {
      const couple = undiffObject(
        value as Record<string, unknown>,
        DEFAULT_STATE.couple,
        COUPLE_KEYS
      );
      const invPoint = invert(COUPLE_POINT_KEYS);
      for (const side of ['a', 'b'] as const) {
        const point = couple[side];
        if (point) couple[side] = rename(point, invPoint) as unknown as typeof point;
      }
      out.couple = couple;
    } else if (key === 'markers') {
      const invMarker = invert(MARKER_KEYS);
      out.markers = (value as Array<Record<string, unknown>>).map((m) => ({
        id: freshMarkerId(),
        ...rename(m, invMarker),
      }));
    } else {
      out[key] = value;
    }
  }

  return out as Partial<ShareState>;
}

export function encodeShare(s: AppState): string {
  const json = JSON.stringify(packShare(s));
  return compressToEncodedURIComponent(json);
}

export function decodeShare(code: string): Partial<ShareState> | null {
  try {
    const json = decompressFromEncodedURIComponent(code);
    if (!json) return null;
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') return null;
    return unpackShare(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export function shareUrl(s: AppState): string {
  return `${window.location.origin}${window.location.pathname}?s=${encodeShare(s)}`;
}

/** Self-hosted redirector (see /srv/shortlink on the VPS) — turns the long
 *  compressed link into e.g. https://shortlink.javohir.ru/aB3kZ9. */
const SHORTLINK_ORIGIN = 'https://shortlink.javohir.ru';

/**
 * Shortens a share link via the self-hosted redirector. Falls back to the
 * long (but still compressed) link if that service is unreachable or slow,
 * so sharing never hard-fails on a third-party/self-hosted outage.
 */
export async function shortShareUrl(s: AppState): Promise<string> {
  const code = encodeShare(s);
  const long = `${window.location.origin}${window.location.pathname}?s=${code}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${SHORTLINK_ORIGIN}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return long;
    const data: unknown = await res.json();
    const id = (data as { id?: unknown } | null)?.id;
    return typeof id === 'string' && id ? `${SHORTLINK_ORIGIN}/${id}` : long;
  } catch {
    return long;
  }
}
