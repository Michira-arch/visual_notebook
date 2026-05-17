import React, { useState, useRef } from 'react';
import { Plus, Wand2, Type, Zap, Code2, Globe } from 'lucide-react';
import { CellType } from '../types';

export default function NewCellButton({ onAdd, onFloodlight }: { onAdd: (t: CellType) => void; onFloodlight: () => void }) {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enter = () => { if (timer.current) clearTimeout(timer.current); setShow(true); };
  const leave = () => { timer.current = setTimeout(() => setShow(false), 500); };

  return (
    <div className="relative flex justify-center mt-8 mb-32 h-20" onMouseEnter={enter} onMouseLeave={leave}>
      <button onClick={() => onAdd('canvas')} className={`group flex flex-col items-center gap-2 p-4 text-[var(--text-dim)] hover:text-[var(--cyan)] transition-all ${show ? 'opacity-0 scale-95 pointer-events-none absolute' : 'opacity-50 hover:opacity-100 relative'}`}>
        <div className="w-12 h-12 rounded-full border border-dashed border-[var(--text-dim)] group-hover:border-[var(--cyan)] flex items-center justify-center"><Plus size={24} /></div>
      </button>
      <div className={`absolute flex gap-4 transition-all duration-300 ${show ? 'opacity-100 scale-100 pointer-events-auto top-4' : 'opacity-0 scale-95 pointer-events-none top-4'}`}>
        <button onClick={() => { onAdd('markdown'); setShow(false); }} className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--bg2)] border border-[var(--border)] hover:border-[var(--green)] hover:text-[var(--green)] transition-all shadow-xl font-mono text-xs uppercase tracking-widest"><Type size={16} /> Markdown</button>
        <button onClick={() => { onAdd('code'); setShow(false); }} className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--bg2)] border border-[var(--border)] hover:border-[var(--purple)] hover:text-[var(--purple)] transition-all shadow-xl font-mono text-xs uppercase tracking-widest"><Code2 size={16} /> Code</button>
        <button onClick={() => { onAdd('sandbox'); setShow(false); }} className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--bg2)] border border-[var(--border)] hover:border-[var(--orange)] hover:text-[var(--orange)] transition-all shadow-xl font-mono text-xs uppercase tracking-widest animate-pulse hover:animate-none"><Globe size={16} /> Sandbox</button>
        <button onClick={() => { onFloodlight(); setShow(false); }} className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--bg2)] border border-[var(--border)] hover:border-[var(--orange)] hover:text-[var(--orange)] transition-all shadow-xl font-mono text-xs uppercase tracking-widest"><Zap size={16} fill="currentColor" className="opacity-50" /> Floodlight</button>
        <button onClick={() => { onAdd('canvas'); setShow(false); }} className="flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--bg2)] border border-[var(--border)] hover:border-[var(--cyan)] hover:text-[var(--cyan)] transition-all shadow-xl font-mono text-xs uppercase tracking-widest"><Wand2 size={16} /> Canvas</button>
      </div>
    </div>
  );
}
