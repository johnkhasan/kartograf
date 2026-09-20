import type { AppState } from '../store';

/** The design fields a saved poster carries — everything except UI state. */
export const PROJECT_KEYS = [
  'location',
  'center',
  'zoom',
  'themeId',
  'customTheme',
  'layoutId',
  'styleOpts',
  'layers',
  'markers',
  'uploadedMarkers',
  'markerSize',
  'markerColor',
  'route',
  'routeWidth',
  'couple',
  'settings',
] as const;

export type ProjectState = Pick<AppState, (typeof PROJECT_KEYS)[number]>;

export interface Project {
  id: string;
  name: string;
  /** epoch ms */
  savedAt: number;
  /** small JPEG data URL, or '' when the preview could not be rendered */
  thumb: string;
  state: ProjectState;
}

const KEY = 'kartograf-projects-v1';

/** Older entries are dropped when this is exceeded, oldest first. */
export const MAX_PROJECTS = 12;

export class ProjectStorageError extends Error {}

export function projectState(s: AppState): ProjectState {
  const out = {} as Record<string, unknown>;
  for (const k of PROJECT_KEYS) out[k] = s[k];
  return out as ProjectState;
}

export function listProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return (data as Project[])
      .filter((p) => p && typeof p.id === 'string' && p.state)
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    // corrupt or unreadable storage shouldn't take the panel down with it
    return [];
  }
}

function write(projects: Project[]): Project[] {
  const trimmed = projects.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_PROJECTS);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // uploaded marker images are the only thing here big enough to fill the
    // quota; retry once without the thumbnails before giving up
    try {
      localStorage.setItem(KEY, JSON.stringify(trimmed.map((p) => ({ ...p, thumb: '' }))));
      return trimmed.map((p) => ({ ...p, thumb: '' }));
    } catch {
      throw new ProjectStorageError('quota');
    }
  }
  return trimmed;
}

export function saveProject(project: Project): Project[] {
  const rest = listProjects().filter((p) => p.id !== project.id);
  return write([project, ...rest]);
}

export function deleteProject(id: string): Project[] {
  return write(listProjects().filter((p) => p.id !== id));
}

export function renameProject(id: string, name: string): Project[] {
  return write(listProjects().map((p) => (p.id === id ? { ...p, name } : p)));
}

let seq = 0;
export const newProjectId = () => `p${Date.now().toString(36)}${(++seq).toString(36)}`;

/** Fallback name for a freshly saved poster: the place it is of. */
export function defaultProjectName(s: Pick<AppState, 'location' | 'couple'>): string {
  const c = s.couple;
  if (c.enabled && c.a && c.b) return `${c.a.name} — ${c.b.name}`;
  return s.location.name || 'Poster';
}
