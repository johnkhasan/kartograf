import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { getTheme } from './data/themes';
import type {
  ExportSettings,
  Lang,
  LayerToggles,
  LocationInfo,
  MarkerIcon,
  PanelId,
  PosterMarker,
  StyleOptions,
  Theme,
  UploadedMarker,
} from './types';

export interface AppState {
  location: LocationInfo;
  center: [number, number];
  zoom: number;
  themeId: string;
  customTheme: Theme | null;
  layoutId: string;
  styleOpts: StyleOptions;
  layers: LayerToggles;
  markers: PosterMarker[];
  uploadedMarkers: UploadedMarker[];
  markerSize: number;
  markerColor: string | null; // null = theme accent
  route: [number, number][];
  routeWidth: number;
  drawingRoute: boolean;
  settings: ExportSettings;
  activePanel: PanelId | null;
  modalOpen: boolean;
  exportDialogOpen: boolean;
  exporting: boolean;
  lang: Lang;

  setLocation: (loc: LocationInfo) => void;
  setView: (center: [number, number], zoom: number) => void;
  setZoom: (zoom: number) => void;
  setTheme: (id: string) => void;
  setCustomTheme: (theme: Theme) => void;
  setLayout: (id: string) => void;
  setStyleOpts: (patch: Partial<StyleOptions>) => void;
  setLayers: (patch: Partial<LayerToggles>) => void;
  addMarker: (icon: MarkerIcon, lng: number, lat: number) => void;
  moveMarker: (id: string, lng: number, lat: number) => void;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
  addUploadedMarker: (dataUrl: string) => string;
  removeUploadedMarker: (id: string) => void;
  setMarkerSize: (size: number) => void;
  setMarkerColor: (color: string | null) => void;
  addRoutePoint: (lng: number, lat: number) => void;
  undoRoutePoint: () => void;
  clearRoute: () => void;
  setRouteWidth: (w: number) => void;
  setDrawingRoute: (on: boolean) => void;
  setSettings: (patch: Partial<ExportSettings>) => void;
  setActivePanel: (panel: PanelId | null) => void;
  setModalOpen: (open: boolean) => void;
  setExportDialogOpen: (open: boolean) => void;
  setExporting: (on: boolean) => void;
  setLang: (lang: Lang) => void;
}

/** Fields captured by undo/redo history (design decisions, not view/UI state). */
const HISTORY_KEYS = [
  'location',
  'themeId',
  'customTheme',
  'layoutId',
  'styleOpts',
  'layers',
  'markers',
  'markerSize',
  'markerColor',
  'route',
  'routeWidth',
  'settings',
] as const;

/** Persisted fields (history fields + view + prefs). */
const PERSIST_KEYS = [
  ...HISTORY_KEYS,
  'center',
  'zoom',
  'uploadedMarkers',
  'lang',
  'modalOpen',
] as const;

type Snapshot = Pick<AppState, (typeof HISTORY_KEYS)[number]>;

function pick<K extends readonly (keyof AppState)[]>(s: AppState, keys: K) {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = s[k];
  return out;
}

let seq = 0;
const genId = () => `${Date.now().toString(36)}${(++seq).toString(36)}`;

/**
 * Default data state — the same object seeds the store and is used by
 * lib/share.ts to diff against, so a share link only carries what the user
 * actually changed.
 */
export const DEFAULT_STATE: Pick<
  AppState,
  | 'location'
  | 'center'
  | 'zoom'
  | 'themeId'
  | 'customTheme'
  | 'layoutId'
  | 'styleOpts'
  | 'layers'
  | 'markers'
  | 'uploadedMarkers'
  | 'markerSize'
  | 'markerColor'
  | 'route'
  | 'routeWidth'
  | 'drawingRoute'
  | 'settings'
  | 'activePanel'
  | 'modalOpen'
  | 'exportDialogOpen'
  | 'exporting'
  | 'lang'
