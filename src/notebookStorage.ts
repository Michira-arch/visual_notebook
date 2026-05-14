import { CellData, Reference, NotebookState } from './types';
import { apiFetch } from './serverClient';

const META_KEY = 'vnb-meta-v3';
const ACTIVE_NB_KEY = 'vnb-active-id-v3';
const LEGACY_KEY = 'vnb-notebooks-v2';

function mkId() { return Math.random().toString(36).substr(2, 9); }

export function getActiveNotebookId(): string | null {
  return localStorage.getItem(ACTIVE_NB_KEY);
}

export function setActiveNotebookId(id: string): void {
  localStorage.setItem(ACTIVE_NB_KEY, id);
}

// Get metadata for all notebooks
function getMeta(): { id: string, name: string, updatedAt: number, createdAt: number }[] {
  try { return JSON.parse(localStorage.getItem(META_KEY) || '[]'); }
  catch { return []; }
}

// Background sync queue
let syncTimer: any = null;
let pendingSync: { [id: string]: NotebookState } = {};

function syncToPythonDB(nb: NotebookState) {
  pendingSync[nb.id] = nb;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const toSync = Object.values(pendingSync);
    pendingSync = {};
    for (const item of toSync) {
      try {
        await apiFetch('/api/notebooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
      } catch (e) {
        console.warn('Failed to sync to Python DB. Ensure server.py is running with aiohttp.', e);
      }
    }
  }, 1000);
}

export function getAllNotebooks(): NotebookState[] {
  const meta = getMeta();
  const activeId = getActiveNotebookId();
  
  return meta.map(m => {
    // Memory isolation: only load full content for the active notebook
    if (m.id === activeId) {
      try {
        const full = JSON.parse(localStorage.getItem(`vnb-data-${m.id}`) || 'null');
        if (full) return full;
      } catch (e) {}
    }
    
    // Inactive notebooks are kept extremely lightweight in memory
    return {
      ...m,
      cells: [],
      references: [],
      conversations: []
    } as NotebookState;
  });
}

export function getNotebook(id: string): NotebookState | null {
  try {
    const full = JSON.parse(localStorage.getItem(`vnb-data-${id}`) || 'null');
    return full;
  } catch { return null; }
}

export function saveNotebook(nb: NotebookState): void {
  const meta = getMeta();
  const idx = meta.findIndex(m => m.id === nb.id);
  const updatedNb = { ...nb, updatedAt: Date.now() };
  
  const newMeta = { id: updatedNb.id, name: updatedNb.name, updatedAt: updatedNb.updatedAt, createdAt: updatedNb.createdAt };
  if (idx > -1) meta[idx] = newMeta; else meta.push(newMeta);
  
  // 1. Save metadata list (very lightweight)
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  
  // 2. Save full notebook content separately (only parsing/stringifying ONE notebook)
  localStorage.setItem(`vnb-data-${nb.id}`, JSON.stringify(updatedNb));
  
  // 3. Sync to Python backend in background
  syncToPythonDB(updatedNb);
}

export function deleteNotebook(id: string): void {
  const meta = getMeta().filter(m => m.id !== id);
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  localStorage.removeItem(`vnb-data-${id}`);
  
  // Delete from Python DB
  apiFetch(`/api/notebooks/${id}`, { method: 'DELETE' }).catch(() => {});
}

export function createBlankNotebook(name = 'Untitled Notebook'): NotebookState {
  return {
    id: mkId(), name,
    cells: [], references: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}

export function migrateOrLoadInitialNotebook(defaultCells: CellData[]): NotebookState {
  const meta = getMeta();
  if (meta.length > 0) {
    const activeId = getActiveNotebookId();
    const nb = getNotebook(activeId || meta[0].id);
    if (nb) return nb;
  }
  
  // Try to migrate from legacy V2
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    if (legacy && legacy.length > 0) {
      for (const nb of legacy) {
        saveNotebook(nb); // This will save to V3 format and sync to DB
      }
      setActiveNotebookId(legacy[0].id);
      return legacy[0];
    }
  } catch (e) {}

  // Create first notebook
  const nb = createBlankNotebook('My First Notebook');
  nb.cells = defaultCells;
  saveNotebook(nb);
  setActiveNotebookId(nb.id);
  return nb;
}

