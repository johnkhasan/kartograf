import { useStore } from '../store';
import { useT } from '../i18n';
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
  const t = useT();
  const Panel = activePanel ? PANELS[activePanel] : null;

  const TABS: Array<{ id: PanelId; label: string; icon: React.ReactNode }> = [
    { id: 'location', label: t.location, icon: <IconLocation /> },
    { id: 'theme', label: t.theme, icon: <IconTheme /> },
    { id: 'layout', label: t.layout, icon: <IconLayout /> },
    { id: 'style', label: t.panelStyle, icon: <IconType /> },
    { id: 'layers', label: t.panelLayers, icon: <IconLayers /> },
    { id: 'markers', label: t.markers, icon: <IconMarker /> },
    { id: 'routes', label: t.panelRoutes, icon: <IconRoute /> },
    { id: 'settings', label: t.panelSettings, icon: <IconSettings /> },
  ];

  return (
    <div className="sidebar">
      <nav className="rail">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={'rail-btn' + (activePanel === tab.id ? ' active' : '')}
            onClick={() => setActivePanel(activePanel === tab.id ? null : tab.id)}
            title={tab.label}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {Panel && (
        <aside className="panel">
          <button
            className="panel-close"
            onClick={() => setActivePanel(null)}
            title={t.closePanel}
          >
            <IconClose size={14} />
          </button>
          <Panel />
        </aside>
      )}
    </div>
  );
}
