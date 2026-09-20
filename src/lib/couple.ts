import type { Map as MLMap, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { markerSvg } from '../data/markerIcons';
import type { CoupleState, CouplePoint, DistanceUnit } from '../types';

/** IAU mean Earth radius in metres — the usual choice for haversine. */
const EARTH_R = 6371008.8;
const METRES_PER_MILE = 1609.344;

export const COUPLE_SOURCE = 'couple';
export const COUPLE_LINE_LAYER = 'couple-line';
export const COUPLE_POINT_LAYER = 'couple-points';
export const COUPLE_ICON = 'couple-heart';

/** Last icon color+size rasterized per map, so slider drags don't re-decode it. */
const iconKeys = new WeakMap<MLMap, string>();

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** True if both endpoints are set and the mode is on — the only state worth drawing. */
export function coupleActive(c: CoupleState): c is CoupleState & { a: CouplePoint; b: CouplePoint } {
  return c.enabled && !!c.a && !!c.b;
}

/** Great-circle (orthodromic) distance in metres. */
export function haversineMeters(a: CouplePoint, b: CouplePoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Poster-style distance: thin-space thousands so long numbers stay readable
 * in the wide letter-spacing the overlay uses ("3 421 KM", not "3,421KM").
 */
export function formatCoupleDistance(meters: number, units: DistanceUnit): string {
  const value = units === 'mi' ? meters / METRES_PER_MILE : meters / 1000;
  const label = units === 'mi' ? 'MI' : 'KM';
  if (value < 1) {
    // below a full unit, metres/feet read better than "0.4 km"
    const small = units === 'mi' ? Math.round(meters / 0.3048) : Math.round(meters);
    return `${group(small)} ${units === 'mi' ? 'FT' : 'M'}`;
  }
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${group(rounded)} ${label}`;
}

function group(n: number): string {
  const [int, frac] = String(n).split('.');
  const spaced = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
  return frac ? `${spaced}.${frac}` : spaced;
}

/**
 * `b`'s longitude expressed so that going from `a` to it never crosses more
 * than half the globe — the short way round. The result can fall outside
 * [-180, 180]; MapLibre renders such coordinates fine and it keeps the line
 * from snapping back across the whole map at the antimeridian.
 */
function unwrapLng(fromLng: number, toLng: number): number {
  let lng = toLng;
  while (lng - fromLng > 180) lng -= 360;
  while (lng - fromLng < -180) lng += 360;
  return lng;
}

/** Points along the great circle between a and b (the true shortest path). */
export function geodesicPath(a: CouplePoint, b: CouplePoint, steps = 96): [number, number][] {
  const lat1 = rad(a.lat);
  const lng1 = rad(a.lng);
  const lat2 = rad(b.lat);
  const lng2 = rad(unwrapLng(a.lng, b.lng));

  const d = haversineMeters(a, b) / EARTH_R; // angular distance
  if (d < 1e-9) return [[a.lng, a.lat], [b.lng, b.lat]];

  const out: [number, number][] = [];
  const sinD = Math.sin(d);
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / sinD;
    const B = Math.sin(f * d) / sinD;
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = deg(Math.atan2(z, Math.hypot(x, y)));
    const lng = deg(Math.atan2(y, x));
    // atan2 wraps back into [-180, 180]; undo that against the previous point
    // so the drawn line stays continuous across the antimeridian
    const prev = out.length ? out[out.length - 1][0] : a.lng;
    out.push([unwrapLng(prev, lng), lat]);
  }
  return out;
}

/**
 * The bowed "flight map" arc. A quadratic Bézier whose control point sits
 * off the midpoint, perpendicular to the line and always on the upper side,
 * so two posters of the same pair curve the same way regardless of which
 * place was entered first.
 */
export function arcPath(a: CouplePoint, b: CouplePoint, steps = 96): [number, number][] {
  const x1 = a.lng;
  const y1 = a.lat;
  const x2 = unwrapLng(a.lng, b.lng);
  const y2 = b.lat;

  const dx = x2 - x1;
  const dy = y2 - y1;
  let nx = -dy;
  let ny = dx;
  if (ny < 0 || (ny === 0 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }

  const bulge = 0.22;
  const cx = (x1 + x2) / 2 + nx * bulge;
  const cy = (y1 + y2) / 2 + ny * bulge;

  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const m = 1 - t;
    out.push([
      m * m * x1 + 2 * m * t * cx + t * t * x2,
      m * m * y1 + 2 * m * t * cy + t * t * y2,
    ]);
  }
  return out;
}

export function couplePath(c: CoupleState): [number, number][] {
  if (!coupleActive(c)) return [];
  return c.curve ? arcPath(c.a, c.b) : geodesicPath(c.a, c.b);
}

function lineGeojson(c: CoupleState): FeatureCollection {
  const coords = couplePath(c);
  return {
    type: 'FeatureCollection',
    features:
      coords.length >= 2
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }]
        : [],
  };
}

function pointsGeojson(c: CoupleState): FeatureCollection {
  if (!coupleActive(c)) return { type: 'FeatureCollection', features: [] };
  // the second endpoint uses the unwrapped longitude so the marker sits at
  // the end of the line rather than a world-copy away from it
  const bLng = unwrapLng(c.a.lng, c.b.lng);
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [c.a.lng, c.a.lat] } },
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [bLng, c.b.lat] } },
    ],
  };
}

export interface CoupleRenderOpts {
  couple: CoupleState;
  /** heart color (marker color override, or the theme accent) */
  iconColor: string;
  lineColor: string;
  /** heart size in px at this map's pixel scale */
  iconSize: number;
  /** line width in px at this map's pixel scale */
  lineWidth: number;
}

/**
 * Adds (or refreshes) the couple line + endpoint hearts on a map. Shared by
 * the live preview and the hidden high-resolution export map so both draw
 * from exactly the same geometry; only the pixel sizes differ.
 */
export async function applyCoupleLayers(map: MLMap, opts: CoupleRenderOpts): Promise<void> {
  if (!map.getStyle()) return;
  const { couple, iconColor, lineColor, iconSize, lineWidth } = opts;

  if (!coupleActive(couple)) {
    removeCoupleLayers(map);
    return;
  }

  const size = Math.max(8, Math.round(iconSize));
  const iconKey = `${iconColor}|${size}`;
  if (iconKeys.get(map) !== iconKey || !map.hasImage(COUPLE_ICON)) {
    const image = await heartImage(iconColor, size);
    // the style may have been swapped (theme change) while the icon decoded
    if (!map.getStyle()) return;
    if (map.hasImage(COUPLE_ICON)) map.removeImage(COUPLE_ICON);
    map.addImage(COUPLE_ICON, image);
    iconKeys.set(map, iconKey);
  }

  const lineData = lineGeojson(couple);
  const pointData = pointsGeojson(couple);

  const src = map.getSource(COUPLE_SOURCE) as GeoJSONSource | undefined;
  if (src) {
    src.setData(lineData);
  } else {
    map.addSource(COUPLE_SOURCE, { type: 'geojson', data: lineData });
  }

  const pointSrc = map.getSource(`${COUPLE_SOURCE}-points`) as GeoJSONSource | undefined;
  if (pointSrc) {
    pointSrc.setData(pointData);
  } else {
    map.addSource(`${COUPLE_SOURCE}-points`, { type: 'geojson', data: pointData });
  }

  const dash: [number, number] = [2, 1.6];
  if (map.getLayer(COUPLE_LINE_LAYER)) {
    map.setPaintProperty(COUPLE_LINE_LAYER, 'line-color', lineColor);
    map.setPaintProperty(COUPLE_LINE_LAYER, 'line-width', lineWidth);
    // undefined resets the property to the style default (a solid line)
    map.setPaintProperty(COUPLE_LINE_LAYER, 'line-dasharray', couple.dashed ? dash : undefined);
    map.setLayoutProperty(COUPLE_LINE_LAYER, 'line-cap', couple.dashed ? 'butt' : 'round');
  } else {
    map.addLayer({
      id: COUPLE_LINE_LAYER,
      type: 'line',
      source: COUPLE_SOURCE,
      layout: { 'line-cap': couple.dashed ? 'butt' : 'round', 'line-join': 'round' },
      paint: {
        'line-color': lineColor,
        'line-width': lineWidth,
        ...(couple.dashed ? { 'line-dasharray': dash } : {}),
      },
    });
  }

  if (!map.getLayer(COUPLE_POINT_LAYER)) {
    map.addLayer({
      id: COUPLE_POINT_LAYER,
      type: 'symbol',
      source: `${COUPLE_SOURCE}-points`,
      layout: {
        'icon-image': COUPLE_ICON,
        'icon-size': 1,
        'icon-anchor': 'center',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });
  }
}

export function removeCoupleLayers(map: MLMap): void {
  if (!map.getStyle()) return;
  for (const id of [COUPLE_POINT_LAYER, COUPLE_LINE_LAYER]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [`${COUPLE_SOURCE}-points`, COUPLE_SOURCE]) {
    if (map.getSource(id)) map.removeSource(id);
  }
  if (map.hasImage(COUPLE_ICON)) map.removeImage(COUPLE_ICON);
  iconKeys.delete(map);
}

/** Rasterizes the shared heart marker path at the size this map needs. */
async function heartImage(color: string, size: number): Promise<HTMLImageElement> {
  const svg = markerSvg('heart', color, size);
  const img = new Image(size, size);
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try {
    await img.decode();
  } catch {
    // Safari can reject decode() for SVG data URLs it has already rasterized;
    // fall back to the load event so the icon still makes it onto the map
    await new Promise<void>((resolve) => {
      if (img.complete) return resolve();
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  }
  return img;
}

const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + rad(clampLat(lat)) / 2));
const clampLat = (lat: number) => Math.max(-85.05, Math.min(85.05, lat));

/**
 * Center + zoom that fit both endpoints inside a map of the given pixel size.
 * Done arithmetically rather than through `map.fitBounds` so the panel can
 * reframe the poster without reaching into the map instance.
 */
export function fitBothView(
  a: CouplePoint,
  b: CouplePoint,
  mapW: number,
  mapH: number,
  padding = 0.22
): { center: [number, number]; zoom: number } {
  const lngB = unwrapLng(a.lng, b.lng);
  const centerLng = (a.lng + lngB) / 2;

  const y1 = mercY(a.lat);
  const y2 = mercY(b.lat);
  const centerLat = deg(2 * Math.atan(Math.exp((y1 + y2) / 2)) - Math.PI / 2);

  const lngFraction = Math.abs(lngB - a.lng) / 360;
  const latFraction = Math.abs(y2 - y1) / (2 * Math.PI);

  const usableW = Math.max(64, mapW * (1 - padding));
  const usableH = Math.max(64, mapH * (1 - padding));
  const TILE = 512;

  const zoomFor = (fraction: number, px: number) =>
    fraction > 1e-9 ? Math.log2(px / (TILE * fraction)) : Infinity;

  const zoom = Math.min(zoomFor(lngFraction, usableW), zoomFor(latFraction, usableH), 17);
  return {
    center: [((centerLng + 540) % 360) - 180, clampLat(centerLat)],
    zoom: Math.max(1, Number.isFinite(zoom) ? zoom : 12),
  };
}
