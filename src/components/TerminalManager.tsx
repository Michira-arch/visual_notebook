import React, { useState, useEffect, useRef } from 'react';
import { X, Terminal as TerminalIcon, Plus, Maximize2, Minus, Minimize2, TestTube } from 'lucide-react';
import { SingleTerminal, SingleTerminalRef } from './SingleTerminal';

interface TerminalSession {
  id: string;
  name: string;
  backend: 'python' | 'go';
}

interface Props {
  isOpen: boolean; // treated as "un-minimized" vs closed
  onClose: () => void; // completely hide
}

type ViewState = 'closed' | 'minimized' | 'normal' | 'maximized';

export default function TerminalManager({ isOpen, onClose }: Props) {
  const [viewState, setViewState] = useState<ViewState>('closed');
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && viewState === 'closed') {
      setViewState('normal');
      if (sessions.length === 0) {
        handleAddSession();
      }
    } else if (!isOpen && viewState !== 'closed') {
      setViewState('closed');
    }
  }, [isOpen]);

  // Sync state with parent's isOpen prop, if parent closes it, we go to 'closed'
  useEffect(() => {
    if (viewState === 'closed' && isOpen) onClose();
  }, [viewState]);

  const handleAddSession = (backend: 'python' | 'go' = 'python') => {
    const id = Math.random().toString(36).substr(2, 9);
    const prefix = backend === 'go' ? 'Go' : 'Terminal';
    setSessions(prev => [...prev, { id, name: `${prefix} ${prev.length + 1}`, backend }]);
    setActiveId(id);
    if (viewState === 'minimized') setViewState('normal');
  };

  const handleRemoveSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const next = prev.filter(s => s.id !== id);
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  };

  // If viewState === 'closed', we just hide the entire container, but we do NOT unmount.
  // Unmounting would kill the background processes.
  const isMaximized = viewState === 'maximized';
  const isMinimized = viewState === 'minimized';
  const isClosed = viewState === 'closed';
  
  const containerClasses = isMaximized 
    ? "fixed inset-2 z-[60] bg-[var(--bg2)] border border-[var(--border)] shadow-2xl flex flex-col rounded-lg"
    : "fixed bottom-0 right-8 z-[60] w-[800px] h-[400px] bg-[var(--bg2)] border border-[var(--border)] border-b-0 shadow-2xl flex flex-col rounded-t-lg";

  return (
    <div style={{ display: isClosed ? 'none' : 'block' }}>
      {isMinimized && (
        <div 
          className="fixed bottom-0 right-8 z-[60] bg-[var(--bg2)] border border-[var(--border)] border-b-0 rounded-t-lg shadow-2xl flex items-center px-4 py-2 cursor-pointer hover:bg-[var(--bg)] transition-colors"
          onClick={() => setViewState('normal')}
        >
          <TerminalIcon size={14} className="text-[var(--cyan)] mr-2" />
          <span className="text-xs font-mono text-white">Terminal ({sessions.length})</span>
          <button onClick={(e) => { e.stopPropagation(); setViewState('closed'); onClose(); }} className="ml-4 text-[var(--text-dim)] hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      <div className={containerClasses} style={{ display: isMinimized ? 'none' : 'flex' }}>
        {/* Header / Tabs */}
        <header className="h-10 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg)] flex-shrink-0 rounded-t-lg">
          <div className="flex h-full overflow-x-auto no-scrollbar">
            {sessions.map(s => (
              <div 
                key={s.id} 
                onClick={() => setActiveId(s.id)}
                className={`flex items-center gap-2 px-4 h-full border-r border-[var(--border)] cursor-pointer select-none min-w-[120px] max-w-[200px] group transition-colors ${activeId === s.id ? 'bg-[var(--bg2)] border-t-2 border-t-[var(--cyan)]' : 'hover:bg-[var(--bg2)]'}`}
              >
                <TerminalIcon size={12} className={activeId === s.id ? 'text-[var(--cyan)]' : 'text-[var(--text-dim)]'} />
                {s.backend === 'go' && <TestTube size={10} className="text-[var(--orange)] opacity-60" />}
                <span className={`text-xs font-mono truncate ${activeId === s.id ? 'text-white' : 'text-[var(--text-dim)]'}`}>{s.name}</span>
                <button onClick={(e) => handleRemoveSession(s.id, e)} className="ml-auto opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-[var(--red)] transition-all">
                  <X size={12} />
                </button>
              </div>
            ))}
            <button onClick={() => handleAddSession('python')} className="px-3 h-full flex items-center justify-center text-[var(--text-dim)] hover:text-white hover:bg-[var(--bg2)] transition-colors border-r border-[var(--border)]">
              <Plus size={14} />
            </button>
            <button onClick={() => handleAddSession('go')} className="px-3 h-full flex items-center justify-center text-[var(--orange)]/50 hover:text-[var(--orange)] hover:bg-[var(--bg2)] transition-colors border-r border-[var(--border)]" title="Go PTY Terminal (experimental)">
              <TestTube size={14} />
            </button>
          </div>

          {/* Window Controls */}
          <div className="flex items-center gap-1 px-2 h-full flex-shrink-0">
            <button onClick={() => setViewState('minimized')} className="w-7 h-7 flex items-center justify-center text-[var(--text-dim)] hover:text-white hover:bg-white/5 rounded transition-colors" title="Minimize">
              <Minus size={14} />
            </button>
            <button onClick={() => setViewState(isMaximized ? 'normal' : 'maximized')} className="w-7 h-7 flex items-center justify-center text-[var(--text-dim)] hover:text-white hover:bg-white/5 rounded transition-colors" title={isMaximized ? "Restore" : "Maximize"}>
              {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button onClick={() => { setViewState('closed'); onClose(); }} className="w-7 h-7 flex items-center justify-center text-[var(--text-dim)] hover:text-white hover:bg-white/5 rounded transition-colors" title="Close All">
              <X size={14} />
            </button>
          </div>
        </header>

        {/* Terminal Area */}
        <div className="flex-1 relative bg-[#0F1115]">
          {sessions.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--text-dim)]">
              <TerminalIcon size={32} className="mb-2 opacity-50" />
              <p className="text-xs font-mono">No active terminal sessions.</p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => handleAddSession('python')} className="px-4 py-1.5 bg-[var(--cyan)]/10 text-[var(--cyan)] rounded hover:bg-[var(--cyan)]/20 transition-colors text-xs font-mono flex items-center gap-2">
                  <Plus size={12} /> Python
                </button>
                <button onClick={() => handleAddSession('go')} className="px-4 py-1.5 bg-[var(--orange)]/10 text-[var(--orange)] rounded hover:bg-[var(--orange)]/20 transition-colors text-xs font-mono flex items-center gap-2">
                  <TestTube size={12} /> Go PTY
                </button>
              </div>
            </div>
          ) : (
            sessions.map(s => (
              <SingleTerminal key={s.id} isActive={activeId === s.id} wsEndpoint={s.backend} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
