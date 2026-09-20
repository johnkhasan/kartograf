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

      <div className="group-label">{t.textLayout}</div>
      <div className="seg-row">
        {(
          [
            ['top', t.textPosTop],
            ['center', t.textPosCenter],
            ['bottom', t.textPosBottom],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={'seg' + (styleOpts.textPos === id ? ' active' : '')}
            onClick={() => setStyleOpts({ textPos: id })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="group-label">{t.textAlignLabel}</div>
      <div className="seg-row">
        {(
          [
            ['left', t.textAlignLeft],
            ['center', t.textAlignCenter],
            ['right', t.textAlignRight],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={'seg' + (styleOpts.textAlign === id ? ' active' : '')}
            onClick={() => setStyleOpts({ textAlign: id })}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="slider-row">
        <span className="slider-label">{t.textOffsetLabel}</span>
        <span className="slider-value">
          {styleOpts.textOffset > 0 ? '+' : ''}
          {styleOpts.textOffset}%
        </span>
      </div>
      <input
        type="range"
        min={-25}
        max={25}
        step={0.5}
        value={styleOpts.textOffset}
        onChange={(e) => setStyleOpts({ textOffset: parseFloat(e.target.value) })}
        className="slider"
      />
      <button
        className="btn btn-secondary"
        onClick={() =>
          setStyleOpts({
            textPos: 'bottom',
            textAlign: 'center',
            textOffset: 0,
            textScale: 1,
            textTracking: 1,
          })
        }
        disabled={
          styleOpts.textPos === 'bottom' &&
          styleOpts.textAlign === 'center' &&
          styleOpts.textOffset === 0 &&
          styleOpts.textScale === 1 &&
          styleOpts.textTracking === 1
        }
      >
        {t.resetLabel}
      </button>

      <div className="group-label">{t.typography}</div>
      <div className="slider-row">
        <span className="slider-label">{t.textSize}</span>
        <span className="slider-value">{Math.round(styleOpts.textScale * 100)}%</span>
      </div>
      <input
        type="range"
        min={0.7}
        max={1.4}
        step={0.02}
        value={styleOpts.textScale}
        onChange={(e) => setStyleOpts({ textScale: parseFloat(e.target.value) })}
        className="slider"
      />
      <div className="slider-row">
        <span className="slider-label">{t.textTracking}</span>
        <span className="slider-value">{Math.round(styleOpts.textTracking * 100)}%</span>
      </div>
      <input
        type="range"
        min={0.3}
        max={1.8}
        step={0.05}
        value={styleOpts.textTracking}
        onChange={(e) => setStyleOpts({ textTracking: parseFloat(e.target.value) })}
        className="slider"
      />
      <div className="group-label">{t.divider}</div>
      <div className="seg-row">
        {(
          [
            ['line', t.dividerLine],
            ['dots', t.dividerDots],
            ['none', t.dividerNone],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={'seg' + (styleOpts.divider === id ? ' active' : '')}
            onClick={() => setStyleOpts({ divider: id })}
          >
            {label}
          </button>
        ))}
      </div>

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
