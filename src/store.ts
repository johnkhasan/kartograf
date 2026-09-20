import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import { getTheme } from './data/themes';
import type { Template } from './data/templates';
import type { ProjectState } from './lib/projects';
import type {
  StarmapState,
  CollageCell,
  CollageState,
  CoupleState,
  CouplePoint,
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
  couple: CoupleState;
  collage: CollageState;
  starmap: StarmapState;
  settings: ExportSettings;
  activePanel: PanelId | null;
  modalOpen: boolean;
  exportDialogOpen: boolean;
  exporting: boolean;
  lang: Lang;
  /** 'view' right after opening someone else's share link — poster + Download
   *  only, no editing tools, until "Edit" is clicked. Not persisted. */
  viewMode: 'edit' | 'view';

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
  setMarkerLabel: (id: string, label: string) => void;
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
  applyTemplate: (tpl: Template) => void;
  loadProject: (state: ProjectState) => void;
  setCouple: (patch: Partial<CoupleState>) => void;
  setCollage: (patch: Partial<CollageState>) => void;
  setStarmap: (patch: Partial<StarmapState>) => void;
  addCollageCell: (location: LocationInfo) => void;
  updateCollageCell: (id: string, patch: Partial<CollageCell>) => void;
  removeCollageCell: (id: string) => void;
  setCouplePoint: (which: 'a' | 'b', point: CouplePoint | null) => void;
  setSettings: (patch: Partial<ExportSettings>) => void;
  setActivePanel: (panel: PanelId | null) => void;
  setModalOpen: (open: boolean) => void;
  setExportDialogOpen: (open: boolean) => void;
  setExporting: (on: boolean) => void;
  setLang: (lang: Lang) => void;
  setViewMode: (mode: 'edit' | 'view') => void;
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
  'couple',
  'collage',
  'starmap',
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
  // so a page refresh right after opening a share link doesn't drop back
  // into the full editor — the ?s= query param is stripped from the URL
  // right after being applied, so a refresh has nothing else to go on
  'viewMode',
] as const;

type Snapshot = Pick<AppState, (typeof HISTORY_KEYS)[number]>;

function pick<K extends readonly (keyof AppState)[]>(s: AppState, keys: K) {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = s[k];
  return out;
}

