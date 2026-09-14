import { useStore } from '../../store';
import { getLayout } from '../../data/layouts';
import { useT } from '../../i18n';
import LayoutPicker from '../LayoutPicker';

export default function LayoutPanel() {
  const { layoutId } = useStore();
  const active = getLayout(layoutId);
  const t = useT();

  return (
    <div className="panel-body">
      <h3 className="panel-title">
        {t.layout}: {active.name.toUpperCase()}
      </h3>
      <p className="panel-hint">{t.layoutHint}</p>
      <LayoutPicker />
    </div>
  );
}
