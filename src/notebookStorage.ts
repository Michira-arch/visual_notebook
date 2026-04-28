import { CellData, Reference, NotebookState } from './types';

const NOTEBOOKS_KEY = 'vnb-notebooks-v2';
const ACTIVE_NB_KEY = 'vnb-active-notebook-v2';

function mkId() { return Math.random().toString(36).substr(2, 9); }

export function getAllNotebooks(): NotebookState[] {
  try { return JSON.parse(localStorage.getItem(NOTEBOOKS_KEY) || '[]'); }
  catch { return []; }
}

export function getNotebook(id: string): NotebookState | null {
  return getAllNotebooks().find(n => n.id === id) ?? null;
}

export function saveNotebook(nb: NotebookState): void {
  const all = getAllNotebooks();
  const idx = all.findIndex(n => n.id === nb.id);
  const updated = { ...nb, updatedAt: Date.now() };
  if (idx > -1) all[idx] = updated; else all.push(updated);
  localStorage.setItem(NOTEBOOKS_KEY, JSON.stringify(all));
}

export function deleteNotebook(id: string): void {
  const all = getAllNotebooks().filter(n => n.id !== id);
  localStorage.setItem(NOTEBOOKS_KEY, JSON.stringify(all));
}

export function getActiveNotebookId(): string | null {
  return localStorage.getItem(ACTIVE_NB_KEY);
}

export function setActiveNotebookId(id: string): void {
  localStorage.setItem(ACTIVE_NB_KEY, id);
}

export function createBlankNotebook(name = 'Untitled Notebook'): NotebookState {
  return {
    id: mkId(), name,
    cells: [], references: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}

/** Migrate legacy single-notebook from Sprint 1 storage */
export function migrateOrLoadInitialNotebook(defaultCells: CellData[]): NotebookState {
  const all = getAllNotebooks();
  if (all.length > 0) {
    const activeId = getActiveNotebookId();
    return all.find(n => n.id === activeId) ?? all[0];
  }
  // Create first notebook from any existing legacy data
  const nb = createBlankNotebook('My First Notebook');
  nb.cells = defaultCells;
  saveNotebook(nb);
  setActiveNotebookId(nb.id);
  return nb;
}
