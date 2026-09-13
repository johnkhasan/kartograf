import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';
import type { Theme, LayerToggles } from '../types';

const TILE_URL = 'https://tiles.openfreemap.org/planet';

/**
 * Build a MapLibre style from a theme palette and layer toggles.
 * Uses the OpenMapTiles schema served by OpenFreeMap (free, no API key).
 */
export function buildMapStyle(theme: Theme, layers: LayerToggles): StyleSpecification {
  const styleLayers: LayerSpecification[] = [];

  styleLayers.push({
    id: 'background',
    type: 'background',
    paint: { 'background-color': theme.bg },
  });

  if (layers.landcover) {
    styleLayers.push({
      id: 'landcover',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landcover',
      filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood', 'farmland', 'scrub']]],
      paint: { 'fill-color': theme.landcover, 'fill-opacity': 0.7 },
    });
  }

  if (layers.parks) {
    styleLayers.push({
      id: 'park',
      type: 'fill',
      source: 'omt',
      'source-layer': 'park',
      paint: { 'fill-color': theme.park },
    });
    styleLayers.push({
      id: 'landuse-green',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      filter: [
        'in',
        ['get', 'class'],
        ['literal', ['pitch', 'grass', 'cemetery', 'stadium', 'playground', 'garden']],
      ],
      paint: { 'fill-color': theme.park },
    });
  }

  if (layers.water) {
    styleLayers.push({
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      paint: { 'fill-color': theme.water },
    });
    styleLayers.push({
      id: 'waterway',
      type: 'line',
      source: 'omt',
      'source-layer': 'waterway',
      paint: {
        'line-color': theme.water,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 8, 0.5, 14, 3, 18, 8],
      },
    });
  }

  if (layers.aeroway) {
    styleLayers.push({
      id: 'aeroway-fill',
      type: 'fill',
      source: 'omt',
      'source-layer': 'aeroway',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': theme.aeroway, 'fill-opacity': 0.7 },
    });
    styleLayers.push({
      id: 'aeroway-line',
      type: 'line',
      source: 'omt',
      'source-layer': 'aeroway',
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': theme.aeroway,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 10, 1, 14, 6, 17, 20],
      },
    });
  }

  if (layers.buildings) {
    styleLayers.push({
      id: 'buildings',
      type: 'fill',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 12,
      paint: { 'fill-color': theme.building },
    });
  }

  if (layers.roads) {
    styleLayers.push({
      id: 'road-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: [
        'in',
        ['get', 'class'],
        ['literal', ['minor', 'service', 'track', 'path', 'living_street', 'pedestrian']],
      ],
      paint: {
        'line-color': theme.roadMinor,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 12, 0.3, 14, 0.8, 16, 2, 18, 5],
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    styleLayers.push({
      id: 'road-mid',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['primary', 'secondary', 'tertiary']]],
      paint: {
        'line-color': theme.roadMid,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 6, 0.4, 10, 1, 14, 2.4, 18, 9],
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
    styleLayers.push({
      id: 'road-major',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]],
      paint: {
        'line-color': theme.roadMajor,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 5, 0.6, 10, 1.6, 14, 3.5, 18, 12],
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });
  }

  if (layers.rail) {
    styleLayers.push({
      id: 'rail',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]],
      paint: {
        'line-color': theme.rail,
        'line-width': ['interpolate', ['exponential', 1.4], ['zoom'], 8, 0.4, 14, 1.2, 18, 3],
        'line-dasharray': [3, 2],
      },
    });
  }

  return {
    version: 8,
    sources: {
      omt: { type: 'vector', url: TILE_URL },
    },
    layers: styleLayers,
  };
}

/** Approximate width of the visible map in meters for a given zoom/latitude/width-px. */
export function visibleMeters(zoom: number, lat: number, widthPx: number): number {
  const metersPerPixel =
    (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
  return metersPerPixel * widthPx;
}

export function formatDistance(m: number): string {
  if (m >= 1000) {
    const km = m / 1000;
    return km >= 100 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
  }
  return `${Math.round(m)} m`;
}
