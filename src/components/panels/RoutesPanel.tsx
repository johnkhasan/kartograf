import { useStore } from '../../store';
import { useT } from '../../i18n';

export default function RoutesPanel() {
  const {
    route,
    drawingRoute,
    setDrawingRoute,
    undoRoutePoint,
    clearRoute,
    routeWidth,
    setRouteWidth,
  } = useStore();
  const t = useT();

  return (
    <div className="panel-body">
      <h3 className="panel-title">ROUTES</h3>
      <p className="panel-hint">{t.routesHint}</p>

      <button
        className={'btn ' + (drawingRoute ? 'btn-primary' : 'btn-secondary')}
        onClick={() => setDrawingRoute(!drawingRoute)}
      >
        {drawingRoute ? t.drawing : t.startDrawing}
      </button>

      <div className="kv">
        <span className="kv-label">{t.points}</span>
        <span className="kv-value">{route.length}</span>
      </div>

      <div className="group-label">{t.lineWidth}</div>
      <div className="slider-row">
        <span className="slider-label">{t.width}</span>
        <span className="slider-value">{routeWidth}px</span>
      </div>
      <input
        type="range"
        min={1}
        max={12}
        step={0.5}
        value={routeWidth}
        onChange={(e) => setRouteWidth(parseFloat(e.target.value))}
        className="slider"
      />

      <div className="btn-row">
        <button className="btn btn-secondary" onClick={undoRoutePoint} disabled={route.length === 0}>
          {t.undoPoint}
        </button>
        <button className="btn btn-danger" onClick={clearRoute} disabled={route.length === 0}>
          {t.clearRoute}
        </button>
      </div>
    </div>
  );
}
