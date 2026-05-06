import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';

const LANGUAGES = ['plaintext', 'python', 'javascript', 'typescript', 'rust', 'go', 'java', 'c', 'cpp', 'sql', 'bash', 'json', 'yaml', 'html', 'css', 'markdown'];

interface Props {
  id: string;
  codeContent: string;
  language: string;
  isCollapsed?: boolean;
  onUpdate: (code: string, lang: string) => void;
  onToggleCollapse: () => void;
  onRemove: () => void;
}

export default function CodeCell({ id, codeContent, language, isCollapsed, onUpdate, onToggleCollapse, onRemove }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative border border-[var(--border)] bg-[var(--bg2)] rounded shadow-xl overflow-hidden mb-4 transition-all hover:border-[var(--purple)]/50 group ${isCollapsed ? 'mb-2' : 'mb-8'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg2)] border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <button 
            onClick={onToggleCollapse}
            className="text-[var(--text-dim)] hover:text-[var(--purple)] transition-colors"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {/* lang badge */}
          <span className="font-mono text-[10px] tracking-widest text-[var(--purple)] uppercase flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--purple)] opacity-70" />
            Code {id.slice(0, 4)}
          </span>

          {!isCollapsed && (
            <div className="relative">
              <select
                value={language}
                onChange={e => onUpdate(codeContent, e.target.value)}
                className="appearance-none bg-[var(--bg)] border border-[var(--border)] text-[var(--text-dim)] text-[10px] font-mono rounded px-2 py-0.5 pr-5 outline-none hover:border-[var(--border2)] focus:border-[var(--purple)] transition-colors cursor-pointer"
              >
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <ChevronDown size={8} className="absolute right-1 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
            </div>
          )}
          
          {isCollapsed && (
            <span className="text-[10px] font-mono text-[var(--text-dim)] truncate max-w-[300px] opacity-60">
              {codeContent.split('\n')[0] || 'Empty code cell'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isCollapsed && (
            <button onClick={copy} className="text-[var(--text-dim)] hover:text-[var(--purple)] transition-colors flex items-center gap-1 text-[10px] font-mono">
              {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          )}
          <button onClick={onRemove} className="text-[var(--text-dim)] hover:text-[var(--red)] transition-colors">
            <span className="font-mono text-[10px]">✕</span>
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Editor area */}
          <div className="relative bg-black/40">
            {/* Line numbers */}
            <div className="flex">
              <div className="flex-shrink-0 w-10 bg-black/20 border-r border-[var(--border)] py-4 select-none">
                {(codeContent || '').split('\n').map((_, i) => (
                  <div key={i} className="text-[var(--text-dim)] text-xs font-mono text-right pr-2 leading-6 opacity-40">
                    {i + 1}
                  </div>
                ))}
              </div>
              <textarea
                value={codeContent}
                onChange={e => onUpdate(e.target.value, language)}
                placeholder={`// Write your ${language} code here...`}
                spellCheck={false}
                className="flex-1 bg-transparent resize-none outline-none text-[var(--cyan)] font-mono text-sm leading-6 p-4 min-h-[180px] placeholder-[var(--text-dim)]/40"
                style={{ tabSize: 2 }}
                onKeyDown={e => {
                  // Insert tab as spaces
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = e.currentTarget.selectionStart;
                    const end = e.currentTarget.selectionEnd;
                    const newVal = codeContent.substring(0, start) + '  ' + codeContent.substring(end);
                    onUpdate(newVal, language);
                    // Restore cursor position after state update
                    requestAnimationFrame(() => {
                      e.currentTarget.selectionStart = start + 2;
                      e.currentTarget.selectionEnd = start + 2;
                    });
                  }
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg2)] flex items-center gap-2">
            <span className="text-[10px] font-mono text-[var(--text-dim)]">
              {(codeContent || '').split('\n').length} lines · {(codeContent || '').length} chars
            </span>
            <span className="text-[10px] font-mono text-[var(--text-dim)] ml-auto opacity-60">
              Tab inserts 2 spaces
            </span>
          </div>
        </>
      )}
    </div>
  );
}
