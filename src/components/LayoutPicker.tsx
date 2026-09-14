import { useStore } from '../store';
import { LAYOUTS, LAYOUT_GROUPS } from '../data/layouts';
import { useT } from '../i18n';

/**
 * The grid of layout/device cards, shared by the Layout sidebar panel and
 * the export dialog — so picking "Phone Wallpaper" works the same way
 * whether you're editing normally or downloading straight from a shared
 * link (where the sidebar isn't available at all).
 */
export default function LayoutPicker({ disabled }: { disabled?: boolean }) {
  const { layoutId, setLayout } = useStore();
  const t = useT();

  const groupLabels: Record<(typeof LAYOUT_GROUPS)[number], string> = {
    device: t.deviceGroup,
    social: t.socialGroup,
    print: t.printGroup,
  };

  return (
    <>
      {LAYOUT_GROUPS.map((g) => {
        const items = LAYOUTS.filter((l) => l.group === g);
        if (!items.length) return null;
        return (
          <div key={g}>
            <div className="group-label">{groupLabels[g]}</div>
            <div className="layout-grid">
              {items.map((l) => (
                <button
                  key={l.id}
                  className={'layout-card' + (l.id === layoutId ? ' active' : '')}
                  onClick={() => setLayout(l.id)}
                  disabled={disabled}
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
        );
      })}
    </>
  );
}