> = {
  location: { name: 'Tashkent', country: 'Uzbekistan', lat: 41.3123, lng: 69.2787 },
  center: [69.2787, 41.3123],
  zoom: 12,
  themeId: 'midnight-blue',
  customTheme: null,
  layoutId: 'a4-portrait',
  styleOpts: {
    showOverlay: true,
    showCity: true,
    showCountry: true,
    showCoords: true,
    font: 'Space Grotesk',
    customTitle: '',
    customSubtitle: '',
    frame: false,
  },
  layers: {
    landcover: true,
    buildings: true,
    water: true,
    parks: true,
    roads: true,
    rail: true,
    aeroway: true,
  },
  markers: [],
  uploadedMarkers: [],
  markerSize: 32,
  markerColor: null,
  route: [],
  routeWidth: 3,
  drawingRoute: false,
  settings: { scale: 2, format: 'png' },
  activePanel: 'location',
  modalOpen: true,
  exportDialogOpen: false,
  exporting: false,
  lang: 'uz',
};

export const useStore = create<AppState>()(
  persist(
    temporal(
      (set) => ({
        ...DEFAULT_STATE,

        setLocation: (loc) => set({ location: loc, center: [loc.lng, loc.lat] }),
        setView: (center, zoom) => set({ center, zoom }),
        setZoom: (zoom) => set({ zoom }),
        setTheme: (id) => set({ themeId: id }),
        setCustomTheme: (theme) => set({ customTheme: theme, themeId: 'custom' }),
        setLayout: (id) => set({ layoutId: id }),
        setStyleOpts: (patch) => set((s) => ({ styleOpts: { ...s.styleOpts, ...patch } })),
        setLayers: (patch) => set((s) => ({ layers: { ...s.layers, ...patch } })),
        addMarker: (icon, lng, lat) =>
          set((s) => ({ markers: [...s.markers, { id: genId(), icon, lng, lat }] })),
        moveMarker: (id, lng, lat) =>
          set((s) => ({
            markers: s.markers.map((m) => (m.id === id ? { ...m, lng, lat } : m)),
          })),
        removeMarker: (id) => set((s) => ({ markers: s.markers.filter((m) => m.id !== id) })),
        clearMarkers: () => set({ markers: [] }),
        addUploadedMarker: (dataUrl) => {
          const id = genId();
          set((s) => ({ uploadedMarkers: [...s.uploadedMarkers, { id, dataUrl }] }));
          return id;
        },
        removeUploadedMarker: (id) =>
          set((s) => ({
            uploadedMarkers: s.uploadedMarkers.filter((u) => u.id !== id),
            markers: s.markers.filter((m) => m.icon !== `up:${id}`),
          })),
        setMarkerSize: (size) => set({ markerSize: size }),
        setMarkerColor: (color) => set({ markerColor: color }),
        addRoutePoint: (lng, lat) =>
          set((s) => ({ route: [...s.route, [lng, lat] as [number, number]] })),
        undoRoutePoint: () => set((s) => ({ route: s.route.slice(0, -1) })),
        clearRoute: () => set({ route: [] }),
        setRouteWidth: (w) => set({ routeWidth: w }),
        setDrawingRoute: (on) => set({ drawingRoute: on }),
        setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        setActivePanel: (panel) => set({ activePanel: panel }),
        setModalOpen: (open) => set({ modalOpen: open }),
        setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
        setExporting: (on) => set({ exporting: on }),
        setLang: (lang) => set({ lang }),
      }),
      {
        partialize: (s) => pick(s, HISTORY_KEYS) as Snapshot,
        limit: 60,
        equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
      }
    ),
    {
      name: 'kartograf-v1',
      partialize: (s) => pick(s, PERSIST_KEYS),
    }
  )
);

/** The theme currently in effect (built-in or custom). */
export function activeTheme(s: Pick<AppState, 'themeId' | 'customTheme'>): Theme {
  if (s.themeId === 'custom' && s.customTheme) return s.customTheme;
  return getTheme(s.themeId);
}

export function useActiveTheme(): Theme {
  const themeId = useStore((s) => s.themeId);
  const customTheme = useStore((s) => s.customTheme);
  return activeTheme({ themeId, customTheme });
}

export const undoHistory = () => useStore.temporal.getState();
