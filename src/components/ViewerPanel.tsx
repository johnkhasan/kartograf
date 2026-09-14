import { useStore } from '../store';
import { useT } from '../i18n';
import { IconDownload } from './Icons';

/** Right-column panel shown instead of SummaryPanel while viewMode === 'view'
 *  — a recipient opening a shared link sees only this, not the editing UI. */
export default function ViewerPanel() {
  const t = useT();
  const setExportDialogOpen = useStore((s) => s.setExportDialogOpen);

  return (
    <aside className="summary viewer-panel">
      <p className="panel-hint">{t.viewerHint}</p>
      <button
        className="btn btn-primary btn-download"
        onClick={() => setExportDialogOpen(true)}
      >
        <IconDownload size={16} />
        {t.download}
      </button>
    </aside>
  );
}
