import { useStore } from '../../store';
import Toggle from '../Toggle';
import { formatDistance, visibleMeters } from '../../lib/mapStyle';
import { useT } from '../../i18n';

export default function LayersPanel() {
  const { layers, setLayers, zoom, center, setZoom } = useStore();
  const t = useT();

  const meters = visibleMeters(zoom, center[1], 600);

  const rows: Array<{ key: keyof typeof layers; label: string }> = [
    { key: 'landcover', label: 'Landcover' },
    { key: 'buildings', label: 'Buildings' },
    { key: 'water', label: 'Water' },
    { key: 'parks', label: 'Parks' },
    { key: 'roads', label: 'Roads' },
    { key: 'rail', label: 'Rail' },
    { key: 'aeroway', label: 'Aeroway' },
  ];

  return (
    <div className="panel-body">
      <h3 className="panel-title">LAYERS</h3>
      <p className="panel-hint">{t.layersHint}</p>

      {rows.map((r) => (
        <Toggle
          key={r.key}
          label={r.label}
          checked={layers[r.key]}
          onChange={(v) => setLayers({ [r.key]: v })}
        />
      ))}

      <div className="group-label">{t.mapDetails}</div>
      <div className="slider-row">
        <span className="slider-label">{t.distance}</span>
        <span className="slider-value">{formatDistance(meters)}</span>
      </div>
      <input
        type="range"
        min={3}
        max={17}
        step={0.1}
        value={zoom}
        onChange={(e) => setZoom(parseFloat(e.target.value))}
        className="slider"
      />
    </div>
  );
}
