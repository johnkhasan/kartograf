import { useStore } from '../store';
import { getLayout } from '../data/layouts';
import { outputDims } from '../lib/export';
import { canShareFiles, useExport } from '../hooks/useExport';
import { useT } from '../i18n';
import { IconDownload, IconShare } from './Icons';
import LayoutPicker from './LayoutPicker';

export default function ExportDialog() {
  const t = useT();
  const { exportDialogOpen, setExportDialogOpen, settings, setSettings, layoutId } = useStore();
  const layout = getLayout(layoutId);
  const { download, shareImage, shareReady, pendingShare, exporting, stage, error } = useExport();
  const shareable = canShareFiles();

  if (!exportDialogOpen) return null;

  const stageText =
    stage === 'preparing'
      ? t.stagePreparing
      : stage === 'rendering'
        ? t.stageRendering
        : stage === 'compositing'
          ? t.stageCompositing
          : stage === 'saving'
            ? t.stageSaving
            : t.download;

  const dims = (scale: number) => {
    const { w, h } = outputDims(layout, scale);
    return `${w} × ${h} px`;
  };

  const confirmDownload = async () => {
    const ok = await download();
    // keep the dialog open on failure so the error message stays visible
    if (ok) setExportDialogOpen(false);
  };

  const confirmShare = async () => {
    if (pendingShare) {
      if (await shareReady()) setExportDialogOpen(false);
      return;
    }
    if ((await shareImage()) === 'shared') setExportDialogOpen(false);
  };

  return (
    <div className="modal-backdrop" onClick={() => !exporting && setExportDialogOpen(false)}>
      <div className="modal export-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-label">{t.exportDialogTitle}</div>

        <div className="modal-scroll">
          <div className="group-label">{t.layoutDeviceSection}</div>
          <LayoutPicker disabled={exporting} />

          <div className="group-label">{t.exportQuality}</div>
          <div className="seg-row">
            {([1, 2, 3] as const).map((sc) => (
              <button
                key={sc}
                className={'seg' + (settings.scale === sc ? ' active' : '')}
                onClick={() => setSettings({ scale: sc })}
                disabled={exporting}
              >
                {sc}x
              </button>
            ))}
          </div>
          <div className="kv">
            <span className="kv-label">{t.outputSize}</span>
            <span className="kv-value">{dims(settings.scale)}</span>
          </div>

          <div className="group-label">{t.format}</div>
          <div className="seg-row">
            {(['png', 'jpeg', 'pdf'] as const).map((f) => (
              <button
                key={f}
                className={'seg' + (settings.format === f ? ' active' : '')}
                onClick={() => setSettings({ format: f })}
                disabled={exporting}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          {settings.format === 'pdf' && layout.widthMm && (
            <>
              <div className="group-label">{t.bleed}</div>
              <div className="seg-row">
                {([0, 3, 5] as const).map((mm) => (
                  <button
                    key={mm}
                    className={'seg' + (settings.bleedMm === mm ? ' active' : '')}
                    onClick={() => setSettings({ bleedMm: mm })}
                    disabled={exporting}
                  >
                    {mm === 0 ? t.bleedNone : `${mm} mm`}
                  </button>
                ))}
              </div>
              <div className="kv">
                <span className="kv-label">{t.pageSize}</span>
                <span className="kv-value">
                  {layout.widthMm + settings.bleedMm * 2} × {layout.heightMm! + settings.bleedMm * 2} mm
                </span>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          {error && <div className="error-note">{error}</div>}
          {shareable && (
            <button
              className={'btn ' + (pendingShare ? 'btn-primary' : 'btn-secondary')}
              onClick={confirmShare}
              disabled={exporting}
            >
              <IconShare size={14} />
              {exporting ? stageText : pendingShare ? t.shareReady : t.shareImage}
            </button>
          )}
          <div className="btn-row">
            <button
              className="btn btn-secondary"
              onClick={() => setExportDialogOpen(false)}
              disabled={exporting}
            >
              {t.cancel}
            </button>
            <button className="btn btn-primary" onClick={confirmDownload} disabled={exporting}>
              <IconDownload size={15} />
              {exporting ? stageText : t.download}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
