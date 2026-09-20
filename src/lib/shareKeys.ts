/**
 * Field-name aliases for share links, kept apart from lib/share.ts so they can
 * be read without pulling in the store: the link preview decodes a code inside
 * a serverless function, where zustand and its persist middleware have no
 * business being imported.
 */
/**
 * Short aliases for every field that can end up in a share link. Full,
 * descriptive names cost real bytes once compressed (LZ only exploits
 * repetition *within* one small JSON string, so verbose keys used once
 * each are barely compressed), so the payload uses these instead. Purely
 * an encoding detail — a one-time change is fine since this feature ships
 * with no real links out in the wild yet.
 */
export const TOP_KEYS: Record<string, string> = {
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

export const LOCATION_KEYS: Record<string, string> = { name: 'n', country: 'c', lat: 'a', lng: 'g' };
export const STYLE_KEYS: Record<string, string> = {
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
export const LAYER_KEYS: Record<string, string> = {
  landcover: 'lc',
  buildings: 'bl',
  water: 'wa',
  parks: 'pk',
  roads: 'rd',
  rail: 'ra',
  aeroway: 'ae',
  boundaries: 'bd',
};
export const SETTINGS_KEYS: Record<string, string> = { scale: 'sc', format: 'fm', bleedMm: 'bl' };
export const COUPLE_KEYS: Record<string, string> = {
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
export const COUPLE_POINT_KEYS: Record<string, string> = {
  name: 'n',
  country: 'c',
  lat: 'a',
  lng: 'g',
  label: 'l',
};
export const MARKER_KEYS: Record<string, string> = { icon: 'i', lng: 'g', lat: 'a', label: 'l' };
