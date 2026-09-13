import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { reverseGeocode, searchPlaces } from '../lib/geocode';
import { useT } from '../i18n';
import type { GeoResult } from '../types';
import { IconLogo } from './Icons';

export default function LocationModal() {
  const { modalOpen, setModalOpen, setLocation } = useStore();
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [picked, setPicked] = useState<GeoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number>(0);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (query.trim().length < 2 || picked) {
      setResults([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        setError(null);
        setResults(await searchPlaces(query));
      } catch {
        setError(t.searchError);
      }
    }, 400);
    return () => window.clearTimeout(timer.current);
  }, [query, picked, t.searchError]);

  if (!modalOpen) return null;

  const confirm = () => {
    if (picked) {
      setLocation({
        name: picked.name,
        country: picked.country,
        lat: picked.lat,
        lng: picked.lng,
      });
    }
    setModalOpen(false);
  };

  const locateMe = () => {
    if (!navigator.geolocation) return;
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
        setModalOpen(false);
      },
      () => setError(t.geoError)
    );
  };

  return (
    <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-logo">
          <IconLogo size={44} />
          <div className="modal-brand">KARTOGRAF</div>
        </div>
        <div className="modal-label">{t.chooseLocation}</div>
        <input
          autoFocus
          className="text-input"
          placeholder={t.searchPlaceholder}
          value={picked ? picked.displayName : query}
          onChange={(e) => {
            setPicked(null);
            setQuery(e.target.value);
          }}
        />
        {results.length > 0 && (
          <ul className="search-results modal-results">
            {results.map((r, i) => (
              <li
                key={i}
                onClick={() => {
                  setPicked(r);
                  setResults([]);
                }}
              >
                {r.displayName}
              </li>
            ))}
          </ul>
        )}
        {error && <div className="error-note">{error}</div>}
        <button className="btn btn-secondary" onClick={locateMe}>
          {t.getMyLocation}
        </button>
        <button className="btn btn-primary" onClick={confirm}>
          {t.ok}
        </button>
      </div>
    </div>
  );
}
