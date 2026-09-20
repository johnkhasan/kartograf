import { Map as MLMap, type ErrorEvent } from 'maplibre-gl';
import { buildMapStyle } from './mapStyle';
import { applyCoupleLayers, coupleActive } from './couple';
import { borderRules, grainSize, grainTile } from './grain';
import { collageGeometry } from '../components/CollageMaps';
import { drawSky, loadSky } from './sky';
import { HEART, heartOutline, pdfFontSet, pdfSafeText, type PdfFontSet } from './pdfFonts';
import {
  posterLines,
  posterScrim,
  posterTextBox,
  posterTextIsEmpty,
  posterTextMetrics,
} from './posterText';
import { MARKER_ICONS } from '../data/markerIcons';
import type {
  StarmapState,
  CollageState,
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
  collage: CollageState;
  starmap: StarmapState;
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
  textPos: StyleOptions['textPos'] = 'bottom',
  /** no text to leave room for — the map takes the whole inset */
  uniform = false
): FrameRect {
  if (!framed) return { x: 0, y: 0, w, h };
  const pad = Math.round(w * FRAME_PAD);
  if (uniform) return { x: pad, y: pad, w: w - pad * 2, h: h - pad * 2 };
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

  const rect = frameRect(
    w,
    h,
    job.styleOpts.frame,
    job.styleOpts.textPos,
    // a captioned collage with no poster text has nothing to reserve a band for
    posterTextIsEmpty({
      styleOpts: job.styleOpts,
      location: job.location,
      couple: job.couple,
      collage: job.collage,
      starmap: job.starmap,
    })
  );

  // Hidden container for the high-res render (sized to the map area only)
  const container = document.createElement('div');
  container.style.cssText = `position:fixed;left:-100000px;top:0;width:${rect.w}px;height:${rect.h}px;`;
  document.body.appendChild(container);

  const zoomOffset = Math.log2(rect.w / job.previewMapWidth);

  if (job.starmap.enabled) {
    try {
      const out = await exportSky(job, w, h, rect);
      return await deliver(out, job, w, h, null);
    } finally {
      container.remove();
    }
  }

  if (job.collage.enabled && job.collage.cells.length >= 2) {
    try {
      const out = await exportCollage(job, w, h, rect, zoomOffset, container);
      // a collage has no single map to set vector text against, and its
      // panels already carry their own captions
      return await deliver(out, job, w, h, null);
    } finally {
      container.remove();
    }
  }

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

    // For a PDF the overlay is set as real text rather than baked into the
    // image, but only when the embedded subset can render every character —
    // otherwise it falls back to being drawn on the canvas as before.
    const plan = overlayPlan(job, w, h);
    const vectorText =
      settings.format === 'pdf' && plan
        ? await pdfFontSet(job.styleOpts.font, plan.items.map((i) => i.text))
        : null;

    await drawOverlay(ctx, job, w, h, { text: !vectorText });
    await drawGrain(ctx, job, w, h);
    drawBorder(ctx, job, w, h);

    return await deliver(out, job, w, h, vectorText && plan ? { plan, fonts: vectorText } : null);
  } finally {
    map.remove();
    container.remove();
  }
}

/**
 * A print-ready PDF.
 *
 * The page is the sheet's real physical size (A4 is 210x297mm, not a page
 * measured in pixels), so a print shop gets what the format claims. The
 * poster goes in as lossless PNG: JPEG at this size leaves visible artefacts
 * around the lettering, and a poster is mostly flat colour, which PNG packs
 * well anyway.
 *
 * With bleed the page grows by the bleed on every side and the artwork is
 * scaled to fill it — about 1.4% at A4 with 3mm, which is imperceptible and
 * keeps the composition intact rather than re-rendering a wider slice of map.
 * Crop marks go in the bleed margin, so a trimming error leaves poster rather
 * than a white hairline. Screen formats have no physical size, so those keep
 * a page measured in pixels.
 */
