import { useState } from 'react';
import { useStore, activeTheme } from '../store';
import { getLayout } from '../data/layouts';
import { exportPoster } from '../lib/export';
import { getStrings } from '../i18n';
import type { ExportStage } from '../types';

export const POSTER_MAP_ID = 'poster-map';

export function useExport() {
  const exporting = useStore((s) => s.exporting);
  const [stage, setStage] = useState<ExportStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (): Promise<boolean> => {
    const s = useStore.getState();
    if (s.exporting) return false;
    setError(null);
    s.setExporting(true);
    try {
      const el = document.getElementById(POSTER_MAP_ID);
      const previewMapWidth = el?.clientWidth ?? 420;
      await exportPoster({
        layout: getLayout(s.layoutId),
        theme: activeTheme(s),
        layers: s.layers,
        styleOpts: s.styleOpts,
        location: s.location,
        center: s.center,
        zoom: s.zoom,
        previewMapWidth,
        markers: s.markers,
        uploadedMarkers: s.uploadedMarkers,
        markerSize: s.markerSize,
        markerColor: s.markerColor,
        route: s.route,
        routeWidth: s.routeWidth,
        settings: s.settings,
        onProgress: setStage,
      });
      return true;
    } catch (e) {
      console.error(e);
      setError(getStrings(useStore.getState().lang).exportError);
      return false;
    } finally {
      setStage(null);
      useStore.getState().setExporting(false);
    }
  };

  return { download, exporting, stage, error };
}
