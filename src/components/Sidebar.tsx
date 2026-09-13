import { useStore } from '../store';
import type { PanelId } from '../types';
import {
  IconClose,
  IconLayers,
  IconLayout,
  IconLocation,
  IconMarker,
  IconRoute,
  IconSettings,
  IconTheme,
  IconType,
} from './Icons';
import LocationPanel from './panels/LocationPanel';
import ThemePanel from './panels/ThemePanel';
import LayoutPanel from './panels/LayoutPanel';
import StylePanel from './panels/StylePanel';
import LayersPanel from './panels/LayersPanel';
import MarkersPanel from './panels/MarkersPanel';
import RoutesPanel from './panels/RoutesPanel';
import SettingsPanel from './panels/SettingsPanel';

const TABS: Array<{ id: PanelId; label: string; icon: React.ReactNode }> = [
  { id: 'location', label: 'LOCATION', icon: <IconLocation /> },
  { id: 'theme', label: 'THEME', icon: <IconTheme /> },
  { id: 'layout', label: 'LAYOUT', icon: <IconLayout /> },
  { id: 'style', label: 'STYLE', icon: <IconType /> },
  { id: 'layers', label: 'LAYERS', icon: <IconLayers /> },
  { id: 'markers', label: 'MARKERS', icon: <IconMarker /> },
  { id: 'routes', label: 'ROUTES', icon: <IconRoute /> },
  { id: 'settings', label: 'SETTINGS', icon: <IconSettings /> },
];

const PANELS: Record<PanelId, React.ComponentType> = {
  location: LocationPanel,
  theme: ThemePanel,
  layout: LayoutPanel,
  style: StylePanel,
  layers: LayersPanel,
  markers: MarkersPanel,
  routes: RoutesPanel,
  settings: SettingsPanel,
};

export default function Sidebar() {
  const { activePanel, setActivePanel } = useStore();
  const Panel = activePanel ? PANELS[activePanel] : null;

  return (
    <div className="sidebar">
      <nav className="rail">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'rail-btn' + (activePanel === t.id ? ' active' : '')}
            onClick={() => setActivePanel(activePanel === t.id ? null : t.id)}
            title={t.label}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {Panel && (
        <aside className="panel">
          <button
            className="panel-close"
            onClick={() => setActivePanel(null)}
            title="Close panel"
          >
            <IconClose size={14} />
          </button>
          <Panel />
        </aside>
      )}
    </div>
  );
}
