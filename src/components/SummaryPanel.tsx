import { useStore, useActiveTheme } from '../store';
import { getLayout } from '../data/layouts';
import { useT } from '../i18n';
import { IconCrosshair, IconDownload } from './Icons';

export default function SummaryPanel() {
  const s = useStore();
  const theme = useActiveTheme();
  const layout = getLayout(s.layoutId);
  const t = useT();

  const recenter = () => {
    s.setView([s.location.lng, s.location.lat], s.zoom);
  };

  return (
    <aside className="summary">
      <h3 className="panel-title">{t.currentSettings}</h3>
      <div className="summary-grid">
        <div>
          <div className="kv-label">{t.location}</div>
          <div className="kv-value">
            {s.location.name}
            {s.location.country ? `, ${s.location.country}` : ''}
          </div>
        </div>
        <div>
          <div className="kv-label">{t.theme}</div>
          <div className="kv-value">{theme.name}</div>
        </div>
        <div>
          <div className="kv-label">{t.layout}</div>
          <div className="kv-value">{layout.name}</div>
        </div>
        <div>
          <div className="kv-label">{t.posterSize}</div>
          <div className="kv-value">{layout.sizeLabel}</div>
        </div>
        <div>
          <div className="kv-label">{t.markers}</div>
          <div className="kv-value">{t.markersCount(s.markers.length)}</div>
        </div>
        <div>
          <div className="kv-label">{t.coordinates}</div>
          <div className="kv-value">
            {s.location.lat.toFixed(4)}, {s.location.lng.toFixed(4)}
          </div>
        </div>
      </div>

      <button className="btn btn-secondary" onClick={recenter}>
        <IconCrosshair size={15} /> {t.recenter}
      </button>

      <button
        className="btn btn-primary btn-download"
        onClick={() => s.setExportDialogOpen(true)}
      >
        <IconDownload size={16} />
        {t.download}
      </button>
    </aside>
  );
}
