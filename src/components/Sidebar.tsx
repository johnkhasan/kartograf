import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useT } from '../i18n';
import type { PanelId } from '../types';
import {
  IconClose,
  IconHeart,
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
import CouplePanel from './panels/CouplePanel';
import RoutesPanel from './panels/RoutesPanel';
import SettingsPanel from './panels/SettingsPanel';

const PANELS: Record<PanelId, React.ComponentType> = {
  location: LocationPanel,
  theme: ThemePanel,
  layout: LayoutPanel,
  style: StylePanel,
  layers: LayersPanel,
  markers: MarkersPanel,
  couple: CouplePanel,
  routes: RoutesPanel,
  settings: SettingsPanel,
};

/** Below this width the panel is a bottom sheet instead of a side column. */
const MOBILE_QUERY = '(max-width: 860px)';

export default function Sidebar() {
  const { activePanel, setActivePanel } = useStore();
  const t = useT();
  const Panel = activePanel ? PANELS[activePanel] : null;

  const railRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  );
  const [expanded, setExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ startY: number; moved: boolean } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // The poster is laid out against the area the sheet leaves free, so the
  // workspace needs to know how tall the sheet is. Only the resting height
  // is published — not the expanded one, so blowing the sheet up to read a
  // long panel doesn't re-render and re-fit the map underneath it.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--sheet-h', isMobile && Panel ? '46dvh' : '0px');
    return () => root.style.setProperty('--sheet-h', '0px');
  }, [isMobile, Panel]);

  // a fresh panel always opens at its resting height
  useEffect(() => setExpanded(false), [activePanel]);

  // with nine tabs the rail scrolls; keep the one in use on screen
  useEffect(() => {
    if (!activePanel) return;
    railRef.current
      ?.querySelector('.rail-btn.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [activePanel]);

  const onHandleDown = (e: React.PointerEvent) => {
    if (!isMobile) return;
    drag.current = { startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHandleMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    if (Math.abs(dy) > 6) drag.current.moved = true;
    // only the dismiss direction follows the finger; dragging up snaps on
    // release instead, so the panel contents aren't relaid out every frame
    setDragY(Math.max(0, dy));
  };

  const onHandleUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragY(0);
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      setExpanded((v) => !v); // a tap on the handle toggles the height
    } else if (dy > 110) {
      setActivePanel(null);
    } else if (dy > 40) {
      if (expanded) setExpanded(false);
      else setActivePanel(null);
    } else if (dy < -40) {
      setExpanded(true);
    }
  };

  const TABS: Array<{ id: PanelId; label: string; icon: React.ReactNode }> = [
    { id: 'location', label: t.location, icon: <IconLocation /> },
    { id: 'theme', label: t.theme, icon: <IconTheme /> },
    { id: 'layout', label: t.layout, icon: <IconLayout /> },
    { id: 'style', label: t.panelStyle, icon: <IconType /> },
    { id: 'layers', label: t.panelLayers, icon: <IconLayers /> },
    { id: 'markers', label: t.markers, icon: <IconMarker /> },
    { id: 'couple', label: t.panelCouple, icon: <IconHeart /> },
    { id: 'routes', label: t.panelRoutes, icon: <IconRoute /> },
    { id: 'settings', label: t.panelSettings, icon: <IconSettings /> },
  ];

  return (
    <div className="sidebar">
      <nav className="rail" ref={railRef}>
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
        <aside
          className={'panel' + (expanded ? ' panel-expanded' : '') + (dragY ? ' panel-dragging' : '')}
          style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        >
          <div
            className="sheet-handle"
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            role="presentation"
          >
            <span className="sheet-grip" />
          </div>
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
