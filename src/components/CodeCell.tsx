import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, Sparkles, Folder, Plus, Trash2 } from 'lucide-react';
import CodeMirrorEditor from './CodeMirrorEditor';
import { detectLanguage } from '../engine/languageInference';
import CellOutput from './CellOutput';
import { ExecutionResult, CellSandbox } from '../types';

const LANGUAGES = [
  'plaintext', 'python', 'javascript', 'typescript', 'rust', 'go',
  'java', 'c', 'cpp', 'sql', 'bash', 'json', 'yaml', 'html', 'css', 'markdown'
];

const SANDBOX_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

interface Props {
  id: string;
  codeContent: string;
  language: string;
  languageOverride?: string;
  detectedLanguage?: string;
  detectedConfidence?: number;
  isCollapsed?: boolean;
  executionCount?: number;
  executionResult?: ExecutionResult;
  isExecuting?: boolean;
  sandboxes?: CellSandbox[];
  sandboxId?: string;
  onAssignSandbox?: (sandboxId: string | undefined) => void;
  onCreateSandbox?: (name: string, color: string) => void;
  onFocusSandbox?: (sandboxId: string) => void;
  onUpdate: (
    code: string,
    lang: string,
    detectedLang?: string,
    detectedConf?: number,
    langOverride?: string
  ) => void;
  onToggleCollapse: () => void;
  onRemove: () => void;
  onShiftEnter?: () => void;
}

