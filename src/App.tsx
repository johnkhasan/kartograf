import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import PosterPreview from './components/PosterPreview';
import SummaryPanel from './components/SummaryPanel';
import ViewerPanel from './components/ViewerPanel';
import LocationModal from './components/LocationModal';
import ExportDialog from './components/ExportDialog';
import LangMenu from './components/LangMenu';
import { IconCrosshair, IconDownload, IconEdit, IconLogo, IconRedo, IconShare, IconUndo } from './components/Icons';
import { useStore, undoHistory } from './store';
import { decodeShare, shortShareUrl } from './lib/share';
import { useT } from './i18n';
import './App.css';

export default function App() {
  const t = useT();
  const setExportDialogOpen = useStore((s) => s.setExportDialogOpen);
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const isViewer = viewMode === 'view';

  // apply shared state from ?s=... once on load — recipients land in a
  // read-only viewer (poster + Download only) until they choose to Edit
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('s');
    if (!code) return;
    const data = decodeShare(code);
    if (data) {
      useStore.setState({ ...data, modalOpen: false, viewMode: 'view' });
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
    if (sharing) return;
    setSharing(true);
    try {
      const url = await shortShareUrl(useStore.getState());

      // On a phone the native sheet is how a link actually gets passed on
      // (Telegram, WhatsApp, Messages); copying to a clipboard the user then
      // has to paste somewhere is the desktop behaviour.
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        try {
          await navigator.share({ title: 'Kartograf', url });
          return;
        } catch (e) {
          // dismissing the sheet is not a failure worth falling back from
          if ((e as DOMException)?.name === 'AbortError') return;
        }
      }

      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // clipboard unavailable — show the URL via prompt as fallback
        window.prompt('URL:', url);
      }
    } finally {
      setSharing(false);
    }
  };

  // Publish the real visible height; the app box is clamped to it so the
  // bottom bars can't be pushed off-screen by a dvh that reads taller.
  useEffect(() => {
    const publish = () =>
      document.documentElement.style.setProperty('--vh', `${window.innerHeight}px`);
    publish();
    window.addEventListener('resize', publish);
    window.addEventListener('orientationchange', publish);
    return () => {
      window.removeEventListener('resize', publish);
      window.removeEventListener('orientationchange', publish);
    };
  }, []);

  const recenter = () => {
    const s = useStore.getState();
    s.setView([s.location.lng, s.location.lat], s.zoom);
  };

  return (
    <div className="app">
      <h1 className="sr-only">
        Kartograf — xarita poster va wallpaper yaratuvchi (free map poster &amp; wallpaper
        creator)
      </h1>
      <header className="topbar">
        <div className="brand">
          <IconLogo size={26} />
          <span className="brand-name">KARTOGRAF</span>
          <span className="brand-tag">{t.brandTag}</span>
        </div>
        <div className="topbar-right">
          {isViewer ? (
            <button className="topbar-btn topbar-btn-accent" onClick={() => setViewMode('edit')}>
              <IconEdit size={13} /> <span className="topbar-btn-label">{t.edit}</span>
            </button>
          ) : (
            <>
              <button className="icon-btn" title={t.undoTip} onClick={() => undoHistory().undo()}>
                <IconUndo size={15} />
              </button>
              <button className="icon-btn" title={t.redoTip} onClick={() => undoHistory().redo()}>
                <IconRedo size={15} />
              </button>
              <button className="topbar-btn" onClick={share} disabled={sharing}>
                <IconShare size={13} />{' '}
                <span className="topbar-btn-label">{copied ? t.copied : sharing ? '…' : t.share}</span>
              </button>
            </>
          )}
          <LangMenu />
        </div>
      </header>

      <main className="layout-main">
        {!isViewer && <Sidebar />}
        <PosterPreview />
        {isViewer ? <ViewerPanel /> : <SummaryPanel />}
      </main>

      <div className="mobile-bar">
        {!isViewer && (
          <button className="btn btn-secondary" onClick={recenter}>
            <IconCrosshair size={15} /> {t.recenter}
          </button>
        )}
        <button className="btn btn-primary" onClick={() => setExportDialogOpen(true)}>
          <IconDownload size={15} /> {t.download}
        </button>
      </div>

      <LocationModal />
      <ExportDialog />
    </div>
  );
}
