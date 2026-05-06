import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Wand2, Trash2, Edit3, Type, Zap, Code2 } from 'lucide-react';
import { CellData, CellType, Reference } from '../types';
import { ModelConfig } from '../providers/types';
import { generateVisualCell } from '../aiService';
import mermaid from 'mermaid';
import Markdown from 'react-markdown';
import MermaidChart from './MermaidChart';
import CodeCell from './CodeCell';

export default function CellComponent({ cell, allCells, references, modelConfig, onUpdate, onRemove }: {
  cell: CellData; allCells: CellData[]; references: Reference[];
  modelConfig: ModelConfig;
  onUpdate: (id: string, d: Partial<CellData>) => void;
  onRemove: (id: string) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const cur = cell.versions?.[cell.currentVersionIndex];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || cell.isLoading) return;
    onUpdate(cell.id, { isLoading: true });
    try {
      const history = cell.versions.slice(0, cell.currentVersionIndex + 1);
      const html = await generateVisualCell(prompt, history, allCells, references, modelConfig);
      const nv = { prompt, content: html, timestamp: Date.now() };
      const versions = [...cell.versions.slice(0, cell.currentVersionIndex + 1), nv];
      onUpdate(cell.id, { versions, currentVersionIndex: versions.length - 1, isLoading: false });
      setPrompt('');
    } catch (err: any) {
      onUpdate(cell.id, { isLoading: false });
      alert(err.message || 'Generation failed. Check console.');
    }
  };

  const nav = (i: number) => { if (i >= 0 && i < cell.versions.length) onUpdate(cell.id, { currentVersionIndex: i }); };

  const onBlur = () => {
    if (!contentRef.current || !cur) return;
    const html = contentRef.current.innerHTML;
    if (html !== cur.content) {
      const nv = { prompt: 'Manual Edit', content: html, timestamp: Date.now() };
      const versions = [...cell.versions.slice(0, cell.currentVersionIndex + 1), nv];
      onUpdate(cell.id, { versions, currentVersionIndex: versions.length - 1 });
    }
  };

  if (cell.type === 'code') {
    return (
      <CodeCell
        id={cell.id}
        codeContent={cell.codeContent || ''}
        language={cell.language || 'plaintext'}
        isCollapsed={cell.isCollapsed}
        onUpdate={(code, lang) => onUpdate(cell.id, { codeContent: code, language: lang })}
        onToggleCollapse={() => onUpdate(cell.id, { isCollapsed: !cell.isCollapsed })}
        onRemove={() => onRemove(cell.id)}
      />
    );
  }

  if (cell.type === 'markdown') {
    return (
      <div className={`relative border border-[var(--border)] bg-[var(--bg2)] rounded shadow-xl overflow-hidden mb-4 transition-all hover:border-[var(--green)]/50 group ${cell.isCollapsed ? 'mb-2' : 'mb-8'}`}>
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg2)] border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => onUpdate(cell.id, { isCollapsed: !cell.isCollapsed })}
              className="text-[var(--text-dim)] hover:text-[var(--green)] transition-colors"
            >
              {cell.isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
            <span className="font-mono text-[10px] tracking-widest text-[var(--green)] uppercase flex items-center gap-1">
              <Type size={12} /> Markdown {cell.id.slice(0, 4)}
            </span>
            {cell.isCollapsed && (
              <span className="text-[10px] font-mono text-[var(--text-dim)] truncate max-w-[400px] opacity-60">
                {cell.markdownContent?.split('\n')[0] || 'Empty markdown cell'}
              </span>
            )}
          </div>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {!cell.isCollapsed && (
              <button onClick={() => onUpdate(cell.id, { isEditing: !cell.isEditing })} className="text-[var(--text-dim)] hover:text-white transition-colors"><Edit3 size={14} /></button>
            )}
            <button onClick={() => onRemove(cell.id)} className="text-[var(--text-dim)] hover:text-[var(--red)] transition-colors"><Trash2 size={14} /></button>
          </div>
        </div>
        {!cell.isCollapsed && (
          <div className="p-6 bg-[var(--bg)] min-h-[100px]">
            {cell.isEditing
              ? (
                <div className="flex flex-col gap-4">
                  <textarea
                    autoFocus
                    value={cell.markdownContent || ''}
                    onChange={e => onUpdate(cell.id, { markdownContent: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        onUpdate(cell.id, { isEditing: false });
                      }
                    }}
                    placeholder="Write your reasoning here..."
                    className="w-full h-40 bg-transparent border-none outline-none text-[var(--text)] font-sans resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => onUpdate(cell.id, { isEditing: false })}
                      className="px-4 py-1.5 bg-green-600 text-white rounded font-medium hover:bg-green-500 transition-colors text-sm"
                    >
                      Run Cell
                    </button>
                  </div>
                </div>
              )
              : <div className="markdown-body prose prose-invert max-w-none text-sm" onClick={() => onUpdate(cell.id, { isEditing: true })}><Markdown>{cell.markdownContent || '*Empty markdown cell*'}</Markdown></div>
            }
          </div>
        )}
      </div>
    );
  }

  const isMermaid = cur?.content.includes('```mermaid');
  const rendered = isMermaid ? cur.content.replace(/```mermaid\s*/i, '').replace(/\s*```/i, '') : cur?.content;

  return (
    <div className={`relative border border-[var(--border)] bg-[var(--bg2)] rounded shadow-xl overflow-hidden mb-4 transition-all hover:border-[var(--cyan-dim)] group ${cell.isCollapsed ? 'mb-2' : 'mb-8'}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg2)] border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onUpdate(cell.id, { isCollapsed: !cell.isCollapsed })}
            className="text-[var(--text-dim)] hover:text-[var(--cyan)] transition-colors"
          >
            {cell.isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          <span className="font-mono text-[10px] tracking-widest text-[var(--cyan)] uppercase">Canvas {cell.id.slice(0, 4)}</span>
          {!cell.isCollapsed && cell.versions?.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-dim)] font-mono">
              <button onClick={() => nav(cell.currentVersionIndex - 1)} disabled={cell.currentVersionIndex === 0} className="hover:text-[var(--cyan)] disabled:opacity-30"><ChevronLeft size={16} /></button>
              <span>V{cell.currentVersionIndex + 1}/{cell.versions.length}</span>
              <button onClick={() => nav(cell.currentVersionIndex + 1)} disabled={cell.currentVersionIndex === cell.versions.length - 1} className="hover:text-[var(--cyan)] disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
          )}
          {cell.isCollapsed && (
            <span className="text-[10px] font-mono text-[var(--text-dim)] truncate max-w-[400px] opacity-60">
              {cur?.prompt || 'Empty canvas cell'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {cell.isLoading && <span className="font-mono text-[10px] text-[var(--orange)] animate-pulse tracking-widest">GENERATING...</span>}
          <button onClick={() => onRemove(cell.id)} className="text-[var(--text-dim)] hover:text-[var(--red)] transition-colors opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
        </div>
      </div>
      {!cell.isCollapsed && (
        <>
          <div className="p-6 relative min-h-[100px] overflow-hidden bg-[var(--bg)]">
            {cur
              ? isMermaid
                ? <MermaidChart chart={rendered!} />
                : <div ref={contentRef} className="visual-content w-full h-full outline-none focus:ring-1 focus:ring-[var(--cyan)] transition-all p-2 rounded" dangerouslySetInnerHTML={{ __html: rendered! }} contentEditable suppressContentEditableWarning onBlur={onBlur} />
              : <div className="flex items-center justify-center h-40 text-[var(--text-dim)] font-mono text-xs tracking-widest opacity-50">EMPTY CELL</div>
            }
          </div>
          <div className="p-4 border-t border-[var(--border)] bg-[var(--bg2)] flex">
            <form onSubmit={submit} className="flex items-center gap-3 w-full">
              <Wand2 size={18} className="text-[var(--text-dim)]" />
              <input type="text" value={prompt} onChange={e => setPrompt(e.target.value)} disabled={cell.isLoading} placeholder={cell.versions?.length === 0 ? 'Describe the algorithmic concept, diagram, or UI component...' : 'Refine this visual...'} className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text)] placeholder-[var(--text-dim)] disabled:opacity-50" />
              <button type="submit" disabled={!prompt.trim() || cell.isLoading} className="px-4 py-1.5 bg-cyan-600 text-white rounded font-medium hover:bg-cyan-500 disabled:opacity-50 transition-colors text-sm">Run</button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