/** Tonight, rounded to the hour — the moment most sky posters are about. */
function defaultWhen(): string {
  const d = new Date();
  d.setHours(22, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Couple, collage and sky are three kinds of poster, not three layers: each
 * replaces what the map area shows, so turning one on turns the others off.
 * Without this, switching from a collage to a couple poster left the collage
 * on screen and the couple line drawing onto a map nobody could see.
 */
function onlyMode(s: AppState, keep: 'couple' | 'collage' | 'starmap') {
  return {
    couple: keep === 'couple' ? s.couple : { ...s.couple, enabled: false },
    collage: keep === 'collage' ? s.collage : { ...s.collage, enabled: false },
    starmap: keep === 'starmap' ? s.starmap : { ...s.starmap, enabled: false },
  };
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
  | 'couple'
  | 'collage'
  | 'starmap'
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
    textPos: 'bottom',
    textAlign: 'center',
    textOffset: 0,
    textScale: 1,
    textTracking: 1,
    divider: 'line',
    grain: 0,
    border: 'none',
  },
  layers: {
    landcover: true,
    buildings: true,
    water: true,
    parks: true,
    roads: true,
    rail: true,
    aeroway: true,
    boundaries: true,
  },
  markers: [],
  uploadedMarkers: [],
  markerSize: 32,
  markerColor: null,
  route: [],
  routeWidth: 3,
  drawingRoute: false,
  couple: {
    enabled: false,
    a: null,
    b: null,
    date: '',
    units: 'km',
    separator: '\u2665',
    showDistance: true,
    curve: true,
    dashed: false,
    lineWidth: 2.5,
  },
  collage: {
    enabled: false,
    cells: [],
    direction: 'column',
    gap: 0.03,
    showLabels: true,
  },
  starmap: {
    enabled: false,
    when: defaultWhen(),
    showConstellations: true,
    showGrid: false,
    size: 0.86,
    starSize: 1,
  },
  settings: { scale: 2, format: 'png', bleedMm: 0 },
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
        viewMode: 'edit',

        setLocation: (loc) => set({ location: loc, center: [loc.lng, loc.lat] }),
        setView: (center, zoom) => set({ center, zoom }),
        setZoom: (zoom) => set({ zoom }),
        setTheme: (id) => set({ themeId: id }),
        setCustomTheme: (theme) => set({ customTheme: theme, themeId: 'custom' }),
        setLayout: (id) => set({ layoutId: id }),
        setStyleOpts: (patch) => set((s) => ({ styleOpts: { ...s.styleOpts, ...patch } })),
        setLayers: (patch) => set((s) => ({ layers: { ...s.layers, ...patch } })),
        addMarker: (icon, lng, lat) =>
          set((s) => ({ markers: [...s.markers, { id: genId(), icon, lng, lat, label: '' }] })),
        moveMarker: (id, lng, lat) =>
          set((s) => ({
            markers: s.markers.map((m) => (m.id === id ? { ...m, lng, lat } : m)),
          })),
        setMarkerLabel: (id, label) =>
          set((s) => ({
            markers: s.markers.map((m) => (m.id === id ? { ...m, label } : m)),
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
        // one set() so a template lands as a single undo step, and so the
        // map restyles once instead of per field
        applyTemplate: (tpl) =>
          set((s) => ({
            themeId: tpl.themeId,
            layoutId: tpl.layoutId,
            styleOpts: { ...s.styleOpts, ...tpl.style },
            layers: { ...s.layers, ...tpl.layers },
            couple: { ...s.couple, ...tpl.couple },
            ...(tpl.couple?.enabled
              ? { collage: { ...s.collage, enabled: false }, starmap: { ...s.starmap, enabled: false } }
              : {}),
          })),
        loadProject: (state) => set({ ...state }),
        setCouple: (patch) =>
          set((s) => {
            const couple = { ...s.couple, ...patch };
            return patch.enabled ? { ...onlyMode(s, 'couple'), couple } : { couple };
          }),
        setCollage: (patch) =>
          set((s) => {
            const collage = { ...s.collage, ...patch };
            return patch.enabled ? { ...onlyMode(s, 'collage'), collage } : { collage };
          }),
        setStarmap: (patch) =>
          set((s) => {
            const starmap = { ...s.starmap, ...patch };
            return patch.enabled ? { ...onlyMode(s, 'starmap'), starmap } : { starmap };
          }),
        addCollageCell: (location) =>
          set((s) => ({
            collage: {
              ...s.collage,
              cells: [
                ...s.collage.cells,
                {
                  id: genId(),
                  location,
                  center: [location.lng, location.lat] as [number, number],
                  zoom: 12,
                  label: '',
                },
              ],
            },
          })),
        updateCollageCell: (id, patch) =>
          set((s) => ({
            collage: {
              ...s.collage,
              cells: s.collage.cells.map((c) => (c.id === id ? { ...c, ...patch } : c)),
            },
          })),
        removeCollageCell: (id) =>
          set((s) => ({
            collage: { ...s.collage, cells: s.collage.cells.filter((c) => c.id !== id) },
          })),
        setCouplePoint: (which, point) =>
          set((s) => ({ couple: { ...s.couple, [which]: point } })),
        setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        setActivePanel: (panel) => set({ activePanel: panel }),
        setModalOpen: (open) => set({ modalOpen: open }),
        setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
        setExporting: (on) => set({ exporting: on }),
        setLang: (lang) => set({ lang }),
        setViewMode: (mode) => set({ viewMode: mode }),
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
      /**
       * The default merge is a shallow spread, so a stored `layers` (or
       * `styleOpts`, ...) from an older build replaces the current default
       * wholesale and any field added since comes back undefined — a new
       * map layer would silently stay off for every returning visitor.
       * Merging the nested objects one level down keeps their saved choices
       * while filling in whatever is new.
       */
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          layers: { ...current.layers, ...p.layers },
          collage: { ...current.collage, ...p.collage },
          starmap: { ...current.starmap, ...p.starmap },
          styleOpts: { ...current.styleOpts, ...p.styleOpts },
          settings: { ...current.settings, ...p.settings },
          couple: { ...current.couple, ...p.couple },
        };
      },
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
