import { useState } from 'react';
import { useStore } from '../../store';
import { TEMPLATES, type Template } from '../../data/templates';
import { getTheme } from '../../data/themes';
import { getLayout } from '../../data/layouts';
import { useExport } from '../../hooks/useExport';
import {
  defaultProjectName,
  deleteProject,
  listProjects,
  newProjectId,
  projectState,
  ProjectStorageError,
  saveProject,
  type Project,
} from '../../lib/projects';
import { useT } from '../../i18n';

export default function StartPanel() {
  const applyTemplate = useStore((s) => s.applyTemplate);
  const loadProject = useStore((s) => s.loadProject);
  const setActivePanel = useStore((s) => s.setActivePanel);
  const themeId = useStore((s) => s.themeId);
  const layoutId = useStore((s) => s.layoutId);
  const t = useT();

  const { renderThumb, exporting } = useExport();
  const [projects, setProjects] = useState<Project[]>(() => listProjects());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const save = async () => {
    setSaveError(null);
    const s = useStore.getState();
    // the thumbnail is worth a couple of seconds: without it the list is a
    // column of near-identical rows
    const thumb = await renderThumb();
    try {
      setProjects(
        saveProject({
          id: newProjectId(),
          name: defaultProjectName(s),
          savedAt: Date.now(),
          thumb,
          state: projectState(s),
        })
      );
    } catch (e) {
      setSaveError(e instanceof ProjectStorageError ? t.projectQuota : t.exportError);
    }
  };

  const applyTpl = (tpl: Template) => {
    applyTemplate(tpl);
    if (tpl.opens) setActivePanel(tpl.opens);
  };

  return (
    <div className="panel-body">
      <h3 className="panel-title">{t.panelStart}</h3>

      <div className="group-label">{t.myPosters}</div>
      <button className="btn btn-secondary" onClick={save} disabled={exporting}>
        {exporting ? t.projectSaving : t.saveCurrent}
      </button>
      {saveError && <div className="error-note">{saveError}</div>}

      {projects.length === 0 ? (
        <p className="panel-hint">{t.noProjects}</p>
      ) : (
        <ul className="proj-list">
          {projects.map((p) => (
            <li key={p.id} className="proj-item">
              <button
                className="proj-open"
                onClick={() => loadProject(p.state)}
                title={t.openProject}
              >
                {p.thumb ? (
                  <img className="proj-thumb" src={p.thumb} alt="" />
                ) : (
                  <span className="proj-thumb proj-thumb-empty" />
                )}
                <span className="proj-meta">
                  <span className="proj-name">{p.name}</span>
                  <span className="proj-date">{new Date(p.savedAt).toLocaleDateString()}</span>
                </span>
              </button>
              <button
                className={'proj-del' + (confirmDelete === p.id ? ' confirm' : '')}
                onClick={() => {
                  if (confirmDelete === p.id) {
                    setProjects(deleteProject(p.id));
                    setConfirmDelete(null);
                  } else {
                    setConfirmDelete(p.id);
                  }
                }}
                onBlur={() => setConfirmDelete((c) => (c === p.id ? null : c))}
                title={t.deleteLabel}
              >
                {confirmDelete === p.id ? t.confirmShort : '✕'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="group-label">{t.panelTemplates}</div>
      <p className="panel-hint">{t.templatesHint}</p>
      <div className="tpl-grid">
        {TEMPLATES.map((tpl) => {
          const labels = t.templateLabels[tpl.id];
          // a template reads as "in use" once both settings it owns outright
          // — theme and format — match the current design
          const active = themeId === tpl.themeId && layoutId === tpl.layoutId;
          return (
            <button
              key={tpl.id}
              className={'tpl-card' + (active ? ' active' : '')}
              onClick={() => applyTpl(tpl)}
            >
              <TemplateThumb tpl={tpl} />
              <span className="tpl-name">{labels?.name ?? tpl.id}</span>
              <span className="tpl-hint">{labels?.hint ?? ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * An abstraction of the finished poster — theme colours, the format's aspect
 * ratio and where the text sits. Cheaper and calmer than rendering a real map
 * six times over, and those three settings are what distinguish the templates.
 */
function TemplateThumb({ tpl }: { tpl: Template }) {
  const theme = getTheme(tpl.themeId);
  const layout = getLayout(tpl.layoutId);
  const pos = tpl.style.textPos ?? 'bottom';
  const align = tpl.style.textAlign ?? 'center';

  const textY = pos === 'top' ? 16 : pos === 'center' ? 50 : 84;
  const barW = 46;
  const x = align === 'left' ? 10 : align === 'right' ? 90 - barW : 50 - barW / 2;

  return (
    <svg
      className="tpl-thumb"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ aspectRatio: String(layout.ratio), background: theme.bg }}
    >
      <path d="M-5 62 L40 48 L72 58 L105 46" stroke={theme.water} strokeWidth="9" fill="none" />
      <path d="M-5 30 L38 34 L70 22 L105 28" stroke={theme.roadMid} strokeWidth="1.6" fill="none" />
      <path d="M22 -5 L30 42 L24 105" stroke={theme.roadMid} strokeWidth="1.6" fill="none" />
      <path d="M-5 72 L44 66 L105 76" stroke={theme.roadMajor} strokeWidth="2.6" fill="none" />
      <path d="M66 -5 L62 40 L70 105" stroke={theme.roadMajor} strokeWidth="2.6" fill="none" />

      <rect x={x} y={textY} width={barW} height="7" rx="1.5" fill={theme.text} />
      <rect x={x + barW * 0.2} y={textY + 11} width={barW * 0.6} height="2.5" fill={theme.accent} />
    </svg>
  );
}
