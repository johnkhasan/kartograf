import { useState } from 'react';
import { useStore, activeTheme } from '../store';
import { getLayout } from '../data/layouts';
import { exportPoster, type ExportJob } from '../lib/export';
import { getStrings } from '../i18n';
import type { ExportSettings, ExportStage } from '../types';

export const POSTER_MAP_ID = 'poster-map';

/** True when this browser can hand a rendered poster to the OS share sheet. */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([''], 'probe.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

export function useExport() {
  const exporting = useStore((s) => s.exporting);
  const [stage, setStage] = useState<ExportStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A rendered file the share sheet refused because the tap had gone stale. */
  const [pendingShare, setPendingShare] = useState<File | null>(null);

  const render = async (
    deliver: ExportJob['deliver'],
    settingsOverride?: ExportSettings
  ): Promise<File | null> => {
    const s = useStore.getState();
    const el = document.getElementById(POSTER_MAP_ID);
    return exportPoster({
      layout: getLayout(s.layoutId),
      theme: activeTheme(s),
      layers: s.layers,
      styleOpts: s.styleOpts,
      location: s.location,
      center: s.center,
      zoom: s.zoom,
      previewMapWidth: el?.clientWidth ?? 420,
      markers: s.markers,
      uploadedMarkers: s.uploadedMarkers,
      markerSize: s.markerSize,
      markerColor: s.markerColor,
      route: s.route,
      routeWidth: s.routeWidth,
      couple: s.couple,
      collage: s.collage,
      settings: settingsOverride ?? s.settings,
      deliver,
      onProgress: setStage,
    });
  };

  const run = async <T,>(
    deliver: ExportJob['deliver'],
    after: (file: File | null) => T | Promise<T>,
    settingsOverride?: ExportSettings
  ) => {
    if (useStore.getState().exporting) return null;
    setError(null);
    useStore.getState().setExporting(true);
    try {
      return await after(await render(deliver, settingsOverride));
    } catch (e) {
      console.error(e);
      setError(getStrings(useStore.getState().lang).exportError);
      return null;
    } finally {
      setStage(null);
      useStore.getState().setExporting(false);
    }
  };

  const download = async (): Promise<boolean> => {
    const ok = await run('download', () => true);
    return ok === true;
  };

  const handOff = async (file: File): Promise<boolean> => {
    try {
      await navigator.share({ files: [file], title: 'Kartograf' });
      return true;
    } catch (e) {
      // dismissing the sheet is a decision, not a failure to recover from
      if ((e as DOMException)?.name === 'AbortError') return true;
      return false;
    }
  };

  /**
   * Renders the poster and hands it to the OS share sheet. Rendering a 300 DPI
   * poster can outlast the tap's user activation, and Safari then refuses the
   * share — so the file is kept and the dialog offers a second, immediate tap
   * rather than throwing the work away.
   */
  const shareImage = async (): Promise<'shared' | 'ready' | 'error'> => {
    setPendingShare(null);
    // the hand-off is deliberately outside run(): the OS sheet stays open for
    // as long as the person is choosing a target, and holding the exporting
    // flag across that would leave the dialog stuck on "saving…" with its
    // buttons disabled — with no way back if the sheet never resolves
    const file = await run('file', (f) => f);
    if (!file) return 'error';
    if (await handOff(file)) return 'shared';
    setPendingShare(file);
    return 'ready';
  };

  /**
   * A small JPEG of the current poster, for the saved-projects list. Rendered
   * through the same pipeline at 1x and then scaled down, so the card shows
   * the actual place rather than a generic swatch; a few kB in localStorage.
   */
  const renderThumb = async (width = 200): Promise<string> => {
    const file = await run('file', (f) => f, { scale: 1, format: 'jpeg', bleedMm: 0 });
    if (!file) return '';
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round((width * bitmap.height) / bitmap.width);
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      return canvas.toDataURL('image/jpeg', 0.7);
    } catch {
      return '';
    }
  };

  const shareReady = async (): Promise<boolean> => {
    if (!pendingShare) return false;
    const ok = await handOff(pendingShare);
    if (ok) setPendingShare(null);
    return ok;
  };

  return { download, shareImage, shareReady, renderThumb, pendingShare, exporting, stage, error };
}
