import { useEffect, useRef, useState } from 'react';
import {
  Map as MLMap,
  Marker as MLMarker,
  NavigationControl,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStore, activeTheme, useActiveTheme } from '../store';
import { buildMapStyle } from '../lib/mapStyle';
import { applyCoupleLayers } from '../lib/couple';
import { posterLines, posterScrim, posterTextBox } from '../lib/posterText';
import { markerSvg } from '../data/markerIcons';
import { FRAME_PAD, FRAME_BOTTOM } from '../lib/export';
import { getLayout } from '../data/layouts';
import { useT } from '../i18n';
import { POSTER_MAP_ID } from '../hooks/useExport';
import type { MarkerIconId } from '../types';

export { POSTER_MAP_ID };

export default function PosterPreview() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const domMarkersRef = useRef<Map<string, MLMarker>>(new Map());
  const applyCoupleRef = useRef<() => void>(() => {});
  const [posterSize, setPosterSize] = useState({ w: 420, h: 594 });
  /** Tapped marker, shown with a delete badge — touch has no double-click. */
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  const t = useT();
  const {
    location,
    center,
    zoom,
    themeId,
    customTheme,
    layoutId,
    styleOpts,
    layers,
    markers,
    uploadedMarkers,
    markerSize,
    markerColor,
    route,
    routeWidth,
    drawingRoute,
    couple,
    viewMode,
    moveMarker,
    removeMarker,
  } = useStore();
  const readOnly = viewMode === 'view';

  const theme = useActiveTheme();
  const layout = getLayout(layoutId);

  // ---- poster sizing to fit the workspace
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => {
      // clientWidth/Height include padding, and on mobile the workspace is
      // padded by the open bottom sheet's height — subtract it so the poster
      // is fitted to what is actually visible rather than sliding under it
      const cs = getComputedStyle(el);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const gutter = el.clientWidth < 700 ? 20 : 48;
      const availW = el.clientWidth - padX - gutter;
      const availH = el.clientHeight - padY - gutter;
      let h = availH;
      let w = h * layout.ratio;
      if (w > availW) {
        w = availW;
        h = w / layout.ratio;
      }
      setPosterSize({ w: Math.round(w), h: Math.round(h) });
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout.ratio]);

  // ---- map init (once)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const st = useStore.getState();
    const map = new MLMap({
      container: mapContainerRef.current,
      style: buildMapStyle(activeTheme(st), st.layers),
      center: st.center,
      zoom: st.zoom,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    map.on('moveend', () => {
      const c = map.getCenter();
      useStore.getState().setView([c.lng, c.lat], map.getZoom());
    });

    map.on('click', (e: MapMouseEvent) => {
      setSelectedMarker(null);
      if (useStore.getState().drawingRoute) {
        useStore.getState().addRoutePoint(e.lngLat.lng, e.lngLat.lat);
      }
    });

    map.on('dataloading', () => setMapLoading(true));
    map.on('idle', () => setMapLoading(false));

    const addRouteLayer = () => {
      const r = useStore.getState().route;
      const th = activeTheme(useStore.getState());
      if (map.getSource('route')) return;
      map.addSource('route', {
        type: 'geojson',
        data: routeGeojson(r),
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': th.accent,
          'line-width': useStore.getState().routeWidth,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
    };
    // the couple line + hearts live in map layers (not DOM markers) so the
    // preview and the export map can be fed by the exact same code; layer
    // work is async because the heart icon has to be rasterized first, so
    // overlapping calls are collapsed into one trailing re-run
    let coupleRunning = false;
    let couplePending = false;
    const applyCouple = () => {
      if (coupleRunning) {
        couplePending = true;
        return;
      }
      coupleRunning = true;
      const st = useStore.getState();
      const th = activeTheme(st);
      void applyCoupleLayers(map, {
        couple: st.couple,
        iconColor: st.markerColor ?? th.accent,
        lineColor: th.accent,
        iconSize: st.markerSize,
        lineWidth: st.couple.lineWidth,
      })
        .catch(() => {})
        .finally(() => {
          coupleRunning = false;
          if (couplePending) {
            couplePending = false;
            applyCouple();
          }
        });
    };
    applyCoupleRef.current = applyCouple;

    // A theme or layer change goes through setStyle, which throws away every
    // source, layer and image the app added — they have to be put back. That
    // has to hang off 'style.load': after setStyle, 'styledata' only ever
    // fires while isStyleLoaded() is still false, so a guard on that flag
    // never runs (which is why routes used to vanish on a theme change).
    const addOverlays = () => {
      addRouteLayer();
      applyCouple();
    };
    map.on('load', addOverlays);
    map.on('style.load', addOverlays);

    mapRef.current = map;
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__map = map;
    }
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- style updates on theme / layer change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(buildMapStyle(theme, layers), { diff: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeId, customTheme, layers]);

  // ---- external view changes (location select / recenter)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    if (
      Math.abs(c.lng - center[0]) > 1e-9 ||
      Math.abs(c.lat - center[1]) > 1e-9 ||
      Math.abs(map.getZoom() - zoom) > 1e-9
    ) {
      map.jumpTo({ center, zoom });
    }
  }, [center, zoom]);

  // ---- resize map when poster size or frame changes
  useEffect(() => {
    // wait for the DOM to apply the new inset before resizing
    const id = requestAnimationFrame(() => mapRef.current?.resize());
    return () => cancelAnimationFrame(id);
  }, [posterSize, styleOpts.frame]);

  // ---- route data updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource('route') as GeoJSONSource | undefined;
    if (src) src.setData(routeGeojson(route));
    if (map.getLayer('route-line')) {
      map.setPaintProperty('route-line', 'line-width', routeWidth);
      map.setPaintProperty('route-line', 'line-color', theme.accent);
    }
  }, [route, routeWidth, theme.accent, themeId, layers]);

  // ---- couple line + endpoint hearts
  useEffect(() => {
    if (!mapRef.current) return;
    applyCoupleRef.current();
  }, [couple, markerSize, markerColor, theme.accent, themeId, layers]);

  // ---- DOM markers sync
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const existing = domMarkersRef.current;
    const wanted = new Set(markers.map((m) => m.id));

    for (const [id, mk] of existing) {
      if (!wanted.has(id)) {
        mk.remove();
        existing.delete(id);
      }
    }

    const color = markerColor ?? theme.accent;
    for (const m of markers) {
      let mk = existing.get(m.id);
      if (!mk) {
        const el = document.createElement('div');
        el.className = 'poster-marker';

        // MapLibre owns the outer element's position, so the badge is
        // anchored to this inner wrapper, which shrinks to the icon
        const inner = document.createElement('span');
        inner.className = 'poster-marker-inner';

        const icon = document.createElement('span');
        icon.className = 'poster-marker-icon';

        // Touch has no double-click, so a marker is tapped to select and
        // then removed with this badge. Double-click still works with a
        // mouse. Both read fresh state instead of closing over `readOnly`,
        // so a later Edit click un-blocks removal on this same instance.
        const del = document.createElement('button');
        del.className = 'poster-marker-del';
        del.type = 'button';
        del.textContent = '✕';
        del.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (useStore.getState().viewMode === 'view') return;
          setSelectedMarker(null);
          removeMarker(m.id);
        });

        inner.append(icon, del);
        el.append(inner);

        let dragged = false;
        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (dragged) {
            dragged = false;
            return;
          }
          if (useStore.getState().viewMode === 'view') return;
          setSelectedMarker((cur) => (cur === m.id ? null : m.id));
        });
        el.addEventListener('dblclick', (ev) => {
          ev.stopPropagation();
          if (useStore.getState().viewMode === 'view') return;
          removeMarker(m.id);
        });

        mk = new MLMarker({ element: el, draggable: !readOnly })
          .setLngLat([m.lng, m.lat])
          .addTo(map);
        mk.on('dragstart', () => {
          dragged = true;
        });
        mk.on('dragend', () => {
          const p = mk!.getLngLat();
          moveMarker(m.id, p.lng, p.lat);
        });
        existing.set(m.id, mk);
      } else {
        const cur = mk.getLngLat();
        if (Math.abs(cur.lng - m.lng) > 1e-9 || Math.abs(cur.lat - m.lat) > 1e-9) {
          mk.setLngLat([m.lng, m.lat]);
        }
        mk.setDraggable(!readOnly);
      }
      const el = mk.getElement();
      el.classList.toggle('selected', !readOnly && selectedMarker === m.id);
      const icon = el.querySelector('.poster-marker-icon') as HTMLElement;
      if (m.icon.startsWith('up:')) {
        const up = uploadedMarkers.find((u) => u.id === m.icon.slice(3));
        icon.innerHTML = up
          ? `<img src="${up.dataUrl}" style="max-width:${markerSize}px;max-height:${markerSize}px;display:block" draggable="false"/>`
          : '';
      } else {
        icon.innerHTML = markerSvg(m.icon as MarkerIconId, color, markerSize);
      }
    }
  }, [
    markers,
    uploadedMarkers,
    markerSize,
    markerColor,
    theme.accent,
    readOnly,
    selectedMarker,
    moveMarker,
    removeMarker,
  ]);

  const w = posterSize.w;
  const framed = styleOpts.frame;
  const cityPx = w * 0.052;
  const countryPx = w * 0.022;
  const coordsPx = w * 0.018;

  const lines = posterLines({ styleOpts, location, couple });
  const box = posterTextBox({ styleOpts, width: w, height: posterSize.h });

  const flexAlign =
    box.align === 'left' ? 'flex-start' : box.align === 'right' ? 'flex-end' : 'center';
  const textPlacement =
    box.pos === 'bottom'
      ? { bottom: box.edge, top: 'auto' as const }
      : box.pos === 'top'
        ? { top: box.edge, bottom: 'auto' as const }
        : {
            top: '50%',
            bottom: 'auto' as const,
            transform: `translateY(calc(-50% + ${box.centerShift}px))`,
          };

  const pad = Math.round(w * FRAME_PAD);
  const band = Math.round(posterSize.h * FRAME_BOTTOM);
  // the text band swaps to the top when the text is anchored there, matching
  // frameRect() in lib/export.ts
  const mapRectStyle = framed
    ? styleOpts.textPos === 'top'
      ? { top: band, left: pad, right: pad, bottom: pad }
      : { top: pad, left: pad, right: pad, bottom: band }
    : { inset: 0 };

  return (
    <div className="workspace" ref={wrapRef}>
      <div
        className="poster"
        style={{ width: posterSize.w, height: posterSize.h, background: theme.bg }}
      >
        <div
          id={POSTER_MAP_ID}
          ref={mapContainerRef}
          className={'poster-map' + (drawingRoute ? ' drawing' : '')}
          style={framed ? { ...mapRectStyle, border: `1.5px solid ${theme.accent}` } : mapRectStyle}
        />

        {mapLoading && (
          <div
            className="map-loading-overlay"
            style={{ ...mapRectStyle, background: `${theme.bg}b3` }}
          >
            <div className="map-loading">
              <span className="map-loading-spinner" style={{ borderTopColor: theme.accent }} />
              <span style={{ color: theme.text }}>{t.loadingMap}</span>
            </div>
          </div>
        )}

        {!framed && styleOpts.showOverlay && (
          <div
            className="poster-gradient"
            style={{
              background: `linear-gradient(to bottom, ${posterScrim(styleOpts)
                .map((stop) => `${hexA(theme.bg, stop.alpha)} ${(stop.at * 100).toFixed(1)}%`)
                .join(', ')})`,
            }}
          />
        )}

        <div
          className="poster-text"
          style={{
            fontFamily: `'${styleOpts.font}', sans-serif`,
            alignItems: flexAlign,
            textAlign: box.align,
            paddingLeft: box.sidePad,
            paddingRight: box.sidePad,
            ...textPlacement,
          }}
        >
          {lines.title && (
            <div
              className="poster-city"
              style={{ color: theme.text, fontSize: cityPx, letterSpacing: '0.32em' }}
            >
              {lines.title}
            </div>
          )}
          {lines.subtitle && (
            <div
              className="poster-country"
              style={{
                color: theme.text,
                fontSize: countryPx,
                letterSpacing: '0.35em',
                borderBottom: `2px solid ${theme.accent}`,
              }}
            >
              {lines.subtitle}
            </div>
          )}
          {lines.meta && (
            <div
              className="poster-coords"
              style={{ color: theme.text, fontSize: coordsPx, letterSpacing: '0.18em' }}
            >
              {lines.meta}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function hexA(hex: string, alpha: number): string {
  const n = hex.replace('#', '');
  return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(
    n.slice(4, 6),
    16
  )},${alpha})`;
}

/**
 * A LineString needs at least 2 positions to be valid GeoJSON — feeding an
 * empty-coordinates one to the source (e.g. right after the first drawn
 * point) can wedge maplibre's internal geojson-vt worker so later, valid
 * updates silently stop rendering. A FeatureCollection with zero features
 * is always valid, so that's the "nothing to draw yet" state instead.
 */
function routeGeojson(coords: [number, number][]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features:
      coords.length >= 2
        ? [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            },
          ]
        : [],
  };
}