async function buildPdf(
  canvas: HTMLCanvasElement,
  job: ExportJob,
  w: number,
  h: number,
  vector: { plan: OverlayPlan; fonts: PdfFontSet } | null
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const { layout } = job;
  const image = canvas.toDataURL('image/png');

  const sheetW = layout.widthMm;
  const sheetH = layout.heightMm;

  if (!sheetW || !sheetH) {
    const pdf = new jsPDF({
      orientation: w >= h ? 'landscape' : 'portrait',
      unit: 'px',
      format: [w, h],
      compress: true,
    });
    pdf.addImage(image, 'PNG', 0, 0, w, h);
    if (vector) writePdfText(pdf, vector, job, 1);
    return pdf.output('blob');
  }

  const bleed = Math.max(0, job.settings.bleedMm);
  const pageW = sheetW + bleed * 2;
  const pageH = sheetH + bleed * 2;

  const pdf = new jsPDF({
    orientation: pageW >= pageH ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pageW, pageH],
    compress: true,
  });

  // the artwork covers the trim box plus the bleed on every side
  pdf.addImage(image, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
  if (vector) writePdfText(pdf, vector, job, pageW / w);

  if (bleed > 0) {
    const len = Math.min(bleed, 4);
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.15);
    const marks: Array<[number, number, number, number]> = [
      // each trim corner gets one horizontal and one vertical mark, drawn
      // out in the bleed margin so they fall away when the sheet is cut
      [0, bleed, len, bleed],
      [bleed, 0, bleed, len],
      [pageW - len, bleed, pageW, bleed],
      [pageW - bleed, 0, pageW - bleed, len],
      [0, pageH - bleed, len, pageH - bleed],
      [bleed, pageH - len, bleed, pageH],
      [pageW - len, pageH - bleed, pageW, pageH - bleed],
      [pageW - bleed, pageH - len, pageW - bleed, pageH],
    ];
    for (const [x1, y1, x2, y2] of marks) pdf.line(x1, y1, x2, y2);
  }

  return pdf.output('blob');
}

/**
 * A collage poster: each panel is rendered on its own, one at a time.
 *
 * They go through the same hidden container in turn rather than all at once —
 * four simultaneous WebGL contexts at export resolution is a lot to ask of a
 * phone, and the panels don't need to be alive together to be composited.
 */
/**
 * Turns the finished canvas into the file the caller asked for — saved to the
 * downloads folder, or handed back for the share sheet. Shared by the single
 * map and the collage, which differ only in how the canvas is painted.
 */
async function deliver(
  out: HTMLCanvasElement,
  job: ExportJob,
  w: number,
  h: number,
  vector: { plan: OverlayPlan; fonts: PdfFontSet } | null
): Promise<File | null> {
  const { settings, layout } = job;
  job.onProgress?.('saving');

  // a couple poster is about the pair, so name the file after both places
  const named = coupleActive(job.couple)
    ? `${job.couple.a.name}-${job.couple.b.name}`
    : job.collage.enabled && job.collage.cells.length >= 2
      ? job.collage.cells.map((c) => c.location.name).join('-')
      : job.location.name;
  const slug = named.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'poster';
  const base = `kartograf-${slug}-${layout.id}`;

  if (settings.format === 'pdf') {
    const blob = await buildPdf(out, job, w, h, vector);
    if (job.deliver === 'file') {
      return new File([blob], `${base}.pdf`, { type: 'application/pdf' });
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${base}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
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
}

/** A sky poster: no map at all, just the chart and the usual overlay. */
async function exportSky(
  job: ExportJob,
  w: number,
  h: number,
  rect: FrameRect
): Promise<HTMLCanvasElement> {
  job.onProgress?.('rendering');
  const data = await loadSky();

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = job.theme.bg;
  ctx.fillRect(0, 0, w, h);

  if (data) {
    ctx.save();
    ctx.translate(rect.x, rect.y);
    drawSky(
      ctx,
      data,
      { theme: job.theme, state: job.starmap },
      job.location.lat,
      job.location.lng,
      rect.w,
      rect.h
    );
    ctx.restore();
  }

  job.onProgress?.('compositing');
  if (job.styleOpts.frame) {
    ctx.strokeStyle = job.theme.accent;
    ctx.lineWidth = Math.max(1, w * 0.0015);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }

  await drawOverlay(ctx, job, w, h);
  await drawGrain(ctx, job, w, h);
  drawBorder(ctx, job, w, h);
  return out;
}

async function exportCollage(
  job: ExportJob,
  w: number,
  h: number,
  rect: FrameRect,
  zoomOffset: number,
  container: HTMLDivElement
): Promise<HTMLCanvasElement> {
  const { theme, collage } = job;
  const geometry = collageGeometry(
    collage.cells.length,
    collage.direction,
    collage.gap,
    rect.w,
    rect.h
  );

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);

  job.onProgress?.('rendering');

  for (const [i, cell] of collage.cells.entries()) {
    const panel = geometry.rects[i];
    if (!panel) continue;

    container.style.width = `${panel.w}px`;
    container.style.height = `${panel.h}px`;

    const map = new MLMap({
      container,
      style: buildMapStyle(theme, job.layers),
      center: cell.center,
      zoom: cell.zoom + zoomOffset,
      interactive: false,
      attributionControl: false,
      pixelRatio: 1,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      fadeDuration: 0,
    });

    try {
      await new Promise<void>((resolve, reject) => {
        map.once('error', (e: ErrorEvent) => reject(e.error ?? new Error('Map render failed')));
        map.on('load', () => map.once('idle', () => resolve()));
      });
      await new Promise((r) => setTimeout(r, 250));
      ctx.drawImage(map.getCanvas(), rect.x + panel.x, rect.y + panel.y, panel.w, panel.h);
    } finally {
      map.remove();
    }

    if (collage.showLabels) {
      drawCollageLabel(ctx, job, cell.label || cell.location.name, {
        x: rect.x + panel.x,
        y: rect.y + panel.y,
        w: panel.w,
        h: panel.h,
      }, geometry.labelPx);
    }
  }

  job.onProgress?.('compositing');
  if (job.styleOpts.frame) {
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = Math.max(1, w * 0.0015);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }

  await drawOverlay(ctx, job, w, h);
  await drawGrain(ctx, job, w, h);
  drawBorder(ctx, job, w, h);
  return out;
}

/** The caption under a collage panel, haloed the way the preview draws it. */
function drawCollageLabel(
  ctx: CanvasRenderingContext2D,
  job: ExportJob,
  text: string,
  panel: FrameRect,
  size: number
) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `500 ${size}px "${job.styleOpts.font}", sans-serif`;
  setLetterSpacing(ctx, size * 0.22);
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.5;
  ctx.strokeStyle = job.theme.bg;
  const x = panel.x + panel.w / 2;
  const y = panel.y + panel.h - panel.h * 0.04;
  const label = text.toUpperCase();
  ctx.strokeText(label, x, y);
  ctx.fillStyle = job.theme.text;
  ctx.fillText(label, x, y);
  setLetterSpacing(ctx, 0);
  ctx.restore();
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

  drawMarkerLabels(ctx, map, job, rect);
}

