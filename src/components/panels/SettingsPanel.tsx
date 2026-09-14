import { useStore } from '../../store';
import { getLayout } from '../../data/layouts';
import { outputDims } from '../../lib/export';
import { useT } from '../../i18n';

export default function SettingsPanel() {
  const { settings, setSettings, layoutId } = useStore();
  const layout = getLayout(layoutId);
  const t = useT();

  const dims = (scale: number) => {
    const { w, h } = outputDims(layout, scale);
    return `${w} × ${h} px`;
  };

  return (
    <div className="panel-body">
      <h3 className="panel-title">SETTINGS</h3>
      <p className="panel-hint">{t.settingsHint}</p>

      <div className="group-label">{t.exportQuality}</div>
      <div className="seg-row">
        {([1, 2, 3] as const).map((s) => (
          <button
            key={s}
            className={'seg' + (settings.scale === s ? ' active' : '')}
            onClick={() => setSettings({ scale: s })}
          >
            {s}x
          </button>
        ))}
      </div>
      <div className="kv">
        <span className="kv-label">{t.outputSize}</span>
        <span className="kv-value">{dims(settings.scale)}</span>
      </div>

      <div className="group-label">{t.format}</div>
      <div className="seg-row">
        {(['png', 'jpeg', 'pdf'] as const).map((f) => (
          <button
            key={f}
            className={'seg' + (settings.format === f ? ' active' : '')}
            onClick={() => setSettings({ format: f })}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
