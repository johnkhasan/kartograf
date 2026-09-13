import { useEffect, useRef, useState } from 'react';
import {
  Map as MLMap,
  Marker as MLMarker,
  NavigationControl,
  type GeoJSONSource,
  type MapMouseEvent,
} from 'maplibre-gl';
import type { Feature } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStore, activeTheme, useActiveTheme } from '../store';
import { buildMapStyle } from '../lib/mapStyle';
import { formatCoords } from '../lib/geocode';
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
  const [posterSize, setPosterSize] = useState({ w: 420, h: 594 });
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
    moveMarker,
    removeMarker,
  } = useStore();

  const theme = useActiveTheme();
  const layout = getLayout(layoutId);

  // ---- poster sizing to fit the workspace
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => {
      const availW = el.clientWidth - 48;
      const availH = el.clientHeight - 48;
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
    map.on('load', addRouteLayer);
    map.on('styledata', () => {
      // re-add route layer after setStyle
      if (map.isStyleLoaded() && !map.getSource('route')) addRouteLayer();
    });

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
        el.addEventListener('dblclick', (ev) => {
          ev.stopPropagation();
          removeMarker(m.id);
        });
        mk = new MLMarker({ element: el, draggable: true })
          .setLngLat([m.lng, m.lat])
          .addTo(map);
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
      }
      const el = mk.getElement();
      if (m.icon.startsWith('up:')) {
        const up = uploadedMarkers.find((u) => u.id === m.icon.slice(3));
        el.innerHTML = up
          ? `<img src="${up.dataUrl}" style="max-width:${markerSize}px;max-height:${markerSize}px;display:block" draggable="false"/>`
          : '';
      } else {
        el.innerHTML = markerSvg(m.icon as MarkerIconId, color, markerSize);
      }
    }
  }, [markers, uploadedMarkers, markerSize, markerColor, theme.accent, moveMarker, removeMarker]);

  const w = posterSize.w;
  const framed = styleOpts.frame;
  const cityPx = w * 0.052;
  const countryPx = w * 0.022;
  const coordsPx = w * 0.018;

  const title = (styleOpts.customTitle || location.name).toUpperCase();
  const subtitle = (styleOpts.customSubtitle || location.country).toUpperCase();

  const pad = Math.round(w * FRAME_PAD);
  const bottomBand = Math.round(posterSize.h * FRAME_BOTTOM);

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
          style={
            framed
              ? {
                  top: pad,
                  left: pad,
                  right: pad,
                  bottom: bottomBand,
                  border: `1.5px solid ${theme.accent}`,
                }
              : { inset: 0 }
          }
        />

        {mapLoading && (
          <div className="map-loading" style={{ color: theme.text, borderColor: theme.accent }}>
            {t.loadingMap}
          </div>
        )}

        {!framed && styleOpts.showOverlay && (
          <div
            className="poster-gradient"
            style={{
              background: `linear-gradient(to bottom, ${theme.bg}00 0%, ${theme.bg}c0 55%, ${theme.bg}f5 100%)`,
            }}
          />
        )}

        <div
          className="poster-text"
          style={{
            fontFamily: `'${styleOpts.font}', sans-serif`,
            bottom: framed ? '2.6%' : '4.2%',
          }}
        >
          {styleOpts.showCity && (
            <div
              className="poster-city"
              style={{ color: theme.text, fontSize: cityPx, letterSpacing: '0.32em' }}
            >
              {title}
            </div>
          )}
          {styleOpts.showCountry && subtitle && (
            <div
              className="poster-country"
              style={{
                color: theme.text,
                fontSize: countryPx,
                letterSpacing: '0.35em',
                borderBottom: `2px solid ${theme.accent}`,
              }}
            >
              {subtitle}
            </div>
          )}
          {styleOpts.showCoords && (
            <div
              className="poster-coords"
              style={{ color: theme.text, fontSize: coordsPx, letterSpacing: '0.18em' }}
            >
              {formatCoords(location.lat, location.lng)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function routeGeojson(coords: [number, number][]): Feature {
  return {
    type: 'Feature',
    properties: {},
    geometry:
      coords.length >= 2
        ? { type: 'LineString', coordinates: coords }
        : { type: 'LineString', coordinates: [] },
  };
}
