import type { AppState } from '../store';

/** Fields encoded into a share link (uploaded marker images excluded — too large). */
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

export function encodeShare(s: AppState): string {
  const data: Record<string, unknown> = {};
  for (const k of SHARE_KEYS) data[k] = s[k];
  // only built-in icon markers survive a share link
  data.markers = s.markers.filter((m) => !m.icon.startsWith('up:'));
  const json = JSON.stringify(data);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(code: string): Partial<ShareState> | null {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== 'object' || !data.location) return null;
    return data as Partial<ShareState>;
  } catch {
    return null;
  }
}

export function shareUrl(s: AppState): string {
  return `${window.location.origin}${window.location.pathname}?s=${encodeShare(s)}`;
}