/**
 * Captions under the markers, drawn after every icon so a label is never
 * covered by a neighbouring pin. The halo keeps them readable over busy map
 * detail, matching the text-shadow the preview uses.
 */
function drawMarkerLabels(
  ctx: CanvasRenderingContext2D,
  map: MLMap,
  job: ExportJob,
  rect: FrameRect
) {
  const labelled = job.markers.filter((m) => m.label?.trim());
  if (!labelled.length) return;

  const scale = rect.w / job.previewMapWidth;
  const size = Math.max(7, rect.w * 0.016 * job.styleOpts.textScale);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `500 ${size}px "${job.styleOpts.font}", sans-serif`;
  setLetterSpacing(ctx, size * 0.12);
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.5;
  ctx.strokeStyle = job.theme.bg;

  for (const m of labelled) {
    const p = map.project([m.lng, m.lat]);
    const x = rect.x + p.x;
    const y = rect.y + p.y + job.markerSize * scale * 0.62;
    ctx.strokeText(m.label, x, y);
    ctx.fillStyle = job.theme.text;
    ctx.fillText(m.label, x, y);
  }

  setLetterSpacing(ctx, 0);
  ctx.restore();
}

export interface OverlayItem {
  text: string;
  size: number;
  weight: number;
  alpha: number;
  tracking: number;
  /** baseline position in canvas pixels */
  baselineY: number;
  rule: boolean;
}

export interface OverlayPlan {
  items: OverlayItem[];
  /** anchor x for the chosen alignment */
  x: number;
  align: 'left' | 'center' | 'right';
}

/**
 * Where every line of the poster text lands, in canvas pixels. Shared by the
 * canvas painter and the PDF writer so a vector-set poster sits exactly where
 * the raster one did.
 */
export function overlayPlan(job: ExportJob, w: number, h: number): OverlayPlan | null {
  const { styleOpts, location } = job;
  const framed = styleOpts.frame;
  const { title, subtitle, meta } = posterLines({
    styleOpts,
    location,
    couple: job.couple,
    collage: job.collage,
    starmap: job.starmap,
  });
  const metrics = posterTextMetrics(styleOpts, w, { title, subtitle, meta });

  // built bottom-up, so the block has to be measured before it can be
  // anchored anywhere other than the bottom edge
  const stack = [
    meta && {
      text: meta,
      size: metrics.meta.size,
      weight: 400,
      alpha: 0.75,
      tracking: metrics.meta.tracking,
      gapAbove: metrics.meta.size * 2.1,
      rule: false,
    },
    subtitle && {
      text: subtitle,
      size: metrics.subtitle.size,
      weight: 400,
      alpha: 0.85,
      tracking: metrics.subtitle.tracking,
      gapAbove: metrics.subtitle.size * 2.6,
      rule: styleOpts.divider !== 'none',
    },
    title && {
      text: title,
      size: metrics.title.size,
      weight: 700,
      alpha: 1,
      tracking: metrics.title.tracking,
      gapAbove: 0,
      rule: false,
    },
  ].filter(Boolean) as Array<Omit<OverlayItem, 'baselineY'> & { gapAbove: number }>;

  if (!stack.length) return null;

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

  const items: OverlayItem[] = [];
  for (const item of stack) {
    items.push({ ...item, baselineY: y });
    y -= item.gapAbove;
  }

  return {
    items,
    align: box.align,
    x: box.align === 'left' ? box.sidePad : box.align === 'right' ? w - box.sidePad : w / 2,
  };
}

