import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import PosterPreview from './components/PosterPreview';
import SummaryPanel from './components/SummaryPanel';
import LocationModal from './components/LocationModal';
import { IconCrosshair, IconDownload, IconLogo, IconRedo, IconShare, IconUndo } from './components/Icons';
import { useStore, undoHistory } from './store';
import { decodeShare, shareUrl } from './lib/share';
import { useExport } from './hooks/useExport';
import { useT } from './i18n';
import './App.css';

export default function App() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const [copied, setCopied] = useState(false);
  const { download, exporting } = useExport();

  // apply shared state from ?s=... once on load
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('s');
    if (!code) return;
    const data = decodeShare(code);
    if (data) {
      useStore.setState({ ...data, modalOpen: false });
      undoHistory().clear();
    }
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // undo / redo keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        const h = undoHistory();
        if (e.shiftKey) h.redo();
        else h.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(useStore.getState()));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — show the URL via prompt as fallback
      window.prompt('URL:', shareUrl(useStore.getState()));
    }
  };

  const recenter = () => {
    const s = useStore.getState();
    s.setView([s.location.lng, s.location.lat], s.zoom);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <IconLogo size={26} />
          <span className="brand-name">KARTOGRAF</span>
          <span className="brand-tag">FREE MAP POSTER &amp; WALLPAPER CREATOR</span>
        </div>
        <div className="topbar-right">
          <button className="icon-btn" title={t.undoTip} onClick={() => undoHistory().undo()}>
            <IconUndo size={15} />
          </button>
          <button className="icon-btn" title={t.redoTip} onClick={() => undoHistory().redo()}>
            <IconRedo size={15} />
          </button>
          <button className="topbar-btn" onClick={share}>
            <IconShare size={13} /> {copied ? t.copied : t.share}
          </button>
          <div className="lang-toggle">
            <button
              className={lang === 'uz' ? 'active' : ''}
              onClick={() => setLang('uz')}
            >
              UZ
            </button>
            <button
              className={lang === 'en' ? 'active' : ''}
              onClick={() => setLang('en')}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <main className="layout-main">
        <Sidebar />
        <PosterPreview />
        <SummaryPanel />
      </main>

      <div className="mobile-bar">
        <button className="btn btn-secondary" onClick={recenter}>
          <IconCrosshair size={15} /> {t.recenter}
        </button>
        <button className="btn btn-primary" onClick={download} disabled={exporting}>
          <IconDownload size={15} /> {exporting ? '…' : t.download}
        </button>
      </div>

      <LocationModal />
    </div>
  );
}
