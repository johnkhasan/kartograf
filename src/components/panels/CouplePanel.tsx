import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { searchPlaces } from '../../lib/geocode';
import { coupleActive, fitBothView, formatCoupleDistance, haversineMeters } from '../../lib/couple';
import { POSTER_MAP_ID } from '../../hooks/useExport';
import { useT } from '../../i18n';
import Toggle from '../Toggle';
import type { CouplePoint, GeoResult } from '../../types';

const SEPARATORS = ['♥', '&', '+', '—'];

export default function CouplePanel() {
  const couple = useStore((s) => s.couple);
  const setCouple = useStore((s) => s.setCouple);
  const setCouplePoint = useStore((s) => s.setCouplePoint);
  const t = useT();

  /** Reframes the poster around both endpoints once they exist. */
  const fitBoth = (a: CouplePoint | null, b: CouplePoint | null) => {
    if (!a || !b) return;
    const el = document.getElementById(POSTER_MAP_ID);
    const { center, zoom } = fitBothView(a, b, el?.clientWidth ?? 420, el?.clientHeight ?? 594);
    useStore.getState().setView(center, zoom);
  };

  const pick = (which: 'a' | 'b', point: CouplePoint | null) => {
    setCouplePoint(which, point);
    if (!point) return;
    const other = which === 'a' ? couple.b : couple.a;
    if (!couple.enabled) setCouple({ enabled: true });
    fitBoth(which === 'a' ? point : other, which === 'a' ? other : point);
  };

  const swap = () => setCouple({ a: couple.b, b: couple.a });

  const distance = coupleActive(couple)
    ? formatCoupleDistance(haversineMeters(couple.a, couple.b), couple.units)
    : null;

  return (
    <div className="panel-body">
      <h3 className="panel-title">{t.panelCouple}</h3>
      <p className="panel-hint">{t.coupleHint}</p>

      <Toggle
        label={t.coupleEnable}
        checked={couple.enabled}
        onChange={(v) => setCouple({ enabled: v })}
      />

      <PointPicker
        label={t.couplePointA}
        point={couple.a}
        onPick={(p) => pick('a', p)}
        onLabel={(label) => couple.a && setCouplePoint('a', { ...couple.a, label })}
      />

      <div className="couple-link">
        <span className="couple-link-line" />
        <button className="couple-swap" onClick={swap} disabled={!couple.a && !couple.b}>
          {t.coupleSwap}
        </button>
        <span className="couple-link-line" />
      </div>

      <PointPicker
        label={t.couplePointB}
        point={couple.b}
        onPick={(p) => pick('b', p)}
        onLabel={(label) => couple.b && setCouplePoint('b', { ...couple.b, label })}
      />

      <div className="group-label">{t.coupleDistance}</div>
      {distance ? (
        <div className="couple-distance">{distance}</div>
      ) : (
        <p className="panel-hint">{t.couplePickBoth}</p>
      )}
      <div className="seg-row">
        {(['km', 'mi'] as const).map((u) => (
          <button
            key={u}
            className={'seg' + (couple.units === u ? ' active' : '')}
            onClick={() => setCouple({ units: u })}
          >
            {u.toUpperCase()}
          </button>
        ))}
      </div>
      <button className="btn btn-secondary" onClick={() => fitBoth(couple.a, couple.b)} disabled={!coupleActive(couple)}>
        {t.coupleFit}
      </button>

      <div className="group-label">{t.coupleSeparator}</div>
      <div className="seg-row">
        {SEPARATORS.map((sep) => (
          <button
            key={sep}
            className={'seg' + (couple.separator === sep ? ' active' : '')}
            onClick={() => setCouple({ separator: sep })}
          >
            {sep}
          </button>
        ))}
      </div>

      <div className="group-label">{t.coupleDate}</div>
      <input
        className="text-input"
        placeholder={t.coupleDatePlaceholder}
        value={couple.date}
        onChange={(e) => setCouple({ date: e.target.value })}
      />

      <div className="group-label">{t.coupleLine}</div>
      <Toggle
        label={t.coupleShowDistance}
        checked={couple.showDistance}
        onChange={(v) => setCouple({ showDistance: v })}
      />
      <Toggle label={t.coupleCurve} checked={couple.curve} onChange={(v) => setCouple({ curve: v })} />
      <Toggle
        label={t.coupleDashed}
        checked={couple.dashed}
        onChange={(v) => setCouple({ dashed: v })}
      />
      <div className="slider-row">
        <span className="slider-label">{t.width}</span>
        <span className="slider-value">{couple.lineWidth}px</span>
      </div>
      <input
        type="range"
        min={1}
        max={12}
        step={0.5}
        value={couple.lineWidth}
        onChange={(e) => setCouple({ lineWidth: parseFloat(e.target.value) })}
        className="slider"
      />
    </div>
  );
}

interface PointPickerProps {
  label: string;
  point: CouplePoint | null;
  onPick: (p: CouplePoint | null) => void;
  onLabel: (label: string) => void;
}

function PointPicker({ label, point, onPick, onLabel }: PointPickerProps) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number>(0);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        setResults(await searchPlaces(query));
      } catch {
        setError(t.searchError);
      } finally {
        setBusy(false);
      }
    }, 400);
    return () => window.clearTimeout(timer.current);
  }, [query, t.searchError]);

  const choose = (r: GeoResult) => {
    onPick({ name: r.name, country: r.country, lat: r.lat, lng: r.lng, label: point?.label ?? '' });
    setQuery('');
    setResults([]);
  };

  const useCurrent = () => {
    const loc = useStore.getState().location;
    onPick({ ...loc, label: point?.label ?? '' });
  };

  return (
    <div className="couple-point">
      <div className="group-label">{label}</div>

      {point ? (
        <div className="couple-chosen">
          <span className="couple-chosen-name">
            {point.name}
            {point.country ? `, ${point.country}` : ''}
          </span>
          <button className="couple-chosen-clear" onClick={() => onPick(null)} title={t.coupleClear}>
            ✕
          </button>
        </div>
      ) : null}

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
              <li key={i} onClick={() => choose(r)} title={r.displayName}>
                {r.displayName}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <div className="error-note">{error}</div>}

      <div className="couple-row">
        <input
          className="text-input"
          placeholder={t.couplePersonPlaceholder}
          aria-label={t.couplePersonName}
          value={point?.label ?? ''}
          disabled={!point}
          onChange={(e) => onLabel(e.target.value)}
        />
        <button className="btn btn-secondary couple-current" onClick={useCurrent}>
          {t.coupleUseCurrent}
        </button>
      </div>
    </div>
  );
}
