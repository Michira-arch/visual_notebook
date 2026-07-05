import React, { useMemo } from 'react';
import { CellData } from '../types';
import { Hash } from 'lucide-react';

interface TocEntry { id: string; level: number; text: string }

export default function TableOfContents({ cells, onScrollTo, onClose }: { cells: CellData[]; onScrollTo: (id: string) => void; onClose: () => void }) {
  const entries: TocEntry[] = useMemo(() => {
    const result: TocEntry[] = [];
    for (const cell of cells) {
      if (cell.isCollapsed) continue;
      const content = cell.markdownContent || '';
      const lines = content.split('\n');
      for (const line of lines) {
        const m = line.match(/^(#{1,6})\s+(.+)/);
        if (m) result.push({ id: cell.id, level: m[1].length, text: m[2].trim() });
      }
    }
    return result;
  }, [cells]);

  if (entries.length === 0) return null;

  return (
    <div className="fixed top-14 right-0 h-[calc(100vh-3.5rem)] w-56 bg-[var(--bg2)] border-l border-[var(--border)] z-40 flex flex-col shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)]">
        <span className="font-mono text-[10px] tracking-widest text-[var(--text-dim)] uppercase flex items-center gap-1.5"><Hash size={11} /> Table of Contents</span>
        <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white text-xs">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {entries.map((e, i) => (
          <button key={i} onClick={() => { onScrollTo(e.id); onClose(); }}
            className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-dim)] hover:text-[var(--cyan)] hover:bg-white/5 transition-colors truncate block"
            style={{ paddingLeft: `${12 + e.level * 10}px` }}>
            {e.text}
          </button>
        ))}
      </div>
    </div>
  );
}