/** The legibility scrim, without any text. */
function drawScrim(ctx: CanvasRenderingContext2D, job: ExportJob, w: number, h: number) {
  const { styleOpts, theme } = job;
  if (styleOpts.frame || !styleOpts.showOverlay) return;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  for (const stop of posterScrim(styleOpts)) {
    grad.addColorStop(Math.max(0, Math.min(1, stop.at)), hexA(theme.bg, stop.alpha));
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

async function drawOverlay(
  ctx: CanvasRenderingContext2D,
  job: ExportJob,
  w: number,
  h: number,
  options: { text?: boolean } = {}
) {
  const { styleOpts, theme } = job;
  const font = styleOpts.font;
  const metrics = posterTextMetrics(styleOpts, w);  // sizes only, for font preloading

  await Promise.all([
    document.fonts.load(`700 ${metrics.title.size}px "${font}"`),
    document.fonts.load(`400 ${metrics.subtitle.size}px "${font}"`),
  ]).catch(() => {});

  drawScrim(ctx, job, w, h);
  if (options.text === false) return;

  const plan = overlayPlan(job, w, h);
  if (!plan) return;

  ctx.textAlign = plan.align;
  ctx.textBaseline = 'alphabetic';

  for (const item of plan.items) {
    ctx.font = `${item.weight} ${item.size}px "${font}", sans-serif`;
    setLetterSpacing(ctx, item.tracking);
    ctx.fillStyle = item.alpha === 1 ? theme.text : hexA(theme.text, item.alpha);
    ctx.fillText(item.text, plan.x, item.baselineY);

    if (item.rule) {
      if (styleOpts.divider === 'dots') {
        // the preview stacks the dots as their own row between the subtitle
        // and the line below it; on the canvas that is just under this
        // baseline, well clear of the next line's
        setLetterSpacing(ctx, item.size * 0.5);
        ctx.fillStyle = theme.accent;
        ctx.fillText('···', plan.x, item.baselineY + item.size * 0.95);
      } else {
        // matches the preview, where the rule is the subtitle's own underline
        // and therefore exactly as wide as the text
        const tw = ctx.measureText(item.text).width;
        const x =
          plan.align === 'left' ? plan.x : plan.align === 'right' ? plan.x - tw : plan.x - tw / 2;
        ctx.fillStyle = theme.accent;
        ctx.fillRect(x, item.baselineY + item.size * 0.55, tw, Math.max(1.5, w * 0.0018));
      }
    }
  }

  setLetterSpacing(ctx, 0);
}

type Pdf = import('jspdf').jsPDF;

const PDF_FONT_ID = 'poster';

/**
 * Sets the poster's headline text as real text in the PDF, so it stays sharp
 * at any size instead of being pixels in a picture.
 *
 * Positions come from the same plan the canvas painter uses, converted from
 * export pixels to the page's own unit by `k`. Widths are measured including
 * the trailing letter space, which is what the canvas does — so a vector PDF
 * and a PNG of the same poster line up.
 */
function writePdfText(
  pdf: Pdf,
  vector: { plan: OverlayPlan; fonts: PdfFontSet },
  job: ExportJob,
  k: number
) {
  const { plan, fonts } = vector;
  const { theme, styleOpts } = job;
  const PT_PER_UNIT = 72 / 25.4;
  const toPt = (px: number) => px * k * PT_PER_UNIT;

  for (const face of fonts.faces) {
    pdf.addFileToVFS(face.fileName, face.data);
    pdf.addFont(face.fileName, PDF_FONT_ID, face.weight >= 600 ? 'bold' : 'normal');
  }

  const text = rgb(theme.text);
  const accent = rgb(theme.accent);
  const heart = heartOutline();

  for (const item of plan.items) {
    pdf.setFont(PDF_FONT_ID, item.weight >= 600 ? 'bold' : 'normal');
    // jsPDF sizes type in points whatever the page unit is
    pdf.setFontSize(toPt(item.size));
    const tracking = item.tracking * k;
    pdf.setCharSpace(tracking);
    pdf.setTextColor(text[0], text[1], text[2]);
    if (item.alpha < 1) pdf.setGState(pdf.GState({ opacity: item.alpha }));

    const size = item.size * k;
    const baseline = item.baselineY * k;
    const runs = pdfSafeText(fonts.entry, item.text).split(HEART);
    const heartWidth = heart.length ? size * 0.66 : 0;
    const width =
      runs.reduce((sum, run) => sum + pdf.getTextWidth(run) + tracking * run.length, 0) +
      heartWidth * (runs.length - 1);

    let x = plan.align === 'left' ? plan.x * k : plan.align === 'right' ? plan.x * k - width : plan.x * k - width / 2;

    runs.forEach((run, i) => {
      if (run) {
        pdf.text(run, x, baseline, { align: 'left', baseline: 'alphabetic' });
        x += pdf.getTextWidth(run) + tracking * run.length;
      }
      if (i < runs.length - 1) {
        drawPdfHeart(pdf, heart, x, baseline, size, text);
        x += heartWidth;
      }
    });

    if (item.alpha < 1) pdf.setGState(pdf.GState({ opacity: 1 }));

    if (item.rule) {
      pdf.setFillColor(accent[0], accent[1], accent[2]);
      if (styleOpts.divider === 'dots') {
        pdf.setTextColor(accent[0], accent[1], accent[2]);
        pdf.setCharSpace(size * 0.5);
        const dotsWidth = pdf.getTextWidth('···') + size * 0.5 * 3;
        const dx =
          plan.align === 'left'
            ? plan.x * k
            : plan.align === 'right'
              ? plan.x * k - dotsWidth
              : plan.x * k - dotsWidth / 2;
        pdf.text('···', dx, baseline + size * 0.95, { align: 'left', baseline: 'alphabetic' });
      } else {
        const rx =
          plan.align === 'left' ? plan.x * k : plan.align === 'right' ? plan.x * k - width : plan.x * k - width / 2;
        pdf.rect(rx, baseline + size * 0.55, width, Math.max(0.15, size * 0.035), 'F');
      }
    }
  }

  pdf.setCharSpace(0);
}

/** The heart separator, filled as a path — no subset here carries U+2665. */
function drawPdfHeart(
  pdf: Pdf,
  outline: Array<[number, number]>,
  x: number,
  baseline: number,
  size: number,
  color: [number, number, number]
) {
  if (!outline.length) return;
  // the path's ink spans x 2..22 and y 3..21.35 inside its 24-unit box
  const scale = (size * 0.62) / 18.35;
  const point = (p: [number, number]): [number, number] => [
    x + (p[0] - 2) * scale,
    baseline - (21.35 - p[1]) * scale,
  ];

  const first = point(outline[0]);
  const deltas: Array<[number, number]> = [];
  let prev = first;
  for (const raw of outline.slice(1)) {
    const p = point(raw);
    deltas.push([p[0] - prev[0], p[1] - prev[1]]);
    prev = p;
  }

  pdf.setFillColor(color[0], color[1], color[2]);
  pdf.lines(deltas, first[0], first[1], [1, 1], 'F', true);
}

function rgb(hex: string): [number, number, number] {
  const n = hex.replace('#', '');
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

/**
 * Film grain over the finished poster, from the same tile the preview uses
 * and scaled the same way, so the texture is the size it looked on screen.
 */
async function drawGrain(ctx: CanvasRenderingContext2D, job: ExportJob, w: number, h: number) {
  const strength = job.styleOpts.grain;
  if (strength <= 0) return;

  const img = new Image();
  img.src = grainTile();
  try {
    await img.decode();
  } catch {
    return;
  }

  const pattern = ctx.createPattern(img, 'repeat');
  if (!pattern) return;
  pattern.setTransform(new DOMMatrix().scale(grainSize(w) / img.width));

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = strength;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** The decorative rules just inside the poster edge. */
function drawBorder(ctx: CanvasRenderingContext2D, job: ExportJob, w: number, h: number) {
  const rules = borderRules(job.styleOpts.border, w);
  if (!rules.length) return;

  ctx.save();
  ctx.strokeStyle = job.theme.accent;
  for (const rule of rules) {
    ctx.lineWidth = rule.width;
    // stroke sits astride the path, so offset by half a line to land the
    // rule exactly where the preview's CSS border does
    const o = rule.inset + rule.width / 2;
    ctx.strokeRect(o, o, w - o * 2, h - o * 2);
  }
  ctx.restore();
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