export default function CodeCell({
  id,
  codeContent,
  language,
  languageOverride,
  detectedLanguage,
  detectedConfidence,
  isCollapsed,
  executionCount,
  executionResult,
  isExecuting,
  sandboxes = [],
  sandboxId,
  onAssignSandbox,
  onCreateSandbox,
  onFocusSandbox,
  onUpdate,
  onToggleCollapse,
  onRemove,
  onShiftEnter
}: Props) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const [sandboxMenuOpen, setSandboxMenuOpen] = useState(false);
  const [newSandboxName, setNewSandboxName] = useState('');
  const sandboxMenuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
      if (sandboxMenuRef.current && !sandboxMenuRef.current.contains(event.target as Node)) {
        setSandboxMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Run language inference on change
  const handleCodeChange = (newCode: string) => {
    // If there is an override, stick to the override. Otherwise, auto-detect
    if (languageOverride) {
      onUpdate(newCode, languageOverride, detectedLanguage, detectedConfidence, languageOverride);
    } else {
      const result = detectLanguage(newCode);
      onUpdate(newCode, result.language, result.language, result.confidence, undefined);
    }
  };

  const selectLanguage = (lang: string, isOverride: boolean) => {
    if (isOverride) {
      onUpdate(codeContent, lang, detectedLanguage, detectedConfidence, lang);
    } else {
      // Re-enable auto detect
      const result = detectLanguage(codeContent);
      onUpdate(codeContent, result.language, result.language, result.confidence, undefined);
    }
    setMenuOpen(false);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter languages for the search dropdown
  const filteredLanguages = LANGUAGES.filter(l =>
    l.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayLang = languageOverride || language || 'plaintext';
  const displayConfidence = languageOverride ? null : detectedConfidence;

  const currentSandbox = sandboxes.find(s => s.id === sandboxId);
  const sandboxColor = currentSandbox?.color;

  return (
    <div 
      className={`relative border border-[var(--border)] bg-[var(--bg2)] rounded shadow-xl overflow-hidden mb-4 transition-all hover:border-[var(--purple)]/50 group ${isCollapsed ? 'mb-2' : 'mb-8'}`}
      style={{
        borderLeft: sandboxColor ? `4px solid ${sandboxColor}` : undefined
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg2)] border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <button 
            onClick={onToggleCollapse}
            className="text-[var(--text-dim)] hover:text-[var(--purple)] transition-colors"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          
          {/* cell badge */}
          <span className="font-mono text-[10px] tracking-widest text-[var(--purple)] uppercase flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--purple)] opacity-70" />
            Code {id.slice(0, 4)}
          </span>
          
          {executionCount !== undefined && (
            <span className="font-mono text-[10px] text-[var(--text-dim)]">In [{executionCount}]</span>
          )}

          {!isCollapsed && (
            <div className="flex items-center gap-2">
              {/* Language Dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-1.5 bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--border2)] text-[var(--text-dim)] hover:text-[var(--text)] text-[10px] font-mono rounded px-2.5 py-0.5 outline-none transition-colors cursor-pointer"
                >
                  <span>{displayLang}</span>
                  {displayConfidence !== undefined && displayConfidence !== null && (
                    <span className="text-[var(--cyan)] opacity-80">{displayConfidence}%</span>
                  )}
                  {languageOverride && (
                    <span className="text-[var(--orange)] opacity-80">(edited)</span>
                  )}
                  <ChevronDown size={10} className="opacity-60" />
                </button>

                {/* Clean custom language list popover */}
                {menuOpen && (
                  <div className="absolute left-0 mt-1 w-48 bg-[var(--bg)] border border-[var(--border)] rounded-md shadow-2xl z-50 py-1 overflow-hidden">
                    <div className="px-2 py-1.5 border-b border-[var(--border)]">
                      <input
                        type="text"
                        placeholder="Search language..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--bg2)] border border-[var(--border)] rounded text-[11px] px-2 py-1 outline-none text-white font-mono placeholder-[var(--text-dim)]/60"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto font-mono text-[11px]">
                      {languageOverride && (
                        <button
                          onClick={() => selectLanguage('', false)}
                          className="w-full text-left px-3 py-1.5 text-[var(--cyan)] hover:bg-[var(--border)] flex items-center justify-between"
                        >
                          <span>Reset Auto-Detect</span>
                          <Sparkles size={10} />
                        </button>
                      )}
                      {filteredLanguages.map(l => (
                        <button
                          key={l}
                          onClick={() => selectLanguage(l, true)}
                          className={`w-full text-left px-3 py-1.5 hover:bg-[var(--border)] flex items-center justify-between ${
                            l === displayLang ? 'text-[var(--purple)] bg-[var(--border)]/30' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                          }`}
                        >
                          <span>{l}</span>
                          {l === displayLang && <Check size={10} />}
                        </button>
                      ))}
                      {filteredLanguages.length === 0 && (
                        <div className="px-3 py-1.5 text-[var(--text-dim)] italic">No matches</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sandbox Dropdown */}
              <div className="relative" ref={sandboxMenuRef}>
                <button
                  onClick={() => setSandboxMenuOpen(!sandboxMenuOpen)}
                  className="flex items-center gap-1.5 bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--border2)] text-[var(--text-dim)] hover:text-[var(--text)] text-[10px] font-mono rounded px-2.5 py-0.5 outline-none transition-colors cursor-pointer"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: sandboxes.find(s => s.id === sandboxId)?.color || '#64748b'
                    }}
                  />
                  <span>
                    {sandboxes.find(s => s.id === sandboxId)?.name || 'Global'}
                  </span>
                  <ChevronDown size={10} className="opacity-60" />
                </button>

                {sandboxMenuOpen && (
                  <div className="absolute left-0 mt-1 w-52 bg-[var(--bg)] border border-[var(--border)] rounded-md shadow-2xl z-50 py-1 overflow-hidden">
                    <div className="px-3 py-1 border-b border-[var(--border)] text-[var(--text-dim)] text-[9px] uppercase tracking-wider font-semibold flex items-center justify-between">
                      <span>Assign Sandbox</span>
                      {sandboxId && onFocusSandbox && (
                        <button
                          onClick={() => {
                            onFocusSandbox(sandboxId);
                            setSandboxMenuOpen(false);
                          }}
                          className="text-[var(--cyan)] hover:text-white transition-colors cursor-pointer"
                        >
                          Focus
                        </button>
                      )}
                    </div>
                    <div className="max-h-36 overflow-y-auto font-mono text-[11px]">
                      <button
                        onClick={() => {
                          onAssignSandbox?.(undefined);
                          setSandboxMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-[var(--border)] flex items-center gap-2 ${
                          !sandboxId ? 'text-[var(--cyan)] bg-[var(--border)]/30' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                        <span>Global (default)</span>
                      </button>
                      {sandboxes.map(s => (
                        <button
                          key={s.id}
                          onClick={() => {
                            onAssignSandbox?.(s.id);
                            setSandboxMenuOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 hover:bg-[var(--border)] flex items-center gap-2 ${
                            s.id === sandboxId ? 'text-[var(--cyan)] bg-[var(--border)]/30' : 'text-[var(--text-dim)] hover:text-[var(--text)]'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span>{s.name}</span>
                        </button>
                      ))}
                    </div>

                    <div className="px-2 py-1.5 border-t border-[var(--border)] bg-[var(--bg2)]/50">
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="New Sandbox..."
                          value={newSandboxName}
                          onChange={e => setNewSandboxName(e.target.value)}
                          className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded text-[10px] px-1.5 py-0.5 outline-none text-white placeholder-[var(--text-dim)]/65"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && newSandboxName.trim()) {
                              const color = SANDBOX_COLORS[sandboxes.length % SANDBOX_COLORS.length];
                              onCreateSandbox?.(newSandboxName.trim(), color);
                              setNewSandboxName('');
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (newSandboxName.trim()) {
                              const color = SANDBOX_COLORS[sandboxes.length % SANDBOX_COLORS.length];
                              onCreateSandbox?.(newSandboxName.trim(), color);
                              setNewSandboxName('');
                            }
                          }}
                          className="p-1 bg-[var(--purple)] hover:bg-purple-400 text-purple-950 font-bold rounded flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
          <div className="relative bg-black/20 overflow-hidden min-h-[180px] p-1">
            <CodeMirrorEditor
              code={codeContent}
              language={displayLang}
              onChange={handleCodeChange}
              onExecute={onShiftEnter}
            />
          </div>

          {/* Footer */}
          <div className="px-4 py-1.5 border-t border-[var(--border)] bg-[var(--bg2)] flex items-center justify-between">
            <span className="text-[10px] font-mono text-[var(--text-dim)]">
              {(codeContent || '').split('\n').length} lines · {(codeContent || '').length} chars
            </span>
            <span className="text-[10px] font-mono text-[var(--text-dim)] opacity-60">
              Shift+Enter to run
            </span>
          </div>

          <CellOutput result={executionResult} isExecuting={isExecuting} />
        </>
      )}
    </div>
  );
}
