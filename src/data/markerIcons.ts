import type { MarkerIconId } from '../types';

/** SVG paths in a 24x24 viewBox, drawn filled. */
export const MARKER_ICONS: Record<MarkerIconId, { label: string; path: string }> = {
  pin: {
    label: 'Pin',
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 0 1 9.5 9 2.5 2.5 0 0 1 12 6.5 2.5 2.5 0 0 1 14.5 9a2.5 2.5 0 0 1-2.5 2.5z',
  },
  heart: {
    label: 'Heart',
    path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  },
  home: {
    label: 'Home',
    path: 'M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3l9-8z',
  },
  star: {
    label: 'Star',
    path: 'M12 2l2.9 6.26 6.85.58-5.2 4.51 1.56 6.7L12 16.5l-6.11 3.55 1.56-6.7-5.2-4.51 6.85-.58L12 2z',
  },
  circle: {
    label: 'Circle',
    path: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  },
  square: {
    label: 'Square',
    path: 'M5 5h14v14H5V5z',
  },
};

export function markerSvg(icon: MarkerIconId, color: string, size: number): string {
  const { path } = MARKER_ICONS[icon];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><path d="${path}" fill="${color}" stroke="rgba(0,0,0,0.35)" stroke-width="0.5"/></svg>`;
}
