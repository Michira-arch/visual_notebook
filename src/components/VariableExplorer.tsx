import React, { useState } from 'react';
import { List, Search, Trash2, X, RefreshCw, Layers } from 'lucide-react';

interface Props {
  registry: Record<string, any>;
  isOpen: boolean;
  onClose: () => void;
  onDeleteVar?: (key: string) => void;
  onClearAll?: () => void;
}

export default function VariableExplorer({ registry, isOpen, onClose, onDeleteVar, onClearAll }: Props) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const entries = Object.entries(registry);
  
  const filteredEntries = entries.filter(([key, val]) => {
    const keyMatch = key.toLowerCase().includes(searchQuery.toLowerCase());
    const typeMatch = typeof val;
    return keyMatch || typeMatch.includes(searchQuery.toLowerCase());
  });

  // Calculate size metrics for variables
  const getVarSize = (val: any): string => {
    if (val === null || val === undefined) return '-';
    if (typeof val === 'string') return `${val.length} chars`;
    if (Array.isArray(val)) return `${val.length} items`;
    if (typeof val === 'object') return `${Object.keys(val).length} keys`;
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return 'integer';
      return 'float';
    }
    return '-';
  };

  const getVarPreview = (val: any): string => {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'object') {
      try {
        const str = JSON.stringify(val);
        return str.length > 50 ? str.slice(0, 50) + '...' : str;
      } catch {
        return '[Object]';
      }
    }
    const s = String(val);
    return s.length > 50 ? s.slice(0, 50) + '...' : s;
  };

  return (
    <div className="fixed right-0 top-12 bottom-0 w-80 bg-[var(--bg2)] border-l border-[var(--border)] z-50 flex flex-col shadow-2xl font-mono text-[11px] leading-relaxed">
      {/* Header */}
      <header className="h-12 border-b border-[var(--border)] flex items-center justify-between px-4 bg-[var(--bg)] flex-shrink-0">
        <div className="flex items-center gap-2 text-white">
          <List size={14} className="text-[var(--purple)]" />
          <span className="font-semibold uppercase tracking-wider text-xs">Variable Explorer</span>
        </div>
        <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white transition-colors">
          <X size={16} />
        </button>
      </header>

      {/* Toolbar / Search */}
      <div className="p-3 border-b border-[var(--border)] flex flex-col gap-2 bg-[var(--bg)]/40 flex-shrink-0">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
          <input
            type="text"
            placeholder="Filter variables..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded text-[11px] pl-7 pr-3 py-1 outline-none text-white focus:border-[var(--purple)] transition-colors placeholder-[var(--text-dim)]/55"
          />
        </div>
        
        {entries.length > 0 && (
          <div className="flex items-center justify-between mt-1 text-[10px]">
            <span className="text-[var(--text-dim)]">{entries.length} variables active</span>
            <button
              onClick={onClearAll}
              className="text-[var(--red)] hover:text-red-400 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Trash2 size={10} />
              <span>Clear All</span>
            </button>
          </div>
        )}
      </div>

      {/* Variable List */}
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-[var(--border)]/45">
        {filteredEntries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-[var(--text-dim)]">
            <Layers size={24} className="mb-2 opacity-30 text-[var(--purple)]" />
            {entries.length === 0 ? (
              <p>No variables in memory.<br />Execute a cell containing<br /><code className="text-[var(--cyan)]">vnb.set('x', val)</code></p>
            ) : (
              <p>No matching variables.</p>
            )}
          </div>
        ) : (
          filteredEntries.map(([key, val]) => {
            const varType = typeof val;
            return (
              <div key={key} className="p-3 hover:bg-[var(--border)]/20 transition-all flex flex-col gap-1 relative group">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--cyan)] font-semibold select-all text-xs">{key}</span>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onDeleteVar?.(key)}
                      className="text-[var(--text-dim)] hover:text-[var(--red)] p-0.5 rounded hover:bg-black/20 transition-colors"
                      title="Delete variable"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-[var(--text-dim)] mt-0.5">
                  <span className="bg-[var(--purple)]/10 text-[var(--purple)] px-1 py-0.2 rounded border border-[var(--purple)]/20 uppercase text-[9px]">{varType}</span>
                  <span>{getVarSize(val)}</span>
                </div>

                <div className="text-[var(--text)] mt-1.5 bg-black/15 p-1.5 rounded border border-[var(--border)]/40 text-[10px] overflow-x-auto whitespace-nowrap select-all max-h-20 scrollbar-none font-mono">
                  {getVarPreview(val)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
