import { formatCoords } from './geocode';
import { coupleActive, formatCoupleDistance, haversineMeters } from './couple';
import type { CollageState, CoupleState, LocationInfo, StyleOptions } from '../types';

export interface PosterTextInput {
  styleOpts: StyleOptions;
  location: LocationInfo;
  couple: CoupleState;
  collage?: CollageState;
}

/**
 * The three text slots of a poster, already gated by the style toggles —
 * an empty string means "draw nothing here".
 *
 * Both renderers (the live DOM preview and the canvas export) build their
 * text from this one function, so a change to the wording can't leave the
 * downloaded file saying something different from what was on screen.
 */
export interface PosterLines {
  /** large headline: city name, or "NAME ♥ NAME" in couple mode */
  title: string;
  /** mid line with the accent underline: country, or "CITY — CITY" */
  subtitle: string;
  /** small line: coordinates, or the distance and date */
  meta: string;
}

export function posterLines(s: PosterTextInput): PosterLines {
  const { styleOpts, location, couple, collage } = s;
  const custom = {
    title: styleOpts.customTitle.trim(),
    subtitle: styleOpts.customSubtitle.trim(),
  };

  // Each collage panel is captioned with its own place, so the poster's text
  // block would only repeat one of them — it stays empty unless the design
  // asks for a title of its own.
  if (collage?.enabled && collage.cells.length >= 2) {
    return {
      title: styleOpts.showCity ? custom.title.toUpperCase() : '',
      subtitle: styleOpts.showCountry ? custom.subtitle.toUpperCase() : '',
      meta: '',
    };
  }

  if (coupleActive(couple)) {
    const sep = couple.separator || '♥';
    const named = !!(couple.a.label.trim() || couple.b.label.trim());
    const nameA = (couple.a.label.trim() || couple.a.name).toUpperCase();
    const nameB = (couple.b.label.trim() || couple.b.name).toUpperCase();

    // with people's names up top the cities belong on the second line; without
    // them the headline already *is* the cities, so show the countries instead
    // of repeating the same two words underneath
    const pair = (x: string, y: string) =>
      x && y && x !== y ? `${x} — ${y}` : x || y;
    const places = named
      ? pair(couple.a.name, couple.b.name)
      : pair(couple.a.country, couple.b.country);

    const meta: string[] = [];
    if (couple.showDistance) {
      meta.push(formatCoupleDistance(haversineMeters(couple.a, couple.b), couple.units));
    }
    if (couple.date.trim()) meta.push(couple.date.trim());

    return {
      title: styleOpts.showCity ? custom.title.toUpperCase() || `${nameA} ${sep} ${nameB}` : '',
      subtitle: styleOpts.showCountry ? (custom.subtitle || places).toUpperCase() : '',
      meta: meta.join(' · '),
    };
  }

  return {
    title: styleOpts.showCity ? (custom.title || location.name).toUpperCase() : '',
    subtitle: styleOpts.showCountry ? (custom.subtitle || location.country).toUpperCase() : '',
    meta: styleOpts.showCoords ? formatCoords(location.lat, location.lng) : '',
  };
}

/** Font sizes of the three text slots, as fractions of the poster width. */
const SLOT_SIZE = { title: 0.052, subtitle: 0.022, meta: 0.018 } as const;
/** Built-in letter spacing per slot, as a fraction of that slot's size. */
const SLOT_TRACKING = { title: 0.32, subtitle: 0.35, meta: 0.18 } as const;

export interface TextMetrics {
  title: { size: number; tracking: number };
  subtitle: { size: number; tracking: number };
  meta: { size: number; tracking: number };
}

/**
 * Pixel type sizes and letter spacing for a poster of this width, after the
 * user's scale and tracking multipliers. Shared so the canvas export can't
 * drift from the preview.
 */
export function posterTextMetrics(styleOpts: StyleOptions, width: number): TextMetrics {
  const scale = styleOpts.textScale;
  const track = styleOpts.textTracking;
  const slot = (k: keyof typeof SLOT_SIZE) => {
    const size = width * SLOT_SIZE[k] * scale;
    return { size, tracking: size * SLOT_TRACKING[k] * track };
  };
  return { title: slot('title'), subtitle: slot('subtitle'), meta: slot('meta') };
}

/** Distance of the text block from its anchored edge, as a fraction of height. */
const EDGE = { plain: 0.042, framed: 0.026 } as const;

/** Side inset used when the block is left/right aligned, as a fraction of width. */
export const TEXT_SIDE_PAD = 0.07;

export interface TextBoxInput {
  styleOpts: StyleOptions;
  /** poster pixel size the geometry is resolved against */
  width: number;
  height: number;
}

/**
 * Where the text block sits on the poster, in pixels. The live preview lays
 * the block out with CSS and the export draws baselines on a canvas, so they
 * can't share the drawing code — but they can share this, which keeps a
 * downloaded poster matching what was on screen.
 */
export function posterTextBox(s: TextBoxInput) {
  const { styleOpts, width, height } = s;
  const edge = (styleOpts.frame ? EDGE.framed : EDGE.plain) * height;
  const offset = (styleOpts.textOffset / 100) * height;
  const sidePad = styleOpts.textAlign === 'center' ? 0 : TEXT_SIDE_PAD * width;

  return {
    /** vertical anchor and its distance, ready for either renderer */
    pos: styleOpts.textPos,
    align: styleOpts.textAlign,
    /** px from the anchored edge (top/bottom), already nudged by the offset */
    edge: styleOpts.textPos === 'bottom' ? edge - offset : edge + offset,
    /** px to shift from the vertical centre, for pos === 'center' */
    centerShift: offset,
    sidePad,
  };
}

/** True when the poster carries no headline or subtitle at all. */
export function posterTextIsEmpty(input: PosterTextInput): boolean {
  const { title, subtitle } = posterLines(input);
  return !title && !subtitle;
}

export interface ScrimStop {
  /** position down the poster, 0 = top edge, 1 = bottom edge */
  at: number;
  /** opacity of the theme background colour at that point */
  alpha: number;
}

/**
 * The legibility scrim behind the text, as stops of one top-to-bottom
 * gradient spanning the whole poster. It follows the text block: anchoring
 * the title to the top with the fade still at the bottom would leave the
 * text sitting on bare map. Both renderers consume the same stops.
 */
export function posterScrim(styleOpts: StyleOptions): ScrimStop[] {
  const off = styleOpts.textOffset;
  const clamp = (v: number) => Math.max(2, Math.min(98, v)) / 100;

  if (styleOpts.textPos === 'top') {
    const end = clamp(38 + off);
    return [
      { at: 0, alpha: 0.96 },
      { at: end * 0.45, alpha: 0.75 },
      { at: end, alpha: 0 },
      { at: 1, alpha: 0 },
    ];
  }

  if (styleOpts.textPos === 'center') {
    const mid = clamp(50 + off);
    return [
      { at: 0, alpha: 0 },
      { at: Math.max(0, mid - 0.25), alpha: 0 },
      { at: mid, alpha: 0.82 },
      { at: Math.min(1, mid + 0.25), alpha: 0 },
      { at: 1, alpha: 0 },
    ];
  }

  const start = clamp(62 + off);
  return [
    { at: 0, alpha: 0 },
    { at: start, alpha: 0 },
    { at: start + (1 - start) * 0.55, alpha: 0.75 },
    { at: 1, alpha: 0.96 },
  ];
}
