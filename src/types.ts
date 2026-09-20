export interface Theme {
  id: string;
  name: string;
  description: string;
  bg: string;
  water: string;
  park: string;
  landcover: string;
  building: string;
  roadMajor: string;
  roadMid: string;
  roadMinor: string;
  rail: string;
  aeroway: string;
  text: string;
  accent: string;
}

export interface Layout {
  id: string;
  name: string;
  group: 'device' | 'print' | 'social';
  /** physical size label, e.g. "21 x 29.7 cm" or "1080 x 1350 px" */
  sizeLabel: string;
  /** aspect ratio w/h */
  ratio: number;
  /** export size in px (long edge derived from this width) */
  exportWidth: number;
  exportHeight: number;
}

export interface LocationInfo {
  name: string;
  country: string;
  lat: number;
  lng: number;
}

export interface GeoResult extends LocationInfo {
  displayName: string;
}

export type MarkerIconId =
  | 'pin'
  | 'heart'
  | 'home'
  | 'star'
  | 'circle'
  | 'square';

/** Built-in icon id, or an uploaded marker reference: "up:<uploadId>" */
export type MarkerIcon = MarkerIconId | `up:${string}`;

export interface PosterMarker {
  id: string;
  icon: MarkerIcon;
  lng: number;
  lat: number;
}

export interface UploadedMarker {
  id: string;
  dataUrl: string;
}

export type DistanceUnit = 'km' | 'mi';

/** One half of a couple poster: a place plus the person's name shown on it. */
export interface CouplePoint {
  name: string;
  country: string;
  lat: number;
  lng: number;
  /** person's name on the poster; empty = fall back to the place name */
  label: string;
}

export interface CoupleState {
  enabled: boolean;
  a: CouplePoint | null;
  b: CouplePoint | null;
  /** free text shown next to the distance, e.g. a first-met date */
  date: string;
  units: DistanceUnit;
  /** glyph between the two names in the poster title */
  separator: string;
  showDistance: boolean;
  /** bowed flight-map style curve instead of the direct great-circle path */
  curve: boolean;
  dashed: boolean;
  lineWidth: number;
}

export interface LayerToggles {
  landcover: boolean;
  buildings: boolean;
  water: boolean;
  parks: boolean;
  roads: boolean;
  rail: boolean;
  aeroway: boolean;
  boundaries: boolean;
}

export interface StyleOptions {
  showOverlay: boolean;
  showCity: boolean;
  showCountry: boolean;
  showCoords: boolean;
  font: string;
  /** empty string = use location name / country */
  customTitle: string;
  customSubtitle: string;
  /** classic framed poster look (map inset on a solid border) */
  frame: boolean;
  /** which edge the text block is anchored to */
  textPos: 'top' | 'center' | 'bottom';
  textAlign: 'left' | 'center' | 'right';
  /** nudge along the vertical, in % of poster height (positive = downwards) */
  textOffset: number;
}

export interface ExportSettings {
  scale: 1 | 2 | 3;
  format: 'png' | 'jpeg' | 'pdf';
}

export type ExportStage = 'preparing' | 'rendering' | 'compositing' | 'saving';

export type PanelId =
  | 'templates'
  | 'location'
  | 'theme'
  | 'layout'
  | 'style'
  | 'layers'
  | 'markers'
  | 'couple'
  | 'routes'
  | 'settings';

export type Lang = 'uz' | 'en';
