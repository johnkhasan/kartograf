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
  'settings',
] as const;

type ShareState = Pick<AppState, (typeof SHARE_KEYS)[number]> & {
  markers: AppState['markers'];
};

/**
 * Only the fields that differ from DEFAULT_STATE are encoded, and the result
 * is LZ-compressed — most shares (a location + maybe a theme) end up as a
 * short link instead of the whole app state round-tripping through the URL.
 * The receiving side applies this diff on top of a fresh session, whose
 * state already equals DEFAULT_STATE, so omitted keys stay at their default.
 */
function diffFromDefaults(s: AppState): Partial<ShareState> {
  const diff: Record<string, unknown> = {};
  for (const k of SHARE_KEYS) {
    const current = s[k];
    const def = (DEFAULT_STATE as Record<string, unknown>)[k];
    if (JSON.stringify(current) !== JSON.stringify(def)) diff[k] = current;
  }
  // only built-in icon markers survive a share link
  const markers = s.markers.filter((m) => !m.icon.startsWith('up:'));
  if (JSON.stringify(markers) !== JSON.stringify(DEFAULT_STATE.markers)) {
    diff.markers = markers;
  }
  return diff as Partial<ShareState>;
}

export function encodeShare(s: AppState): string {
  const json = JSON.stringify(diffFromDefaults(s));
  return compressToEncodedURIComponent(json);
}

export function decodeShare(code: string): Partial<ShareState> | null {
  try {
    const json = decompressFromEncodedURIComponent(code);
    if (!json) return null;
    const data = JSON.parse(json);
    if (!data || typeof data !== 'object') return null;
    return data as Partial<ShareState>;
  } catch {
    return null;
  }
}

export function shareUrl(s: AppState): string {
  return `${window.location.origin}${window.location.pathname}?s=${encodeShare(s)}`;
}
