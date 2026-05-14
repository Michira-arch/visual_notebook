import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { CellData } from '../types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import MermaidChart from './MermaidChart';

interface Props {
  cells: CellData[];
  onClose: () => void;
}

export default function PresentationMode({ cells, onClose }: Props) {
  const viewableCells = cells.filter(c =>
    (c.type === 'canvas' && c.versions.length > 0) ||
    c.type === 'markdown' ||
    (c.type === 'code' && c.codeContent)
  );

  const [idx, setIdx] = useState(0);
  const total = viewableCells.length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setIdx(i => Math.min(i + 1, total - 1));
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setIdx(i => Math.max(i - 1, 0));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [total, onClose]);

  if (total === 0) {
    return (
      <div className="fixed inset-0 z-[100] bg-[var(--bg)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-dim)] font-mono mb-4">No content cells to present.</p>
          <button onClick={onClose} className="px-4 py-2 bg-[var(--bg2)] border border-[var(--border)] rounded text-sm">Exit</button>
        </div>
      </div>
    );
  }

  const cell = viewableCells[idx];
  const cur = cell.versions[cell.currentVersionIndex];
  const isMermaid = cur?.content?.includes('```mermaid');
  const renderedHTML = isMermaid ? cur.content.replace(/```mermaid\s*/i, '').replace(/\s*```/i, '') : cur?.content;

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--bg)] flex flex-col">
      {/* Top bar */}
      <div className="h-10 border-b border-[var(--border)] bg-[var(--bg2)] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-widest">Presentation Mode</span>
          <span className="font-mono text-[10px] text-[var(--cyan)]">{idx + 1} / {total}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono text-[var(--text-dim)] hidden sm:block">← → to navigate · Esc to exit</span>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white transition-colors"><X size={16} /></button>
        </div>
      </div>

      {/* Slide content */}
      <div className="flex-1 overflow-auto p-8 md:p-16 flex items-start justify-center">
        <div className="w-full max-w-4xl">
          {cell.type === 'markdown' && (
            <div className="markdown-body prose prose-invert max-w-none text-lg leading-relaxed">
              <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{cell.markdownContent || ''}</Markdown>
            </div>
          )}
          {cell.type === 'canvas' && cur && (
            isMermaid
              ? <MermaidChart chart={renderedHTML || ''} />
              : <div dangerouslySetInnerHTML={{ __html: renderedHTML || '' }} className="visual-content" />
          )}
          {cell.type === 'code' && (
            <pre className="bg-black/40 border border-[var(--border)] rounded-lg p-6 font-mono text-sm text-[var(--cyan)] overflow-auto">
              <div className="text-[10px] text-[var(--text-dim)] mb-3 uppercase tracking-widest">{cell.language}</div>
              {cell.codeContent}
            </pre>
          )}
        </div>
      </div>

      {/* Progress dots + nav */}
      <div className="h-14 border-t border-[var(--border)] bg-[var(--bg2)] flex items-center justify-center gap-4 flex-shrink-0">
        <button onClick={() => setIdx(i => Math.max(i - 1, 0))} disabled={idx === 0} className="text-[var(--text-dim)] hover:text-white disabled:opacity-20 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="flex gap-1.5">
          {viewableCells.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} className={`w-2 h-2 rounded-full transition-all ${i === idx ? 'bg-[var(--cyan)] w-5' : 'bg-[var(--border2)] hover:bg-[var(--text-dim)]'}`} />
          ))}
        </div>
        <button onClick={() => setIdx(i => Math.min(i + 1, total - 1))} disabled={idx === total - 1} className="text-[var(--text-dim)] hover:text-white disabled:opacity-20 transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
