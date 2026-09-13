import { useState } from 'react';
import { useStore, useActiveTheme } from '../../store';
import { THEMES } from '../../data/themes';
import { useT } from '../../i18n';
import type { Theme } from '../../types';

const COLOR_FIELDS: Array<{ key: keyof Theme; label: string }> = [
  { key: 'bg', label: 'Background' },
  { key: 'water', label: 'Water' },
  { key: 'park', label: 'Parks' },
  { key: 'landcover', label: 'Landcover' },
  { key: 'building', label: 'Buildings' },
  { key: 'roadMajor', label: 'Roads · major' },
  { key: 'roadMid', label: 'Roads · mid' },
  { key: 'roadMinor', label: 'Roads · minor' },
  { key: 'rail', label: 'Rail' },
  { key: 'aeroway', label: 'Aeroway' },
  { key: 'text', label: 'Poster text' },
  { key: 'accent', label: 'Accent' },
];

export default function ThemePanel() {
  const { themeId, customTheme, setTheme, setCustomTheme } = useStore();
  const active = useActiveTheme();
  const t = useT();
  const [editing, setEditing] = useState(false);

  const startEditing = () => {
    if (themeId !== 'custom' || !customTheme) {
      setCustomTheme({ ...active, id: 'custom', name: 'Custom', description: t.themeHintCustom });
    }
    setEditing(true);
  };

  const setColor = (key: keyof Theme, value: string) => {
    const base = customTheme ?? active;
    setCustomTheme({ ...base, id: 'custom', name: 'Custom', [key]: value });
  };

  return (
    <div className="panel-body">
      <h3 className="panel-title">THEME: {active.name.toUpperCase()}</h3>
      <p className="panel-hint">{active.description}</p>

      <button className="btn btn-secondary" onClick={editing ? () => setEditing(false) : startEditing}>
        {editing ? '← ' + t.theme : t.customize}
      </button>

      {editing ? (
        <div className="theme-editor">
          {COLOR_FIELDS.map((f) => (
            <label key={f.key} className="color-row">
              <span>{f.label}</span>
              <input
                type="color"
                value={(customTheme ?? active)[f.key] as string}
                onChange={(e) => setColor(f.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      ) : (
        <div className="theme-list">
          {customTheme && (
            <button
              className={'theme-card' + (themeId === 'custom' ? ' active' : '')}
              style={{ background: customTheme.bg }}
              onClick={() => setTheme('custom')}
            >
              <div className="theme-swatches">
                {[
                  customTheme.roadMajor,
                  customTheme.roadMid,
                  customTheme.water,
                  customTheme.park,
                  customTheme.building,
                ].map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </div>
              <span className="theme-name" style={{ color: customTheme.text }}>
                {t.customTheme}
              </span>
            </button>
          )}
          {THEMES.map((th) => (
            <button
              key={th.id}
              className={'theme-card' + (th.id === themeId ? ' active' : '')}
              style={{ background: th.bg }}
              onClick={() => setTheme(th.id)}
            >
              <div className="theme-swatches">
                {[th.roadMajor, th.roadMid, th.water, th.park, th.building].map((c, i) => (
                  <span key={i} style={{ background: c }} />
                ))}
              </div>
              <span className="theme-name" style={{ color: th.text }}>
                {th.name.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
