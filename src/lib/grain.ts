/**
 * Film grain, as one small tile repeated across the poster.
 *
 * The tile is drawn at a fixed fraction of the poster's width in both
 * renderers, so it is downscaled from the same 128px source on screen and in
 * the export — the grain stays fine at print size and what you see is what
 * you get. Generated from a fixed seed so a poster looks the same every time
 * it is opened.
 */
const TILE = 128;
export const GRAIN_FRACTION = 0.035;

let cached: string | null = null;

export function grainTile(): string {
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TILE;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(TILE, TILE);

  let seed = 1337;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 110 + Math.round(rand() * 90);
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  cached = canvas.toDataURL('image/png');
  return cached;
}

/** Size one grain tile is drawn at, for a poster of this width. */
export const grainSize = (posterWidth: number) => posterWidth * GRAIN_FRACTION;

export interface BorderRule {
  /** distance from the poster edge, px */
  inset: number;
  width: number;
}

/**
 * The decorative rules just inside the poster edge. Independent of the
 * classic frame, which insets the map itself.
 */
export function borderRules(
  style: 'none' | 'thin' | 'double',
  posterWidth: number
): BorderRule[] {
  if (style === 'none') return [];
  const m = posterWidth * 0.035;
  const w = Math.max(1, posterWidth * 0.0016);
  if (style === 'thin') return [{ inset: m, width: w }];
  return [
    { inset: m, width: w },
    { inset: m + posterWidth * 0.012, width: Math.max(0.75, w * 0.5) },
  ];
}
