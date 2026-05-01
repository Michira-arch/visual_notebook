import React, { useState } from 'react';
import { Plus, BookTemplate, Trash2, ChevronRight, NotebookPen, Download } from 'lucide-react';
import { NotebookState } from '../types';

interface Props {
  notebooks: NotebookState[];
  activeId: string;
  onSwitch: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onOpenTemplates: () => void;
  onImport: () => void;
  isOpen: boolean;
}

export default function Sidebar({ notebooks, activeId, onSwitch, onCreate, onDelete, onOpenTemplates, onImport, isOpen }: Props) {
  const [hoverDelete, setHoverDelete] = useState<string | null>(null);

  return (
    <aside
      className={`fixed top-14 left-0 h-[calc(100vh-3.5rem)] bg-[var(--bg2)] border-r border-[var(--border)] flex flex-col z-40 transition-all duration-300 ${isOpen ? 'w-60 opacity-100' : 'w-0 opacity-0 pointer-events-none'} overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] flex-shrink-0">
        <span className="font-mono text-[10px] tracking-widest text-[var(--text-dim)] uppercase">Notebooks</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onImport}
            title="Import Notebook"
            className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--cyan)] hover:bg-[var(--bg)] transition-colors"
          >
            <Download size={14} className="rotate-180" />
          </button>
          <button
            onClick={onCreate}
            title="New Notebook"
            className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--cyan)] hover:bg-[var(--bg)] transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Notebook list */}
      <div className="flex-1 overflow-y-auto py-2">
        {notebooks.length === 0 && (
          <p className="text-[10px] font-mono text-[var(--text-dim)] px-4 py-2">No notebooks yet.</p>
        )}
        {[...notebooks].sort((a, b) => b.updatedAt - a.updatedAt).map(nb => (
          <div
            key={nb.id}
            className={`group flex items-center gap-2 px-3 py-2 mx-2 rounded cursor-pointer transition-all ${nb.id === activeId ? 'bg-[var(--cyan-dim)]/20 border border-[var(--cyan-dim)]/30' : 'hover:bg-[var(--bg)]'}`}
            onClick={() => onSwitch(nb.id)}
            onMouseEnter={() => setHoverDelete(nb.id)}
            onMouseLeave={() => setHoverDelete(null)}
          >
            <NotebookPen size={12} className={nb.id === activeId ? 'text-[var(--cyan)]' : 'text-[var(--text-dim)]'} />
            <span className={`flex-1 text-xs truncate ${nb.id === activeId ? 'text-[var(--cyan)]' : 'text-[var(--text)]'}`}>
              {nb.name}
            </span>
            {hoverDelete === nb.id && notebooks.length > 1 && (
              <button
                onClick={e => { 
                  e.stopPropagation(); 
                  if (window.confirm(`Are you sure you want to delete "${nb.name}"? This action cannot be undone.`)) {
                    onDelete(nb.id); 
                  }
                }}
                className="text-[var(--text-dim)] hover:text-[var(--red)] transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                title="Delete notebook"
              >
                <Trash2 size={11} />
              </button>
            )}
            {nb.id === activeId && (
              <ChevronRight size={11} className="text-[var(--cyan)] flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border)] p-3 flex-shrink-0">
        <button
          onClick={onOpenTemplates}
          className="flex items-center gap-2 w-full px-3 py-2 rounded text-xs font-mono text-[var(--text-dim)] hover:text-[var(--orange)] hover:bg-[var(--bg)] transition-all"
        >
          <BookTemplate size={13} />
          Browse Templates
        </button>
      </div>
    </aside>
  );
}
