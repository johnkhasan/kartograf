import { Map as MLMap, type ErrorEvent } from 'maplibre-gl';
import { buildMapStyle } from './mapStyle';
import { applyCoupleLayers, coupleActive } from './couple';
import { posterLines, posterScrim, posterTextBox } from './posterText';
import { MARKER_ICONS } from '../data/markerIcons';
import type {
  CoupleState,
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
  couple: CoupleState;
  settings: ExportSettings;
  /** 'download' saves the file; 'file' hands it back instead, for sharing */
  deliver?: 'download' | 'file';
  onProgress?: (stage: ExportStage) => void;
}

const MAX_EDGE = 4096;

/** Final pixel dimensions for a layout at a given export scale (after the 4096px cap). */
export function outputDims(layout: Layout, scale: number): { w: number; h: number } {
  const w = Math.round(layout.exportWidth * (scale / 2));
  const h = Math.round(layout.exportHeight * (scale / 2));
  const cap = Math.max(w, h) > MAX_EDGE ? MAX_EDGE / Math.max(w, h) : 1;
  return { w: Math.round(w * cap), h: Math.round(h * cap) };
}

export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Geometry of the map area inside a framed poster (fractions shared with the preview CSS). */
export const FRAME_PAD = 0.05; // of width, top/left/right
export const FRAME_BOTTOM = 0.17; // of height, text band

/**
 * The map inset of a framed poster. The wide band is the one the text sits
 * in, so it moves to the top when the text is anchored there — otherwise a
 * top-anchored title would land on the map inside the frame.
 */
export function frameRect(
  w: number,
  h: number,
  framed: boolean,
  textPos: StyleOptions['textPos'] = 'bottom'
): FrameRect {
  if (!framed) return { x: 0, y: 0, w, h };
  const pad = Math.round(w * FRAME_PAD);
  const band = Math.round(h * FRAME_BOTTOM);
  const top = textPos === 'top' ? band : pad;
  const bottom = textPos === 'top' ? pad : band;
  return { x: pad, y: top, w: w - pad * 2, h: h - top - bottom };
}

export async function exportPoster(job: ExportJob): Promise<File | null> {
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

  const rect = frameRect(w, h, job.styleOpts.frame, job.styleOpts.textPos);

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

    // the couple layers need the heart icon rasterized first, so they are
    // added after the style has loaded rather than inside the load handler
    await applyCoupleLayers(map, {
      couple: job.couple,
      iconColor: job.markerColor ?? theme.accent,
      lineColor: theme.accent,
      iconSize: job.markerSize * (rect.w / job.previewMapWidth),
      lineWidth: job.couple.lineWidth * (rect.w / job.previewMapWidth),
    });
    map.triggerRepaint();
    await waitIdle(map, 2000);

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
    // a couple poster is about the pair, so name the file after both places
    const named = coupleActive(job.couple)
      ? `${job.couple.a.name}-${job.couple.b.name}`
      : job.location.name;
    const slug = named.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'poster';
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
      if (job.deliver === 'file') {
        return new File([pdf.output('blob')], `${base}.pdf`, { type: 'application/pdf' });
      }
      pdf.save(`${base}.pdf`);
      return null;
    }

    const mime = settings.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, mime, 0.92));
    if (!blob) throw new Error('Canvas export failed');

    const name = `${base}.${settings.format === 'jpeg' ? 'jpg' : 'png'}`;
    if (job.deliver === 'file') return new File([blob], name, { type: mime });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return null;
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

  const { title, subtitle, meta } = posterLines({ styleOpts, location, couple: job.couple });

  const cityPx = w * 0.052;
  const countryPx = w * 0.022;
  const coordsPx = w * 0.018;

  await Promise.all([
    document.fonts.load(`700 ${cityPx}px "${font}"`),
    document.fonts.load(`400 ${countryPx}px "${font}"`),
  ]).catch(() => {});

  if (!framed && styleOpts.showOverlay) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    for (const stop of posterScrim(styleOpts)) {
      grad.addColorStop(Math.max(0, Math.min(1, stop.at)), hexA(theme.bg, stop.alpha));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Drawn bottom-up, so the block has to be measured before it can be
  // anchored anywhere other than the bottom edge.
  const stack = [
    meta && {
      text: meta,
      size: coordsPx,
      weight: 400,
      alpha: 0.75,
      spacing: 0.18,
      gapAbove: coordsPx * 2.1,
      underline: false,
    },
    subtitle && {
      text: subtitle,
      size: countryPx,
      weight: 400,
      alpha: 0.85,
      spacing: 0.35,
      gapAbove: countryPx * 2.6,
      underline: true,
    },
    title && {
      text: title,
      size: cityPx,
      weight: 700,
      alpha: 1,
      spacing: 0.32,
      gapAbove: 0,
      underline: false,
    },
  ].filter(Boolean) as Array<{
    text: string;
    size: number;
    weight: number;
    alpha: number;
    spacing: number;
    gapAbove: number;
    underline: boolean;
  }>;

  if (!stack.length) {
    setLetterSpacing(ctx, 0);
    return;
  }

  // distance from the bottom baseline to the top line's baseline, plus that
  // line's cap height — i.e. how tall the block reads
  const advance = stack.slice(0, -1).reduce((sum, item) => sum + item.gapAbove, 0);
  const blockHeight = advance + stack[stack.length - 1].size;

  const box = posterTextBox({ styleOpts, width: w, height: h });
  // the preview anchors a CSS box; the canvas anchors the bottom baseline,
  // which sits a little inside that box — the edge fractions differ by that
  // descent, as they did before this was configurable
  const bottomEdge = box.edge + (framed ? h * 0.009 : h * 0.013);

  let y =
    box.pos === 'bottom'
      ? h - bottomEdge
      : box.pos === 'top'
        ? box.edge + blockHeight
        : h / 2 + blockHeight / 2 + box.centerShift;

  ctx.textAlign = box.align === 'center' ? 'center' : box.align;
  ctx.textBaseline = 'alphabetic';
  const cx =
    box.align === 'left' ? box.sidePad : box.align === 'right' ? w - box.sidePad : w / 2;

  for (const item of stack) {
    ctx.font = `${item.weight} ${item.size}px "${font}", sans-serif`;
    setLetterSpacing(ctx, item.size * item.spacing);
    ctx.fillStyle = item.alpha === 1 ? theme.text : hexA(theme.text, item.alpha);
    ctx.fillText(item.text, cx, y);

    if (item.underline) {
      // matches the preview, where the rule is the subtitle's own underline
      // and therefore exactly as wide as the text
      const tw = ctx.measureText(item.text).width;
      const x = box.align === 'left' ? cx : box.align === 'right' ? cx - tw : cx - tw / 2;
      ctx.fillStyle = theme.accent;
      ctx.fillRect(x, y + item.size * 0.55, tw, Math.max(1.5, w * 0.0018));
    }

    y -= item.gapAbove;
  }

  setLetterSpacing(ctx, 0);
}

/** Resolves on the map's next idle, or after `ms` if it never settles. */
function waitIdle(map: MLMap, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), ms);
    map.once('idle', () => {
      clearTimeout(timer);
      resolve();
    });
  });
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
