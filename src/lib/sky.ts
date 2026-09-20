import type { StarmapState, Theme } from '../types';

/**
 * The night sky over a place at a moment, drawn as a circular chart.
 *
 * Star positions are fixed in the celestial sphere; what changes with time and
 * latitude is which part of it is above the horizon and how it is turned. So
 * the whole poster is: rotate the catalogue into the observer's frame, keep
 * what is above the horizon, and project it onto a disc.
 *
 * Catalogue: d3-celestial (BSD-3) — magnitude 6 stars and the western
 * constellation lines, packed into flat arrays by scripts/fetch-stars.py.
 */
export interface SkyData {
  /** ra, dec, mag triples */
  stars: number[];
  /** flattened [ra, dec, ra, dec, ...] polylines */
  lines: number[][];
}

let cache: Promise<SkyData | null> | null = null;

export function loadSky(): Promise<SkyData | null> {
  if (!cache) {
    cache = fetch('/sky.json')
      .then((r) => (r.ok ? (r.json() as Promise<SkyData>) : null))
      .catch(() => null);
  }
  return cache;
}

const RAD = Math.PI / 180;

/**
 * Greenwich mean sidereal time in degrees — how far the celestial sphere has
 * turned past Greenwich at this instant.
 */
function siderealDegrees(date: Date): number {
  const julian = date.getTime() / 86400000 + 2440587.5;
  const t = (julian - 2451545) / 36525;
  const gmst =
    280.46061837 +
    360.98564736629 * (julian - 2451545) +
    0.000387933 * t * t -
    (t * t * t) / 38710000;
  return ((gmst % 360) + 360) % 360;
}

export interface SkyProjection {
  /** local sidereal time, degrees */
  lst: number;
  sinLat: number;
  cosLat: number;
  radius: number;
  cx: number;
  cy: number;
}

export function skyProjection(
  state: StarmapState,
  lat: number,
  lng: number,
  width: number,
  height: number
): SkyProjection {
  const when = new Date(state.when);
  const lst = (siderealDegrees(Number.isNaN(when.getTime()) ? new Date() : when) + lng + 360) % 360;
  return {
    lst,
    sinLat: Math.sin(lat * RAD),
    cosLat: Math.cos(lat * RAD),
    radius: (Math.min(width, height) / 2) * state.size,
    cx: width / 2,
    cy: height / 2,
  };
}

/**
 * A catalogue position on the chart, or null when it is below the horizon.
 * Stereographic from the zenith: the horizon stays a circle and shapes near
 * the centre keep their proportions, which is what makes constellations
 * recognisable on a poster.
 */
export function project(
  p: SkyProjection,
  ra: number,
  dec: number
): { x: number; y: number } | null {
  const hourAngle = (p.lst - ra) * RAD;
  const d = dec * RAD;
  const sinDec = Math.sin(d);
  const cosDec = Math.cos(d);

  const sinAlt = p.sinLat * sinDec + p.cosLat * cosDec * Math.cos(hourAngle);
  if (sinAlt <= 0) return null; // below the horizon

  const alt = Math.asin(sinAlt);
  const az = Math.atan2(
    -Math.sin(hourAngle) * cosDec,
    sinDec * p.cosLat - cosDec * p.sinLat * Math.cos(hourAngle)
  );

  // zenith at the centre, horizon at the rim
  const r = (p.radius * Math.tan((Math.PI / 2 - alt) / 2)) / Math.tan(Math.PI / 4);
  return { x: p.cx + r * Math.sin(az), y: p.cy - r * Math.cos(az) };
}

export interface SkyStyle {
  theme: Theme;
  state: StarmapState;
}

/**
 * Paints the chart onto a canvas. The preview and the export both call this,
 * at their own sizes, so the poster on screen is the poster in the file.
 */
export function drawSky(
  ctx: CanvasRenderingContext2D,
  data: SkyData,
  { theme, state }: SkyStyle,
  lat: number,
  lng: number,
  width: number,
  height: number
) {
  const p = skyProjection(state, lat, lng, width, height);

  ctx.save();
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);

  // the horizon
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (state.showGrid) {
    ctx.strokeStyle = hexA(theme.text, 0.12);
    ctx.lineWidth = Math.max(0.5, width * 0.0008);
    for (let alt = 15; alt < 90; alt += 15) {
      const r = (p.radius * Math.tan(((90 - alt) / 2) * RAD)) / Math.tan(Math.PI / 4);
      ctx.beginPath();
      ctx.arc(p.cx, p.cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let az = 0; az < 360; az += 30) {
      ctx.beginPath();
      ctx.moveTo(p.cx, p.cy);
      ctx.lineTo(
        p.cx + p.radius * Math.sin(az * RAD),
        p.cy - p.radius * Math.cos(az * RAD)
      );
      ctx.stroke();
    }
  }

  if (state.showConstellations) {
    ctx.strokeStyle = hexA(theme.accent, 0.55);
    ctx.lineWidth = Math.max(0.6, width * 0.0011);
    ctx.lineCap = 'round';
    for (const line of data.lines) {
      let drawing = false;
      ctx.beginPath();
      for (let i = 0; i < line.length; i += 2) {
        const point = project(p, line[i], line[i + 1]);
        if (!point) {
          // a line that leaves the visible sky is simply cut there
          drawing = false;
          continue;
        }
        if (drawing) ctx.lineTo(point.x, point.y);
        else ctx.moveTo(point.x, point.y);
        drawing = true;
      }
      ctx.stroke();
    }
  }

  ctx.fillStyle = theme.text;
  const scale = width * 0.0016 * state.starSize;
  for (let i = 0; i < data.stars.length; i += 3) {
    const point = project(p, data.stars[i], data.stars[i + 1]);
    if (!point) continue;
    const mag = data.stars[i + 2];
    // magnitudes run backwards: 6 is barely visible, -1 is Sirius
    const r = Math.max(scale * 0.25, scale * (1.9 - mag * 0.28));
    ctx.globalAlpha = Math.max(0.35, Math.min(1, 1.25 - mag * 0.11));
    ctx.beginPath();
    ctx.arc(point.x, point.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // the rim, drawn outside the clip so it isn't cut in half
  ctx.save();
  ctx.strokeStyle = hexA(theme.accent, 0.8);
  ctx.lineWidth = Math.max(1, width * 0.0022);
  ctx.beginPath();
  ctx.arc(p.cx, p.cy, p.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function hexA(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(
    n.slice(4, 6),
    16
  )},${alpha})`;
}
