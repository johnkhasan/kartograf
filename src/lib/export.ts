import { Map as MLMap, type ErrorEvent } from 'maplibre-gl';
import { buildMapStyle } from './mapStyle';
import { formatCoords } from './geocode';
import { MARKER_ICONS } from '../data/markerIcons';
import type {
  ExportSettings,
  ExportStage,
  LayerToggles,
  Layout,
  LocationInfo,
  MarkerIconId,
  PosterMarker,
  StyleOptions,
  Theme,
  UploadedMarker,
} from '../types';

export interface ExportJob {
  layout: Layout;
  theme: Theme;
  layers: LayerToggles;
  styleOpts: StyleOptions;
  location: LocationInfo;
  center: [number, number];
  zoom: number;
  /** width of the on-screen MAP element (inset area when framed) */
  previewMapWidth: number;
  markers: PosterMarker[];
  uploadedMarkers: UploadedMarker[];
  markerSize: number;
  markerColor: string | null;
  route: [number, number][];
  routeWidth: number;
  settings: ExportSettings;
  onProgress?: (stage: ExportStage) => void;
}

const MAX_EDGE = 4096;

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Geometry of the map area inside a framed poster (fractions shared with the preview CSS). */
export const FRAME_PAD = 0.05; // of width, top/left/right
export const FRAME_BOTTOM = 0.17; // of height, text band

export function frameRect(w: number, h: number, framed: boolean): FrameRect {
  if (!framed) return { x: 0, y: 0, w, h };
  const pad = Math.round(w * FRAME_PAD);
  const bottom = Math.round(h * FRAME_BOTTOM);
  return { x: pad, y: pad, w: w - pad * 2, h: h - pad - bottom };
}

export async function exportPoster(job: ExportJob): Promise<void> {
  const { layout, theme, settings, onProgress } = job;
  onProgress?.('preparing');

  let w = layout.exportWidth * (settings.scale / 2);
  let h = layout.exportHeight * (settings.scale / 2);
  const longEdge = Math.max(w, h);
  if (longEdge > MAX_EDGE) {
    const k = MAX_EDGE / longEdge;
    w *= k;
    h *= k;
  }
  w = Math.round(w);
  h = Math.round(h);

  const rect = frameRect(w, h, job.styleOpts.frame);

  // Hidden container for the high-res render (sized to the map area only)
  const container = document.createElement('div');
  container.style.cssText = `position:fixed;left:-100000px;top:0;width:${rect.w}px;height:${rect.h}px;`;
  document.body.appendChild(container);

  const zoomOffset = Math.log2(rect.w / job.previewMapWidth);

  const map = new MLMap({
    container,
    style: buildMapStyle(theme, job.layers),
    center: job.center,
    zoom: job.zoom + zoomOffset,
    interactive: false,
    attributionControl: false,
    pixelRatio: 1,
    canvasContextAttributes: { preserveDrawingBuffer: true },
    fadeDuration: 0,
  });

  try {
    onProgress?.('rendering');
    await new Promise<void>((resolve, reject) => {
      map.once('error', (e: ErrorEvent) => reject(e.error ?? new Error('Map render failed')));
      map.on('load', () => {
        if (job.route.length >= 2) {
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: job.route },
            },
          });
          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            paint: {
              'line-color': theme.accent,
              'line-width': job.routeWidth * (rect.w / job.previewMapWidth),
            },
            layout: { 'line-cap': 'round', 'line-join': 'round' },
          });
        }
        map.once('idle', () => resolve());
      });
    });

    // Give tiles a beat to settle
    await new Promise((r) => setTimeout(r, 300));

    onProgress?.('compositing');
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d')!;

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(map.getCanvas(), rect.x, rect.y, rect.w, rect.h);

    if (job.styleOpts.frame) {
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = Math.max(1, w * 0.0015);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }

    await drawMarkers(ctx, map, job, rect);
    await drawOverlay(ctx, job, w, h);

    onProgress?.('saving');
    const slug = job.location.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'poster';
    const base = `kartograf-${slug}-${layout.id}`;

    if (settings.format === 'pdf') {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: w >= h ? 'landscape' : 'portrait',
        unit: 'px',
        format: [w, h],
        compress: true,
      });
      pdf.addImage(out.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, w, h);
      pdf.save(`${base}.pdf`);
      return;
    }

    const mime = settings.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, mime, 0.92));
    if (!blob) throw new Error('Canvas export failed');

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${base}.${settings.format === 'jpeg' ? 'jpg' : 'png'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  } finally {
    map.remove();
    container.remove();
  }
}

