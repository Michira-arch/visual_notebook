import React, { useState } from 'react';
import { X, FileText, Code2, FileJson, File } from 'lucide-react';
import { Reference } from '../types';

interface Props {
  references: Reference[];
  onClose: () => void;
  initialRef?: string; // id of ref to show first
}

function detectLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', rs: 'rust', go: 'go', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', cs: 'csharp',
    json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', txt: 'plaintext', sh: 'bash', sql: 'sql',
    html: 'html', css: 'css', xml: 'xml',
  };
  return map[ext] || 'plaintext';
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['ts','tsx','js','jsx','py','rs','go','java','c','cpp'].includes(ext)) return <Code2 size={14} />;
  if (ext === 'json') return <FileJson size={14} />;
  if (ext === 'md') return <FileText size={14} />;
  return <File size={14} />;
}

export default function ReferenceViewer({ references, onClose, initialRef }: Props) {
  const [activeId, setActiveId] = useState<string>(initialRef ?? references[0]?.id ?? '');
  const activeRef = references.find(r => r.id === activeId);

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="m-auto w-full max-w-4xl h-[80vh] bg-[var(--bg2)] border border-[var(--border)] rounded-lg shadow-2xl flex overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Sidebar: file list */}
        <div className="w-52 flex-shrink-0 border-r border-[var(--border)] flex flex-col bg-[var(--bg)]">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-widest text-[var(--text-dim)] uppercase">References</span>
            <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white transition-colors"><X size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {references.map(r => (
              <button
                key={r.id}
                onClick={() => setActiveId(r.id)}
                className={`flex items-center gap-2 w-full px-3 py-2 text-left transition-colors text-xs truncate ${r.id === activeId ? 'bg-[var(--cyan-dim)]/20 text-[var(--cyan)]' : 'text-[var(--text-dim)] hover:bg-[var(--bg2)] hover:text-[var(--text)]'}`}
              >
                <FileIcon name={r.name} />
                <span className="truncate font-mono">{r.name}</span>
              </button>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-[var(--border)]">
            <p className="text-[10px] font-mono text-[var(--text-dim)]">{references.length} file{references.length !== 1 ? 's' : ''} loaded</p>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeRef ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--bg2)] flex-shrink-0">
                <FileIcon name={activeRef.name} />
                <span className="font-mono text-sm text-white">{activeRef.name}</span>
                <span className="font-mono text-[10px] text-[var(--text-dim)] ml-auto">{detectLanguage(activeRef.name)} · {activeRef.content.length.toLocaleString()} chars</span>
              </div>
              <pre className="flex-1 overflow-auto p-4 font-mono text-xs text-[var(--cyan)] leading-5 bg-black/30 whitespace-pre-wrap break-all">
                {activeRef.content}
              </pre>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--text-dim)] font-mono text-sm">
              No file selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
