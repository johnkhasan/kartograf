import { MARKER_ICONS } from '../data/markerIcons';

/**
 * The poster typefaces, subset to what a poster can contain and shipped as
 * TTF so jsPDF can embed them. Only the one face a given export needs is
 * fetched — around 20kB — which is why these aren't in the bundle.
 */
interface FontEntry {
  files: Record<string, string>;
  /** codepoint ranges the subset actually covers, inclusive */
  cmap: Array<[number, number]>;
}

const BASE = '/fonts/';
let manifest: Record<string, FontEntry> | null = null;
const fileCache = new Map<string, string>();

async function loadManifest(): Promise<Record<string, FontEntry> | null> {
  if (manifest) return manifest;
  try {
    const res = await fetch(`${BASE}manifest.json`);
    if (!res.ok) return null;
    manifest = (await res.json()) as Record<string, FontEntry>;
    return manifest;
  } catch {
    return null;
  }
}

/** U+2665 is in none of these families, so it is drawn as a path instead. */
export const HEART = '♥';

const covered = (entry: FontEntry, cp: number) => entry.cmap.some(([a, b]) => cp >= a && cp <= b);

/** Typographic spaces a few of these families don't carry. */
const FANCY_SPACE = /[\u00A0\u2007\u2008\u2009\u202F]/g;

/**
 * The text as it can actually be set in this subset. A thin space is spacing,
 * not a glyph anyone reads, so where a family lacks one an ordinary space
 * stands in — a hair wider, and far better than sending the whole poster back
 * to raster over it.
 */
export function pdfSafeText(entry: FontEntry, text: string): string {
  return text.replace(FANCY_SPACE, (ch) => (covered(entry, ch.codePointAt(0)!) ? ch : ' '));
}

/**
 * Whether the embedded subset can render every character in this text. A
 * poster can hold anything a place name or a caption throws at it, and a
 * missing glyph in a PDF is a silent blank — so anything outside the subset
 * sends the whole overlay back to being drawn into the image.
 */
export function coversText(entry: FontEntry, text: string): boolean {
  for (const ch of pdfSafeText(entry, text)) {
    if (ch === HEART) continue; // drawn as a path
    if (!covered(entry, ch.codePointAt(0)!)) return false;
  }
  return true;
}

export interface PdfFace {
  /** base64 TTF, ready for jsPDF's virtual file system */
  data: string;
  fileName: string;
  weight: number;
}

export interface PdfFontSet {
  family: string;
  faces: PdfFace[];
  entry: FontEntry;
}

async function fetchBase64(file: string): Promise<string | null> {
  const hit = fileCache.get(file);
  if (hit) return hit;
  try {
    const res = await fetch(BASE + file);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    // chunked so a 40kB font doesn't blow the argument limit of fromCharCode
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const base64 = btoa(binary);
    fileCache.set(file, base64);
    return base64;
  } catch {
    return null;
  }
}

/**
 * The faces needed to set this text, or null when the family isn't available
 * or the subset can't cover the text — in which case the caller falls back to
 * drawing the text into the poster image.
 */
export async function pdfFontSet(family: string, texts: string[]): Promise<PdfFontSet | null> {
  const all = await loadManifest();
  const entry = all?.[family];
  if (!entry) return null;
  if (!texts.every((t) => coversText(entry, t))) return null;

  const faces: PdfFace[] = [];
  for (const [weight, file] of Object.entries(entry.files)) {
    const data = await fetchBase64(file);
    if (!data) return null;
    faces.push({ data, fileName: file, weight: Number(weight) });
  }
  return faces.length ? { family, faces, entry } : null;
}

/**
 * The heart glyph as a polygon in its 24x24 source box, sampled off the same
 * path the map markers use. None of the subsets carry U+2665, and a heart is
 * the default separator on a couple poster, so it is drawn rather than set.
 */
export function heartOutline(samples = 72): Array<[number, number]> {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  const path = document.createElementNS(svgNs, 'path');
  path.setAttribute('d', MARKER_ICONS.heart.path);
  svg.appendChild(path);
  svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
  document.body.appendChild(svg);
  try {
    const total = path.getTotalLength();
    const points: Array<[number, number]> = [];
    for (let i = 0; i < samples; i++) {
      const p = path.getPointAtLength((total * i) / samples);
      points.push([p.x, p.y]);
    }
    return points;
  } catch {
    return [];
  } finally {
    svg.remove();
  }
}
