import { useRef } from 'react';
import { useStore, useActiveTheme } from '../../store';
import { MARKER_ICONS, markerSvg } from '../../data/markerIcons';
import { useT } from '../../i18n';
import type { MarkerIconId } from '../../types';

const SWATCHES = ['#e3b04b', '#f5f5f5', '#ff5c5c', '#5eb1d6', '#7ddb8a', '#c77dff'];
const UPLOAD_MAX_PX = 256;

export default function MarkersPanel() {
  const {
    markers,
    addMarker,
    clearMarkers,
    center,
    markerSize,
    setMarkerSize,
    markerColor,
    setMarkerColor,
    uploadedMarkers,
    addUploadedMarker,
    removeUploadedMarker,
  } = useStore();

  const theme = useActiveTheme();
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const color = markerColor ?? theme.accent;
  const ids = Object.keys(MARKER_ICONS) as MarkerIconId[];
  const markerLabels: Record<MarkerIconId, string> = {
    pin: t.markerPin,
    heart: t.markerHeart,
    home: t.markerHome,
    star: t.markerStar,
    circle: t.markerCircle,
    square: t.markerSquare,
  };

  const onUpload = async (file: File) => {
    const dataUrl = await downscale(file, UPLOAD_MAX_PX);
    if (!dataUrl) return;
    const id = addUploadedMarker(dataUrl);
    addMarker(`up:${id}`, center[0], center[1]);
  };

  return (
    <div className="panel-body">
      <h3 className="panel-title">{t.markers}</h3>
      <p className="panel-hint">{t.markersHint}</p>

      <div className="group-label">{t.markerIcons}</div>
      <div className="marker-grid">
        {ids.map((id) => (
          <button
            key={id}
            className="marker-btn"
            title={markerLabels[id]}
            onClick={() => addMarker(id, center[0], center[1])}
            dangerouslySetInnerHTML={{ __html: markerSvg(id, color, 26) }}
          />
        ))}
      </div>

      <div className="group-label">{t.uploadedMarkers}</div>
      <div className="marker-grid">
        {uploadedMarkers.map((u) => (
          <div key={u.id} className="marker-btn upload-slot">
            <img
              src={u.dataUrl}
              alt=""
              onClick={() => addMarker(`up:${u.id}`, center[0], center[1])}
            />
            <button
              className="upload-del"
              title={t.deleteLabel}
              onClick={() => removeUploadedMarker(u.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
        {t.uploadMarker}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
          e.target.value = '';
        }}
      />

      <div className="group-label">{t.size}</div>
      <div className="slider-row">
        <span className="slider-label">{t.markerSize}</span>
        <span className="slider-value">{markerSize}px</span>
      </div>
      <input
        type="range"
        min={16}
        max={72}
        step={2}
        value={markerSize}
        onChange={(e) => setMarkerSize(parseInt(e.target.value))}
        className="slider"
      />

      <div className="group-label">{t.color}</div>
      <div className="swatch-row">
        <button
          className={'swatch theme-swatch' + (markerColor === null ? ' active' : '')}
          style={{ background: theme.accent }}
          title={t.themeAccent}
          onClick={() => setMarkerColor(null)}
        />
        {SWATCHES.map((c) => (
          <button
            key={c}
            className={'swatch' + (markerColor === c ? ' active' : '')}
            style={{ background: c }}
            onClick={() => setMarkerColor(c)}
          />
        ))}
      </div>

      {markers.length > 0 && (
        <button className="btn btn-danger" onClick={clearMarkers}>
          {t.clearMarkers(markers.length)}
        </button>
      )}
    </div>
  );
}

/** Downscale an uploaded image to keep localStorage small; returns a PNG data URL. */
async function downscale(file: File, maxPx: number): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });
    const k = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}
