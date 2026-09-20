import { useStore } from '../../store';
import { useT } from '../../i18n';
import Toggle from '../Toggle';

export default function StarmapPanel() {
  const starmap = useStore((s) => s.starmap);
  const setStarmap = useStore((s) => s.setStarmap);
  const location = useStore((s) => s.location);
  const t = useT();

  return (
    <div className="panel-body">
      <h3 className="panel-title">{t.panelStarmap}</h3>
      <p className="panel-hint">{t.starmapHint}</p>

      <Toggle
        label={t.starmapEnable}
        checked={starmap.enabled}
        onChange={(v) => setStarmap({ enabled: v })}
      />

      <div className="group-label">{t.starmapWhen}</div>
      <input
        type="datetime-local"
        className="text-input"
        value={starmap.when}
        onChange={(e) => setStarmap({ when: e.target.value })}
      />
      <div className="kv">
        <span className="kv-label">{t.starmapSeenFrom}</span>
        <span className="kv-value">
          {location.name}
          {location.country ? `, ${location.country}` : ''}
        </span>
      </div>

      <div className="group-label">{t.starmapChart}</div>
      <Toggle
        label={t.starmapConstellations}
        checked={starmap.showConstellations}
        onChange={(v) => setStarmap({ showConstellations: v })}
      />
      <Toggle
        label={t.starmapGrid}
        checked={starmap.showGrid}
        onChange={(v) => setStarmap({ showGrid: v })}
      />

      <div className="slider-row">
        <span className="slider-label">{t.starmapSize}</span>
        <span className="slider-value">{Math.round(starmap.size * 100)}%</span>
      </div>
      <input
        type="range"
        min={0.5}
        max={1}
        step={0.01}
        value={starmap.size}
        onChange={(e) => setStarmap({ size: parseFloat(e.target.value) })}
        className="slider"
      />

      <div className="slider-row">
        <span className="slider-label">{t.starmapStarSize}</span>
        <span className="slider-value">{Math.round(starmap.starSize * 100)}%</span>
      </div>
      <input
        type="range"
        min={0.5}
        max={2}
        step={0.05}
        value={starmap.starSize}
        onChange={(e) => setStarmap({ starSize: parseFloat(e.target.value) })}
        className="slider"
      />
    </div>
  );
}