async function drawMarkers(
  ctx: CanvasRenderingContext2D,
  map: MLMap,
  job: ExportJob,
  rect: FrameRect
) {
  const scale = rect.w / job.previewMapWidth;
  const color = job.markerColor ?? job.theme.accent;

  const uploadImages = new Map<string, HTMLImageElement>();
  const uploadIds = new Set(
    job.markers.filter((m) => m.icon.startsWith('up:')).map((m) => m.icon.slice(3))
  );
  await Promise.all(
    [...uploadIds].map(async (id) => {
      const up = job.uploadedMarkers.find((u) => u.id === id);
      if (!up) return;
      const img = new Image();
      img.src = up.dataUrl;
      await new Promise((res) => {
        img.onload = res;
        img.onerror = res;
      });
      uploadImages.set(id, img);
    })
  );

  for (const m of job.markers) {
    const p = map.project([m.lng, m.lat]);
    const size = job.markerSize * scale;
    const cx = rect.x + p.x;
    const cy = rect.y + p.y;

    if (m.icon.startsWith('up:')) {
      const img = uploadImages.get(m.icon.slice(3));
      if (!img || !img.naturalWidth) continue;
      const ar = img.naturalWidth / img.naturalHeight;
      const dw = ar >= 1 ? size : size * ar;
      const dh = ar >= 1 ? size / ar : size;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
      continue;
    }

    const def = MARKER_ICONS[m.icon as MarkerIconId];
    if (!def) continue;
    const path = new Path2D(def.path);
    ctx.save();
    ctx.translate(cx - size / 2, cy - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color;
    ctx.fill(path);
    ctx.restore();
  }
}

async function drawOverlay(
  ctx: CanvasRenderingContext2D,
  job: ExportJob,
  w: number,
  h: number
) {
  const { styleOpts, theme, location } = job;
  const font = styleOpts.font;
  const framed = styleOpts.frame;

  const title = (styleOpts.customTitle || location.name).toUpperCase();
  const subtitle = (styleOpts.customSubtitle || location.country).toUpperCase();

  const cityPx = w * 0.052;
  const countryPx = w * 0.022;
  const coordsPx = w * 0.018;

  await Promise.all([
    document.fonts.load(`700 ${cityPx}px "${font}"`),
    document.fonts.load(`400 ${countryPx}px "${font}"`),
  ]).catch(() => {});

  if (!framed && styleOpts.showOverlay) {
    const grad = ctx.createLinearGradient(0, h * 0.62, 0, h);
    grad.addColorStop(0, hexA(theme.bg, 0));
    grad.addColorStop(0.55, hexA(theme.bg, 0.75));
    grad.addColorStop(1, hexA(theme.bg, 0.96));
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cx = w / 2;
  let y = h - h * (framed ? 0.035 : 0.055);

  if (styleOpts.showCoords) {
    ctx.font = `400 ${coordsPx}px "${font}", sans-serif`;
    setLetterSpacing(ctx, coordsPx * 0.18);
    ctx.fillStyle = hexA(theme.text, 0.75);
    ctx.fillText(formatCoords(location.lat, location.lng), cx, y);
    y -= coordsPx * 2.1;
  }

  if (styleOpts.showCountry && subtitle) {
    ctx.font = `400 ${countryPx}px "${font}", sans-serif`;
    setLetterSpacing(ctx, countryPx * 0.35);
    ctx.fillStyle = hexA(theme.text, 0.85);
    ctx.fillText(subtitle, cx, y);
    // accent underline
    ctx.fillStyle = theme.accent;
    ctx.fillRect(cx - w * 0.06, y + countryPx * 0.55, w * 0.12, Math.max(1.5, w * 0.0018));
    y -= countryPx * 2.6;
  }

  if (styleOpts.showCity) {
    ctx.font = `700 ${cityPx}px "${font}", sans-serif`;
    setLetterSpacing(ctx, cityPx * 0.32);
    ctx.fillStyle = theme.text;
    ctx.fillText(title, cx, y);
  }

  setLetterSpacing(ctx, 0);
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`;
}

function hexA(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
