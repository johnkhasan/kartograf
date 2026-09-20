import type { CoupleState, LayerToggles, PanelId, StyleOptions } from '../types';

/**
 * A one-tap starting point. A template only sets how the poster *looks* —
 * never the location, markers or route the user has already put in — so it
 * stays safe to try one out on a design in progress.
 */
export interface Template {
  id: string;
  themeId: string;
  layoutId: string;
  style: Partial<StyleOptions>;
  layers?: Partial<LayerToggles>;
  couple?: Partial<CoupleState>;
  /** panel to open afterwards, when the template needs input to finish */
  opens?: PanelId;
}

export const TEMPLATES: Template[] = [
  {
    id: 'couple',
    themeId: 'blush',
    layoutId: 'a4-portrait',
    style: {
      font: 'Playfair Display',
      frame: false,
      showOverlay: true,
      showCity: true,
      showCountry: true,
      showCoords: true,
      textPos: 'bottom',
      textAlign: 'center',
      textOffset: 0,
    },
    couple: { enabled: true, separator: '♥', curve: true, dashed: false, showDistance: true },
    opens: 'couple',
  },
  {
    id: 'birthplace',
    themeId: 'carrara',
    layoutId: 'a4-portrait',
    style: {
      font: 'Playfair Display',
      frame: true,
      showCity: true,
      showCountry: true,
      showCoords: true,
      textPos: 'bottom',
      textAlign: 'center',
      textOffset: 0,
    },
  },
  {
    id: 'wedding',
    themeId: 'noir',
    layoutId: 'a4-portrait',
    style: {
      font: 'Raleway',
      frame: true,
      showCity: true,
      showCountry: false,
      showCoords: true,
      textPos: 'bottom',
      textAlign: 'center',
      textOffset: 0,
    },
  },
  {
    id: 'wallpaper',
    themeId: 'midnight-blue',
    layoutId: 'phone-wallpaper',
    style: {
      font: 'Space Grotesk',
      frame: false,
      showOverlay: true,
      showCity: true,
      showCountry: false,
      showCoords: true,
      textPos: 'bottom',
      textAlign: 'center',
      textOffset: 0,
    },
  },
  {
    id: 'minimal',
    themeId: 'arctic',
    layoutId: 'a4-portrait',
    style: {
      font: 'Space Grotesk',
      frame: false,
      showOverlay: false,
      showCity: true,
      showCountry: false,
      showCoords: false,
      textPos: 'bottom',
      textAlign: 'left',
      textOffset: 0,
    },
    layers: { buildings: false, landcover: false, rail: false, aeroway: false },
  },
  {
    id: 'route',
    themeId: 'evergreen',
    layoutId: 'a4-landscape',
    style: {
      font: 'Oswald',
      frame: false,
      showOverlay: true,
      showCity: true,
      showCountry: false,
      showCoords: true,
      textPos: 'bottom',
      textAlign: 'center',
      textOffset: 0,
    },
    opens: 'routes',
  },
];

export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id);
