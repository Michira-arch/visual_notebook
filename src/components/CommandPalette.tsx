import React, { useState, useRef, useEffect, useMemo } from 'react';
import { CommandAction } from '../types';

export default function CommandPalette({ actions, onClose }: { actions: CommandAction[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter(a => a.label.toLowerCase().includes(q) || a.category.toLowerCase().includes(q));
  }, [query, actions]);

  const grouped = useMemo(() => {
    const map: Record<string, CommandAction[]> = {};
    for (const a of filtered) { if (!map[a.category]) map[a.category] = []; map[a.category].push(a); }
    return map;
  }, [filtered]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <span className="text-[var(--text-dim)] text-sm">▶</span>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && filtered.length > 0) { filtered[0].action(); onClose(); } }}
            placeholder="Type a command..." className="flex-1 bg-transparent border-none outline-none text-white placeholder-[var(--text-dim)] text-sm" />
          <kbd className="text-[10px] font-mono text-[var(--text-dim)] bg-[var(--bg)] px-1.5 py-0.5 rounded">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="px-3 py-1.5 text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">{cat}</div>
              {items.map(a => (
                <button key={a.id} onClick={() => { a.action(); onClose(); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded text-sm text-left text-[var(--text)] hover:bg-[var(--bg)] transition-colors">
                  <span>{a.label}</span>
                  {a.shortcut && <kbd className="text-[10px] font-mono text-[var(--text-dim)] bg-[var(--bg)] px-1.5 py-0.5 rounded">{a.shortcut}</kbd>}
                </button>
              ))}
            </div>
          ))}
          {filtered.length === 0 && <div className="px-3 py-4 text-center text-xs text-[var(--text-dim)]">No commands found</div>}
        </div>
      </div>
    </div>
  );
}
