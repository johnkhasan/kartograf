import { useStore } from '../../store';
import { FONTS } from '../../data/layouts';
import Toggle from '../Toggle';
import { useT } from '../../i18n';

export default function StylePanel() {
  const { styleOpts, setStyleOpts, location } = useStore();
  const t = useT();

  return (
    <div className="panel-body">
      <h3 className="panel-title">{t.panelStyle}</h3>
      <p className="panel-hint">{t.styleHint}</p>

      <div className="group-label">{t.posterText}</div>
      <Toggle
        label={t.overlayLayer}
        checked={styleOpts.showOverlay}
        onChange={(v) => setStyleOpts({ showOverlay: v })}
      />
      <Toggle
        label={t.displayCity}
        checked={styleOpts.showCity}
        onChange={(v) => setStyleOpts({ showCity: v })}
      />
      <Toggle
        label={t.displayCountry}
        checked={styleOpts.showCountry}
        onChange={(v) => setStyleOpts({ showCountry: v })}
      />
      <Toggle
        label={t.displayCoords}
        checked={styleOpts.showCoords}
        onChange={(v) => setStyleOpts({ showCoords: v })}
      />
      <Toggle
        label={t.frame}
        checked={styleOpts.frame}
        onChange={(v) => setStyleOpts({ frame: v })}
      />

      <div className="group-label">{t.customTitle.toUpperCase()}</div>
      <input
        className="text-input"
        placeholder={`${t.titlePlaceholder} (${location.name})`}
        value={styleOpts.customTitle}
        maxLength={40}
        onChange={(e) => setStyleOpts({ customTitle: e.target.value })}
      />
      <input
        className="text-input"
        placeholder={`${t.subtitlePlaceholder}${location.country ? ` (${location.country})` : ''}`}
        value={styleOpts.customSubtitle}
        maxLength={40}
        onChange={(e) => setStyleOpts({ customSubtitle: e.target.value })}
      />

      <div className="group-label">{t.font}</div>
      <div className="font-list">
        {FONTS.map((f) => (
          <button
            key={f}
            className={'font-item' + (f === styleOpts.font ? ' active' : '')}
            style={{ fontFamily: `'${f}', sans-serif` }}
            onClick={() => setStyleOpts({ font: f })}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}
