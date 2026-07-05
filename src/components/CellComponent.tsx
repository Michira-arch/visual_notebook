import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Wand2, Trash2, Edit3, Type, Zap, Code2, ArrowUp, ArrowDown, Copy, GripVertical, ChevronUp, Sparkles } from 'lucide-react';
import { CellData, CellType, Reference, CellMode } from '../types';
import { ModelConfig } from '../providers/types';
import { generateVisualCell, generateMarkup } from '../aiService';
import mermaid from 'mermaid';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import MermaidChart from './MermaidChart';
import CodeCell from './CodeCell';
import SandboxCell from './SandboxCell';

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

const CELL_TYPES: { type: CellType; label: string; color: string }[] = [
  { type: 'canvas', label: 'Canvas', color: 'var(--cyan)' },
  { type: 'markdown', label: 'Markdown', color: 'var(--green)' },
  { type: 'code', label: 'Code', color: 'var(--purple)' },
  { type: 'sandbox', label: 'Sandbox', color: 'var(--orange)' },
];

export default React.memo(function CellComponent({ cell, index, allCells, references, modelConfig, isFocused, mode, onUpdate, onRemove, onMoveUp, onMoveDown, onInsertAbove, onInsertBelow, onDuplicate, onChangeType, onRun, onRunAndFocusNext, focusCell, onDragStart, onDragOver, onDrop }: {
  cell: CellData; index: number; allCells: CellData[]; references: Reference[];
  modelConfig: ModelConfig;
  isFocused: boolean; mode: CellMode;
  onUpdate: (id: string, d: Partial<CellData>) => void;
  onRemove: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsertAbove: () => void;
  onInsertBelow: () => void;
  onDuplicate: () => void;
  onChangeType: (type: CellType) => void;
  onRun: () => void;
  onRunAndFocusNext: () => void;
  focusCell: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [isMarkingUp, setIsMarkingUp] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const cur = cell.versions?.[cell.currentVersionIndex];

  const hashCode = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return String(h); };

  const handleMarkup = async () => {
    const text = cell.markdownContent || '';
    if (!text.trim() || isMarkingUp) return;
    const hash = hashCode(text);
    if (hash === cell.markupHash) return;
    setIsMarkingUp(true);
    try {
      const marked = await generateMarkup(text, modelConfig);
      onUpdate(cell.id, { markdownContent: marked, markupHash: hashCode(marked), executionCount: (cell.executionCount ?? 0) + 1, lastRunTimestamp: Date.now() });
    } catch (err: any) {
      alert(err.message || 'Markup failed.');
    } finally {
      setIsMarkingUp(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || cell.isLoading) return;
    await doPrompt(prompt);
  };

  const doPrompt = async (text: string) => {
    onUpdate(cell.id, { isLoading: true });
    try {
      const history = cell.versions.slice(0, cell.currentVersionIndex + 1);
      const html = await generateVisualCell(text, history, allCells, references, modelConfig);
      const nv = { prompt: text, content: html, timestamp: Date.now() };
      const versions = [...cell.versions.slice(0, cell.currentVersionIndex + 1), nv];
      onUpdate(cell.id, { versions, currentVersionIndex: versions.length - 1, isLoading: false, executionCount: (cell.executionCount ?? 0) + 1, lastRunTimestamp: Date.now() });
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

  const handleRun = () => { cell.type === 'canvas' ? doPrompt(prompt || cur?.prompt || '') : onRun(); };
  const handleRunAndNext = () => { onRunAndFocusNext(); };

  const isMermaid = cur?.content.includes('```mermaid');
  const rendered = isMermaid ? cur.content.replace(/```mermaid\s*/i, '').replace(/\s*```/i, '') : cur?.content;

  const focusClass = isFocused && mode === 'command'
    ? 'ring-2 ring-[var(--cyan)] shadow-[0_0_12px_rgba(6,182,212,0.3)]'
    : isFocused && mode === 'edit'
      ? 'ring-2 ring-[var(--green)]'
      : '';

  const cellColor = CELL_TYPES.find(t => t.type === cell.type)?.color ?? 'var(--cyan)';

  // Left margin content
  const showExecCounter = cell.type === 'canvas' || cell.type === 'code';
  const execLabel = cell.isLoading ? '[*]' : cell.executionCount !== undefined ? `[${cell.executionCount}]` : '[ ]';

  // Sub-component render
  if (cell.type === 'sandbox') {
    return (
      <div className={`flex mb-1 group ${focusClass} rounded`} id={`cell-${cell.id}`} onClick={focusCell} draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
        <div className="flex-shrink-0 w-12 flex flex-col items-center pt-2 bg-[var(--bg2)] border-y border-l border-[var(--border)] rounded-l select-none">
          <button onClick={() => onUpdate(cell.id, { isCollapsed: !cell.isCollapsed })}
            className="text-[var(--text-dim)] hover:text-[var(--orange)] transition-colors mt-1">
            {cell.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          {!cell.isCollapsed && (
            <div className="mt-2 cursor-grab active:cursor-grabbing text-[var(--text-dim)] hover:text-white" title="Drag to reorder">
              <GripVertical size={14} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 relative">
          <SandboxCell id={cell.id}
            sandboxHtml={cell.sandboxHtml || ''} sandboxCss={cell.sandboxCss || ''} sandboxJs={cell.sandboxJs || ''}
            autoRun={cell.sandboxAutoRun ?? true}
            isCollapsed={cell.isCollapsed}
            executionCount={cell.executionCount}
            onUpdate={(html, css, js, auto) => onUpdate(cell.id, { sandboxHtml: html, sandboxCss: css, sandboxJs: js, sandboxAutoRun: auto, executionCount: (cell.executionCount ?? 0) + 1, lastRunTimestamp: Date.now() })}
            onToggleCollapse={() => onUpdate(cell.id, { isCollapsed: !cell.isCollapsed })}
            onRemove={() => onRemove(cell.id)}
            onShiftEnter={handleRunAndNext}
          />
          <HoverToolbar onMoveUp={ev => { ev.stopPropagation(); onMoveUp(); }} onMoveDown={ev => { ev.stopPropagation(); onMoveDown(); }}
            onInsertAbove={ev => { ev.stopPropagation(); onInsertAbove(); }} onInsertBelow={ev => { ev.stopPropagation(); onInsertBelow(); }}
            onDuplicate={ev => { ev.stopPropagation(); onDuplicate(); }} onDelete={ev => { ev.stopPropagation(); onRemove(cell.id); }} />
          <TypeDropdown currentType={cell.type} onChange={ev => { ev.stopPropagation(); const t = (ev.target as HTMLSelectElement).value as CellType; onChangeType(t); }} />
        </div>
      </div>
    );
  }

  if (cell.type === 'code') {
    return (
      <div className={`flex mb-1 group ${focusClass} rounded`} id={`cell-${cell.id}`} onClick={focusCell} draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
        <div className="flex-shrink-0 w-12 flex flex-col items-center pt-2 bg-[var(--bg2)] border-y border-l border-[var(--border)] rounded-l select-none">
          <button onClick={() => onUpdate(cell.id, { isCollapsed: !cell.isCollapsed })}
            className="text-[var(--text-dim)] hover:text-[var(--purple)] transition-colors mt-1">
            {cell.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          {!cell.isCollapsed && <div className="mt-1 font-mono text-[9px] text-[var(--text-dim)] mt-1.5">In</div>}
          {!cell.isCollapsed && <div className="font-mono text-[10px] text-[var(--text-dim)]">{execLabel}</div>}
          {!cell.isCollapsed && (
            <div className="mt-2 cursor-grab active:cursor-grabbing text-[var(--text-dim)] hover:text-white" title="Drag to reorder">
              <GripVertical size={14} />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 relative">
          <CodeCell id={cell.id} codeContent={cell.codeContent || ''} language={cell.language || 'plaintext'}
            isCollapsed={cell.isCollapsed} executionCount={cell.executionCount}
            onUpdate={(code, lang) => onUpdate(cell.id, { codeContent: code, language: lang })}
            onToggleCollapse={() => onUpdate(cell.id, { isCollapsed: !cell.isCollapsed })}
            onRemove={() => onRemove(cell.id)}
            onShiftEnter={handleRunAndNext}
          />
          <HoverToolbar onMoveUp={ev => { ev.stopPropagation(); onMoveUp(); }} onMoveDown={ev => { ev.stopPropagation(); onMoveDown(); }}
            onInsertAbove={ev => { ev.stopPropagation(); onInsertAbove(); }} onInsertBelow={ev => { ev.stopPropagation(); onInsertBelow(); }}
            onDuplicate={ev => { ev.stopPropagation(); onDuplicate(); }} onDelete={ev => { ev.stopPropagation(); onRemove(cell.id); }} />
          <TypeDropdown currentType={cell.type} onChange={ev => { ev.stopPropagation(); const t = (ev.target as HTMLSelectElement).value as CellType; onChangeType(t); }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex mb-1 group ${focusClass} rounded`} id={`cell-${cell.id}`} onClick={focusCell} draggable onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
      {/* Left margin */}
      <div className="flex-shrink-0 w-12 flex flex-col items-center pt-2 bg-[var(--bg2)] border-y border-l border-[var(--border)] rounded-l select-none">
        <button onClick={() => onUpdate(cell.id, { isCollapsed: !cell.isCollapsed })}
          className="text-[var(--text-dim)] hover:text-[var(--cyan)] transition-colors mt-1">
          {cell.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        {!cell.isCollapsed && showExecCounter && <div className="mt-1 font-mono text-[9px] text-[var(--text-dim)] mt-1.5">In</div>}
        {!cell.isCollapsed && showExecCounter && <div className="font-mono text-[10px] text-[var(--text-dim)]">{execLabel}</div>}
        {!cell.isCollapsed && (
          <div className="mt-2 cursor-grab active:cursor-grabbing text-[var(--text-dim)] hover:text-white" title="Drag to reorder">
            <GripVertical size={14} />
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 relative">
        {cell.type === 'markdown' ? (
          <div className="relative border border-[var(--border)] bg-[var(--bg2)] shadow-xl overflow-hidden transition-all hover:border-[var(--green)]/50">
            <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg2)] border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] tracking-widest text-[var(--green)] uppercase flex items-center gap-1">
                  <Type size={12} /> Markdown {cell.id.slice(0, 4)}
                </span>
                {!cell.isCollapsed && (
                  <button onClick={handleMarkup} disabled={isMarkingUp} className="text-[var(--text-dim)] hover:text-[var(--orange)] transition-colors" title="Auto-Markup">
                    {isMarkingUp ? <span className="animate-spin text-xs">⟳</span> : <Sparkles size={14} />}
                  </button>
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
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onUpdate(cell.id, { isEditing: false, executionCount: (cell.executionCount ?? 0) + 1, lastRunTimestamp: Date.now() }); }
                          if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); onUpdate(cell.id, { isEditing: false, executionCount: (cell.executionCount ?? 0) + 1, lastRunTimestamp: Date.now() }); handleRunAndNext(); }
                        }}
                        placeholder="Write your reasoning here..."
                        className="w-full h-40 bg-transparent border-none outline-none text-[var(--text)] font-sans resize-none" />
                      <div className="flex justify-end">
                        <button
                          onClick={() => onUpdate(cell.id, { isEditing: false, executionCount: (cell.executionCount ?? 0) + 1, lastRunTimestamp: Date.now() })}
                          className="px-4 py-1.5 bg-green-600 text-white rounded font-medium hover:bg-green-500 transition-colors text-sm">Run Cell</button>
                      </div>
                    </div>
                  )
                  : <div className="markdown-body prose prose-invert max-w-none text-sm" onClick={() => onUpdate(cell.id, { isEditing: true })}>
                      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins as any}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            if (!inline && match && match[1] === 'mermaid') {
                              return <MermaidChart chart={String(children).replace(/\n$/, '')} />;
                            }
                            return <code className={className} {...props}>{children}</code>;
                          }
                        }}>
                        {cell.markdownContent || '*Empty markdown cell*'}
                      </Markdown>
                    </div>
                }
              </div>
            )}
          </div>
        ) : (
          <div className="relative border border-[var(--border)] bg-[var(--bg2)] shadow-xl overflow-hidden transition-all hover:border-[var(--cyan-dim)]">
            <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg2)] border-b border-[var(--border)]">
              <div className="flex items-center gap-4">
                <span className="font-mono text-[10px] tracking-widest text-[var(--cyan)] uppercase">Canvas {cell.id.slice(0, 4)}</span>
                {!cell.isCollapsed && cell.versions?.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-[var(--text-dim)] font-mono">
                    <button onClick={() => nav(cell.currentVersionIndex - 1)} disabled={cell.currentVersionIndex === 0} className="hover:text-[var(--cyan)] disabled:opacity-30"><ChevronLeft size={16} /></button>
                    <span>V{cell.currentVersionIndex + 1}/{cell.versions.length}</span>
                    <button onClick={() => nav(cell.currentVersionIndex + 1)} disabled={cell.currentVersionIndex === cell.versions.length - 1} className="hover:text-[var(--cyan)] disabled:opacity-30"><ChevronRight size={16} /></button>
                  </div>
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
                    <input type="text" value={prompt} onChange={e => setPrompt(e.target.value)} disabled={cell.isLoading}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); doPrompt(prompt).then(handleRunAndNext); }
                      }}
                      placeholder={cell.versions?.length === 0 ? 'Describe the algorithmic concept, diagram, or UI component...' : 'Refine this visual...'}
                      className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text)] placeholder-[var(--text-dim)] disabled:opacity-50" />
                    <button type="submit" disabled={!prompt.trim() || cell.isLoading} className="px-4 py-1.5 bg-cyan-600 text-white rounded font-medium hover:bg-cyan-500 disabled:opacity-50 transition-colors text-sm">Run</button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}
        <HoverToolbar onMoveUp={ev => { ev.stopPropagation(); onMoveUp(); }} onMoveDown={ev => { ev.stopPropagation(); onMoveDown(); }}
          onInsertAbove={ev => { ev.stopPropagation(); onInsertAbove(); }} onInsertBelow={ev => { ev.stopPropagation(); onInsertBelow(); }}
          onDuplicate={ev => { ev.stopPropagation(); onDuplicate(); }} onDelete={ev => { ev.stopPropagation(); onRemove(cell.id); }} />
        <TypeDropdown currentType={cell.type} onChange={ev => { ev.stopPropagation(); const t = (ev.target as HTMLSelectElement).value as CellType; onChangeType(t); }} />
      </div>
    </div>
  );
});

function HoverToolbar({ onMoveUp, onMoveDown, onInsertAbove, onInsertBelow, onDuplicate, onDelete }: {
  onMoveUp: (e: React.MouseEvent) => void;
  onMoveDown: (e: React.MouseEvent) => void;
  onInsertAbove: (e: React.MouseEvent) => void;
  onInsertBelow: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-[var(--bg2)] border border-[var(--border)] rounded px-0.5 py-0.5 shadow-lg">
      <ToolBtn onClick={onMoveUp} title="Move up (⌘↑)"><ArrowUp size={12} /></ToolBtn>
      <ToolBtn onClick={onMoveDown} title="Move down (⌘↓)"><ArrowDown size={12} /></ToolBtn>
      <div className="w-px h-4 bg-[var(--border)] mx-0.5" />
      <ToolBtn onClick={onInsertAbove} title="Insert above (a)"><Plus size={12} /></ToolBtn>
      <ToolBtn onClick={onInsertBelow} title="Insert below (b)"><ChevronDown size={12} /></ToolBtn>
      <div className="w-px h-4 bg-[var(--border)] mx-0.5" />
      <ToolBtn onClick={onDuplicate} title="Duplicate"><Copy size={12} /></ToolBtn>
      <ToolBtn onClick={onDelete} title="Delete"><Trash2 size={12} /></ToolBtn>
    </div>
  );
}

function ToolBtn({ onClick, title, children }: { onClick: (e: React.MouseEvent) => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className="p-1 rounded text-[var(--text-dim)] hover:text-white hover:bg-white/10 transition-colors">
      {children}
    </button>
  );
}

function TypeDropdown({ currentType, onChange }: { currentType: CellType; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void }) {
  return (
    <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
      <select value={currentType} onChange={onChange}
        className="appearance-none bg-[var(--bg)] border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono rounded px-1.5 py-0.5 outline-none hover:border-[var(--border2)] focus:border-[var(--cyan)] transition-colors cursor-pointer">
        {CELL_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
      </select>
    </div>
  );
}
