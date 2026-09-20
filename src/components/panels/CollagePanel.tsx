import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { searchPlaces } from '../../lib/geocode';
import { useT } from '../../i18n';
import Toggle from '../Toggle';
import type { GeoResult } from '../../types';

const MAX_CELLS = 4;

export default function CollagePanel() {
  const collage = useStore((s) => s.collage);
  const setCollage = useStore((s) => s.setCollage);
  const addCollageCell = useStore((s) => s.addCollageCell);
  const updateCollageCell = useStore((s) => s.updateCollageCell);
  const removeCollageCell = useStore((s) => s.removeCollageCell);
  const t = useT();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      setBusy(true);
      try {
        setResults(await searchPlaces(query));
      } catch {
        setResults([]);
      } finally {
        setBusy(false);
      }
    }, 400);
    return () => window.clearTimeout(timer.current);
  }, [query]);

  const add = (r: GeoResult) => {
    addCollageCell({ name: r.name, country: r.country, lat: r.lat, lng: r.lng });
    if (!collage.enabled) setCollage({ enabled: true });
    setQuery('');
    setResults([]);
  };

  const addCurrent = () => {
    const loc = useStore.getState().location;
    addCollageCell(loc);
    if (!collage.enabled) setCollage({ enabled: true });
  };

  const full = collage.cells.length >= MAX_CELLS;

  return (
    <div className="panel-body">
      <h3 className="panel-title">{t.panelCollage}</h3>
      <p className="panel-hint">{t.collageHint}</p>

      <Toggle
        label={t.collageEnable}
        checked={collage.enabled}
        onChange={(v) => setCollage({ enabled: v })}
      />

      <div className="group-label">{t.collagePanels}</div>
      {collage.cells.length === 0 ? (
        <p className="panel-hint">{t.collageEmpty}</p>
      ) : (
        <ul className="cg-list">
          {collage.cells.map((cell, i) => (
            <li key={cell.id} className="cg-item">
              <div className="cg-head">
                <span className="cg-index">{i + 1}</span>
                <span className="cg-name">
                  {cell.location.name}
                  {cell.location.country ? `, ${cell.location.country}` : ''}
                </span>
                <button
                  className="mk-del"
                  onClick={() => removeCollageCell(cell.id)}
                  title={t.deleteLabel}
                >
                  ✕
                </button>
              </div>
              <input
                className="text-input mk-input"
                placeholder={t.collageLabelPlaceholder}
                value={cell.label}
                maxLength={24}
                onChange={(e) => updateCollageCell(cell.id, { label: e.target.value })}
              />
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <>
          <div className="search-box">
            <input
              className="text-input"
              placeholder={t.searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {busy && <div className="search-busy">…</div>}
            {results.length > 0 && (
              <ul className="search-results">
                {results.map((r, i) => (
                  <li key={i} onClick={() => add(r)} title={r.displayName}>
                    {r.displayName}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="btn btn-secondary" onClick={addCurrent}>
            {t.collageAddCurrent}
          </button>
        </>
      )}

      <div className="group-label">{t.collageDirection}</div>
      <div className="seg-row">
        {(
          [
            ['column', t.collageColumn],
            ['row', t.collageRow],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={'seg' + (collage.direction === id ? ' active' : '')}
            onClick={() => setCollage({ direction: id })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="slider-row">
        <span className="slider-label">{t.collageGap}</span>
        <span className="slider-value">{Math.round(collage.gap * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={0.1}
        step={0.005}
        value={collage.gap}
        onChange={(e) => setCollage({ gap: parseFloat(e.target.value) })}
        className="slider"
      />

      <Toggle
        label={t.collageLabels}
        checked={collage.showLabels}
        onChange={(v) => setCollage({ showLabels: v })}
      />
    </div>
  );
}
