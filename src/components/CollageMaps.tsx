import { useEffect, useRef } from 'react';
import { Map as MLMap } from 'maplibre-gl';
import { useStore, activeTheme } from '../store';
import { buildMapStyle } from '../lib/mapStyle';
import type { CollageCell, LayerToggles, Theme } from '../types';

export interface CollageGeometry {
  /** panel rectangles inside the map area, in px */
  rects: Array<{ x: number; y: number; w: number; h: number }>;
  labelPx: number;
}

/**
 * Where a collage's panels sit inside the poster's map area. Shared by the
 * live preview and the export so a downloaded collage is framed exactly as it
 * was on screen.
 */
export function collageGeometry(
  count: number,
  direction: 'row' | 'column',
  gapFraction: number,
  width: number,
  height: number
): CollageGeometry {
  const gap = Math.round(width * gapFraction);
  const rects: CollageGeometry['rects'] = [];

  if (direction === 'row') {
    const cellW = (width - gap * (count - 1)) / count;
    for (let i = 0; i < count; i++) {
      rects.push({ x: Math.round(i * (cellW + gap)), y: 0, w: Math.round(cellW), h: height });
    }
  } else {
    const cellH = (height - gap * (count - 1)) / count;
    for (let i = 0; i < count; i++) {
      rects.push({ x: 0, y: Math.round(i * (cellH + gap)), w: width, h: Math.round(cellH) });
    }
  }

  return { rects, labelPx: Math.max(7, width * 0.018) };
}

interface Props {
  cells: CollageCell[];
  geometry: CollageGeometry;
  theme: Theme;
  layers: LayerToggles;
  /** kept out of the style so a theme change doesn't rebuild every panel */
  styleKey: string;
  showLabels: boolean;
  font: string;
}

/**
 * One MapLibre instance per panel.
 *
 * The single-map path is untouched: a collage is a different kind of poster,
 * and interleaving the two lifecycles in one component would make both harder
 * to follow than keeping them apart.
 */
export default function CollageMaps({
  cells,
  geometry,
  theme,
  layers,
  styleKey,
  showLabels,
  font,
}: Props) {
  const hosts = useRef(new Map<string, HTMLDivElement>());
  const maps = useRef(new Map<string, MLMap>());

  // create and dispose panels as cells come and go
  useEffect(() => {
    const wanted = new Set(cells.map((c) => c.id));
    for (const [id, map] of maps.current) {
      if (!wanted.has(id)) {
        map.remove();
        maps.current.delete(id);
      }
    }

    for (const cell of cells) {
      if (maps.current.has(cell.id)) continue;
      const host = hosts.current.get(cell.id);
      if (!host) continue;

      const st = useStore.getState();
      const map = new MLMap({
        container: host,
        style: buildMapStyle(activeTheme(st), st.layers),
        center: cell.center,
        zoom: cell.zoom,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.touchZoomRotate.disableRotation();
      map.on('moveend', () => {
        const c = map.getCenter();
        useStore.getState().updateCollageCell(cell.id, {
          center: [c.lng, c.lat],
          zoom: map.getZoom(),
        });
      });
      maps.current.set(cell.id, map);
    }
  }, [cells]);

  // dispose everything when the collage is switched off
  useEffect(() => {
    const instances = maps.current;
    return () => {
      for (const map of instances.values()) map.remove();
      instances.clear();
    };
  }, []);

  useEffect(() => {
    for (const map of maps.current.values()) {
      map.setStyle(buildMapStyle(theme, layers), { diff: false });
    }
    // styleKey stands in for the theme object, which is rebuilt on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleKey]);

  // follow view changes made anywhere but on the panel itself
  useEffect(() => {
    for (const cell of cells) {
      const map = maps.current.get(cell.id);
      if (!map) continue;
      const c = map.getCenter();
      if (
        Math.abs(c.lng - cell.center[0]) > 1e-9 ||
        Math.abs(c.lat - cell.center[1]) > 1e-9 ||
        Math.abs(map.getZoom() - cell.zoom) > 1e-9
      ) {
        map.jumpTo({ center: cell.center, zoom: cell.zoom });
      }
    }
  }, [cells]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      for (const map of maps.current.values()) map.resize();
    });
    return () => cancelAnimationFrame(id);
  }, [geometry]);

  return (
    <>
      {cells.map((cell, i) => {
        const rect = geometry.rects[i];
        if (!rect) return null;
        return (
          <div
            key={cell.id}
            className="collage-cell"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          >
            <div
              className="collage-map"
              ref={(node) => {
                if (node) hosts.current.set(cell.id, node);
                else hosts.current.delete(cell.id);
              }}
            />
            {showLabels && (
              <div
                className="collage-label"
                style={{
                  color: theme.text,
                  fontFamily: `'${font}', sans-serif`,
                  fontSize: geometry.labelPx,
                  letterSpacing: geometry.labelPx * 0.22,
                  textShadow: `0 1px 4px ${theme.bg}, 0 0 8px ${theme.bg}`,
                }}
              >
                {(cell.label || cell.location.name).toUpperCase()}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
