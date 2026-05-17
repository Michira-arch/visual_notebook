import { ResearchArticle } from './types';
import { apiFetch } from './serverClient';

const RESEARCH_META_KEY = 'vnb-research-meta';

function mkId() { return Math.random().toString(36).substr(2, 9); }

function getMeta(): { id: string, title: string, author: string, updatedAt: number, createdAt: number }[] {
  try { return JSON.parse(localStorage.getItem(RESEARCH_META_KEY) || '[]'); }
  catch { return []; }
}

// Background sync queue
let syncTimer: any = null;
let pendingSync: { [id: string]: ResearchArticle } = {};

function syncToPythonDB(article: ResearchArticle) {
  pendingSync[article.id] = article;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const toSync = Object.values(pendingSync);
    pendingSync = {};
    for (const item of toSync) {
      try {
        await apiFetch('/api/researches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
      } catch (e) {
        console.warn('Failed to sync research to Python DB.', e);
      }
    }
  }, 1000);
}

export function getAllResearches(): ResearchArticle[] {
  const meta = getMeta();
  return meta.map(m => {
    try {
      const full = JSON.parse(localStorage.getItem(`vnb-research-data-${m.id}`) || 'null');
      if (full) return full;
    } catch (e) {}
    
    return {
      ...m,
      content: '',
      tags: [],
    } as ResearchArticle;
  });
}

export function getResearch(id: string): ResearchArticle | null {
  try {
    const full = JSON.parse(localStorage.getItem(`vnb-research-data-${id}`) || 'null');
    return full;
  } catch { return null; }
}

export function saveResearch(article: ResearchArticle): void {
  const meta = getMeta();
  const idx = meta.findIndex(m => m.id === article.id);
  const updatedArticle = { ...article, updatedAt: Date.now() };
  
  const newMeta = { 
    id: updatedArticle.id, 
    title: updatedArticle.title, 
    author: updatedArticle.author,
    updatedAt: updatedArticle.updatedAt, 
    createdAt: updatedArticle.createdAt 
  };
  
  if (idx > -1) meta[idx] = newMeta; else meta.push(newMeta);
  
  localStorage.setItem(RESEARCH_META_KEY, JSON.stringify(meta));
  localStorage.setItem(`vnb-research-data-${article.id}`, JSON.stringify(updatedArticle));
  
  syncToPythonDB(updatedArticle);
}

export function deleteResearch(id: string): void {
  const meta = getMeta().filter(m => m.id !== id);
  localStorage.setItem(RESEARCH_META_KEY, JSON.stringify(meta));
  localStorage.removeItem(`vnb-research-data-${id}`);
  
  apiFetch(`/api/researches/${id}`, { method: 'DELETE' }).catch(() => {});
}

export function createBlankResearch(title = 'Untitled Research', author = 'Unknown Author'): ResearchArticle {
  return {
    id: mkId(),
    title,
    author,
    content: '',
    tags: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
