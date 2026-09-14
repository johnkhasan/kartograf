import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { reverseGeocode, searchPlaces } from '../../lib/geocode';
import { useT } from '../../i18n';
import type { GeoResult } from '../../types';

export default function LocationPanel() {
  const { location, setLocation } = useStore();
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

  const pick = (r: GeoResult) => {
    setLocation({ name: r.name, country: r.country, lat: r.lat, lng: r.lng });
    setQuery('');
    setResults([]);
  };

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const r = await reverseGeocode(latitude, longitude);
          setLocation(
            r
              ? { name: r.name, country: r.country, lat: latitude, lng: longitude }
              : { name: 'My Location', country: '', lat: latitude, lng: longitude }
          );
        } catch {
          setLocation({ name: 'My Location', country: '', lat: latitude, lng: longitude });
        }
      },
      () => setError(t.geoError)
    );
  };

  return (
    <div className="panel-body">
      <h3 className="panel-title">{t.location}</h3>
      <p className="panel-hint">{t.locationHint}</p>

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
              <li key={i} onClick={() => pick(r)} title={r.displayName}>
                {r.displayName}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button className="btn btn-secondary" onClick={locateMe}>
        {t.getMyLocation}
      </button>
      {error && <div className="error-note">{error}</div>}

      <div className="kv">
        <span className="kv-label">{t.current}</span>
        <span className="kv-value">
          {location.name}
          {location.country ? `, ${location.country}` : ''}
        </span>
      </div>
      <div className="kv">
        <span className="kv-label">{t.coordinates}</span>
        <span className="kv-value">
          {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
        </span>
      </div>
    </div>
  );
}
