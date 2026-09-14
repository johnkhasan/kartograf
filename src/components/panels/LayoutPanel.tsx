import { useStore } from '../../store';
import { LAYOUTS, getLayout } from '../../data/layouts';
import { useT } from '../../i18n';

export default function LayoutPanel() {
  const { layoutId, setLayout } = useStore();
  const active = getLayout(layoutId);
  const t = useT();
  const groups: Array<{ key: 'print' | 'social'; label: string }> = [
    { key: 'print', label: t.printGroup },
    { key: 'social', label: t.socialGroup },
  ];

  return (
    <div className="panel-body">
      <h3 className="panel-title">
        {t.layout}: {active.name.toUpperCase()}
      </h3>
      <p className="panel-hint">{t.layoutHint}</p>

      {groups.map((g) => (
        <div key={g.key}>
          <div className="group-label">{g.label}</div>
          <div className="layout-grid">
            {LAYOUTS.filter((l) => l.group === g.key).map((l) => (
              <button
                key={l.id}
                className={'layout-card' + (l.id === layoutId ? ' active' : '')}
                onClick={() => setLayout(l.id)}
              >
                <div className="layout-card-name">{l.name.toUpperCase()}</div>
                <div className="layout-card-size">{l.sizeLabel}</div>
                <div className="layout-thumb-wrap">
                  <div
                    className="layout-thumb"
                    style={
                      l.ratio >= 1
                        ? { width: 44, height: Math.max(16, 44 / l.ratio) }
                        : { height: 44, width: Math.max(16, 44 * l.ratio) }
                    }
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
