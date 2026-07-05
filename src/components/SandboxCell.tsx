import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, RotateCcw, ChevronDown, ChevronRight, Trash2, Maximize2, Minimize2, Code2, Terminal, Eye, EyeOff } from 'lucide-react';

type Tab = 'html' | 'css' | 'js';

interface ConsoleEntry {
  type: 'log' | 'warn' | 'error' | 'info';
  text: string;
  ts: number;
}

interface Props {
  id: string;
  sandboxHtml: string;
  sandboxCss: string;
  sandboxJs: string;
  autoRun: boolean;
  isCollapsed?: boolean;
  executionCount?: number;
  onUpdate: (html: string, css: string, js: string, autoRun: boolean) => void;
  onToggleCollapse: () => void;
  onRemove: () => void;
  onShiftEnter?: () => void;
}

const STARTER_HTML = `<div class="scene">
  <h1>Hello, Sandbox!</h1>
  <p>Write HTML, CSS & JS here.</p>
  <button id="btn">Click Me</button>
  <div id="output"></div>
</div>`;

const STARTER_CSS = `.scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  font-family: 'Inter', system-ui, sans-serif;
  color: #e2e8f0;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  padding: 2rem;
}

h1 {
  background: linear-gradient(135deg, #22d3ee, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

button {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  border: 1px solid #22d3ee;
  background: transparent;
  color: #22d3ee;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

button:hover {
  background: rgba(34, 211, 238, 0.15);
  box-shadow: 0 0 20px rgba(34, 211, 238, 0.2);
}

#output {
  margin-top: 1rem;
  font-family: monospace;
  color: #22c55e;
  min-height: 1.5em;
}`;

const STARTER_JS = `const btn = document.getElementById('btn');
const out = document.getElementById('output');
let count = 0;

btn.addEventListener('click', () => {
  count++;
  out.textContent = \`Clicked \${count} time\${count > 1 ? 's' : ''}\`;
  console.log('Button clicked', count);
});`;

export default function SandboxCell({ id, sandboxHtml, sandboxCss, sandboxJs, autoRun, isCollapsed, executionCount, onUpdate, onToggleCollapse, onRemove, onShiftEnter }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('html');
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [showConsole, setShowConsole] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showEditor, setShowEditor] = useState(true);
  const [previewKey, setPreviewKey] = useState(0);
  const [splitPercent, setSplitPercent] = useState(50);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const autoRunTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use starter content if all fields are empty (brand new cell)
  const html = sandboxHtml || (sandboxCss || sandboxJs ? '' : STARTER_HTML);
  const css = sandboxCss || (sandboxHtml || sandboxJs ? '' : STARTER_CSS);
  const js = sandboxJs || (sandboxHtml || sandboxCss ? '' : STARTER_JS);

  const buildSrcdoc = useCallback(() => {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0f172a; color: #e2e8f0; overflow: auto; }
${css}
</style>
</head>
<body>
${html}
<script>
// Console intercept — pipe logs to parent
(function() {
  const _orig = {};
  ['log','warn','error','info'].forEach(function(method) {
    _orig[method] = console[method];
    console[method] = function() {
      var args = Array.prototype.slice.call(arguments);
      var text = args.map(function(a) {
        if (typeof a === 'object') { try { return JSON.stringify(a, null, 2); } catch(e) { return String(a); } }
        return String(a);
      }).join(' ');
      try { window.parent.postMessage({ __sandbox_console: true, sandboxId: '${id}', type: method, text: text }, '*'); } catch(e){}
      _orig[method].apply(console, arguments);
    };
  });
  window.onerror = function(msg, src, line, col, err) {
    console.error(msg + (line ? ' (line ' + line + ')' : ''));
  };
})();

// User script
try {
${js}
} catch(e) {
  console.error(e.message || e);
}
</script>
</body>
</html>`;
  }, [html, css, js, id]);

  // Listen for console messages from the iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.__sandbox_console && e.data.sandboxId === id) {
        setConsoleEntries(prev => [...prev.slice(-200), { type: e.data.type, text: e.data.text, ts: Date.now() }]);
        if (e.data.type === 'error') setShowConsole(true);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [id]);

  // Auto-run with debounce
  useEffect(() => {
    if (!autoRun) return;
    if (autoRunTimer.current) clearTimeout(autoRunTimer.current);
    autoRunTimer.current = setTimeout(() => {
      setConsoleEntries([]);
      setPreviewKey(k => k + 1);
    }, 800);
    return () => { if (autoRunTimer.current) clearTimeout(autoRunTimer.current); };
  }, [html, css, js, autoRun]);

  const runPreview = () => {
    setConsoleEntries([]);
    setPreviewKey(k => k + 1);
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'html': return html;
      case 'css': return css;
      case 'js': return js;
    }
  };

  const setTabContent = (val: string) => {
    switch (activeTab) {
      case 'html': onUpdate(val, css, js, autoRun); break;
      case 'css': onUpdate(html, val, js, autoRun); break;
      case 'js': onUpdate(html, css, val, autoRun); break;
    }
  };

  const tabs: { key: Tab; label: string; color: string; icon: string }[] = [
    { key: 'html', label: 'HTML', color: 'var(--orange)', icon: '◆' },
    { key: 'css', label: 'CSS', color: 'var(--purple)', icon: '◆' },
    { key: 'js', label: 'JS', color: 'var(--yellow)', icon: '◆' },
  ];

  const consoleColors: Record<string, string> = {
    log: 'var(--text)',
    info: 'var(--cyan)',
    warn: 'var(--yellow)',
    error: 'var(--red)',
  };

  const wrapperClass = isFullscreen
    ? 'fixed inset-0 z-[9999] bg-[var(--bg)] flex flex-col'
    : `relative border border-[var(--border)] bg-[var(--bg2)] rounded shadow-xl overflow-hidden mb-4 transition-all hover:border-[var(--orange)]/50 group ${isCollapsed ? 'mb-2' : 'mb-8'}`;

  return (
    <div className={wrapperClass}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg2)] border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          {!isFullscreen && (
            <button onClick={onToggleCollapse} className="text-[var(--text-dim)] hover:text-[var(--orange)] transition-colors">
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          <span className="font-mono text-[10px] tracking-widest text-[var(--orange)] uppercase flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--orange)] opacity-40"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--orange)]"></span>
            </span>
            Sandbox {id.slice(0, 4)}
          </span>
          {executionCount !== undefined && (
            <span className="font-mono text-[10px] text-[var(--text-dim)]">In [{executionCount}]</span>
          )}
          {isCollapsed && (
            <span className="text-[10px] font-mono text-[var(--text-dim)] truncate max-w-[300px] opacity-60">
              {html.split('\n')[0] || 'Empty sandbox'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <>
              <button
                onClick={() => setShowEditor(!showEditor)}
                className={`flex items-center gap-1 text-[10px] font-mono transition-colors px-2 py-0.5 rounded ${!showEditor ? 'text-[var(--cyan)] bg-[var(--cyan)]/10' : 'text-[var(--text-dim)] hover:text-white'}`}
                title={showEditor ? 'Hide code editor' : 'Show code editor'}
              >
                <Code2 size={12} /> {showEditor ? 'HIDE CODE' : 'SHOW CODE'}
              </button>
              <button
                onClick={() => onUpdate(html, css, js, !autoRun)}
                className={`flex items-center gap-1 text-[10px] font-mono transition-colors px-2 py-0.5 rounded ${autoRun ? 'text-[var(--green)] bg-[var(--green)]/10' : 'text-[var(--text-dim)] hover:text-white'}`}
                title={autoRun ? 'Auto-run ON: preview updates as you type' : 'Auto-run OFF: click Run to update preview'}
              >
                {autoRun ? <Eye size={12} /> : <EyeOff size={12} />}
                {autoRun ? 'AUTO' : 'MANUAL'}
              </button>
              <button onClick={runPreview} className="flex items-center gap-1 text-[10px] font-mono text-[var(--green)] hover:text-green-300 transition-colors px-2 py-0.5 rounded hover:bg-[var(--green)]/10" title="Run preview">
                <Play size={12} /> RUN
              </button>
              <button onClick={() => setShowConsole(!showConsole)} className={`flex items-center gap-1 text-[10px] font-mono transition-colors px-2 py-0.5 rounded ${showConsole ? 'text-[var(--cyan)] bg-[var(--cyan)]/10' : 'text-[var(--text-dim)] hover:text-white'}`} title="Toggle console">
                <Terminal size={12} />
                {consoleEntries.length > 0 && <span className="ml-0.5 w-4 h-4 rounded-full bg-[var(--cyan)]/20 text-[var(--cyan)] text-[9px] flex items-center justify-center">{consoleEntries.length > 99 ? '99+' : consoleEntries.length}</span>}
              </button>
              <button onClick={() => setIsFullscreen(!isFullscreen)} className="text-[var(--text-dim)] hover:text-white transition-colors" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </>
          )}
          {!isFullscreen && (
            <button onClick={onRemove} className="text-[var(--text-dim)] hover:text-[var(--red)] transition-colors opacity-0 group-hover:opacity-100">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className={`flex ${isFullscreen ? 'flex-1' : 'resize-y'} overflow-hidden min-h-[200px]`} style={isFullscreen ? {} : { height: '520px' }}>
          {/* Editor pane */}
          {showEditor && (
            <div className="flex flex-col border-r border-[var(--border)] relative" style={{ width: `${splitPercent}%` }}>
              {/* Split Handle */}
            <div
              className="absolute right-[-4px] top-0 bottom-0 w-2 cursor-col-resize z-20 hover:bg-[var(--cyan)]/20 active:bg-[var(--cyan)]/40 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startPercent = splitPercent;
                const parent = e.currentTarget.parentElement?.parentElement;
                if (!parent) return;
                const parentWidth = parent.getBoundingClientRect().width;
                
                const onMouseMove = (moveEvent: MouseEvent) => {
                  const deltaX = moveEvent.clientX - startX;
                  const deltaPercent = (deltaX / parentWidth) * 100;
                  setSplitPercent(Math.max(10, Math.min(90, startPercent + deltaPercent)));
                };
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
              }}
            />
            {/* Tabs */}
            <div className="flex items-center bg-[var(--bg2)] border-b border-[var(--border)] px-1">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2 text-[11px] font-mono uppercase tracking-wider transition-all relative ${activeTab === t.key ? 'text-white' : 'text-[var(--text-dim)] hover:text-white'}`}
                >
                  <span className="relative z-10 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color, opacity: activeTab === t.key ? 1 : 0.4 }} />
                    {t.label}
                  </span>
                  {activeTab === t.key && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ background: t.color }} />
                  )}
                </button>
              ))}
            </div>
            {/* Text editor */}
            <div className="flex-1 relative bg-black/40 overflow-hidden">
              <div className="flex h-full">
                <div 
                  ref={lineNumbersRef}
                  className="flex-shrink-0 w-10 bg-black/20 border-r border-[var(--border)] py-3 select-none overflow-hidden"
                >
                  {(getTabContent() || '').split('\n').map((_, i) => (
                    <div key={i} className="text-[var(--text-dim)] text-[11px] font-mono text-right pr-2 leading-[22px] opacity-40">
                      {i + 1}
                    </div>
                  ))}
                </div>
                <textarea
                  value={getTabContent()}
                  onChange={e => setTabContent(e.target.value)}
                  onScroll={e => {
                    if (lineNumbersRef.current) {
                      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
                    }
                  }}
                  spellCheck={false}
                  className="flex-1 h-full bg-transparent resize-none outline-none font-mono text-sm leading-[22px] p-3 placeholder-[var(--text-dim)]/40 overflow-auto"
                  style={{
                    tabSize: 2,
                    color: activeTab === 'html' ? 'var(--orange)' : activeTab === 'css' ? 'var(--purple)' : 'var(--yellow)',
                  }}
                  placeholder={`Write your ${activeTab.toUpperCase()} here...`}
                  onKeyDown={e => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const ta = e.currentTarget;
                      const start = ta.selectionStart;
                      const end = ta.selectionEnd;
                      const newVal = getTabContent().substring(0, start) + '  ' + getTabContent().substring(end);
                      setTabContent(newVal);
                      requestAnimationFrame(() => { ta.selectionStart = start + 2; ta.selectionEnd = start + 2; });
                    }
                    // Ctrl/Cmd+Enter to run
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      runPreview();
                    }
                    if (e.key === 'Enter' && e.shiftKey && onShiftEnter) {
                      e.preventDefault();
                      onShiftEnter();
                    }
                  }}
                />
              </div>
            </div>
          </div>
          )}

          {/* Preview pane */}
          <div className="flex flex-col" style={{ width: showEditor ? `${100 - splitPercent}%` : '100%' }}>
            <div className="flex items-center justify-between bg-[var(--bg2)] border-b border-[var(--border)] px-3 py-1.5">
              <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" /> Preview
              </span>
              <button
                onClick={() => { setConsoleEntries([]); runPreview(); }}
                className="text-[10px] font-mono text-[var(--text-dim)] hover:text-white flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={10} /> Reload
              </button>
            </div>
            <div className="flex-1 bg-[#0f172a] relative overflow-hidden">
              <iframe
                ref={iframeRef}
                key={previewKey}
                srcDoc={buildSrcdoc()}
                sandbox="allow-scripts"
                className="w-full h-full border-0"
                title={`Sandbox preview ${id}`}
              />
            </div>
            {/* Console */}
            {showConsole && (
              <div className="border-t border-[var(--border)] bg-black/60 flex flex-col" style={{ height: '140px' }}>
                <div className="flex items-center justify-between px-3 py-1 border-b border-[var(--border)]">
                  <span className="text-[9px] font-mono text-[var(--text-dim)] uppercase tracking-widest">Console</span>
                  <button
                    onClick={() => setConsoleEntries([])}
                    className="text-[9px] font-mono text-[var(--text-dim)] hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-1 font-mono text-[11px]">
                  {consoleEntries.length === 0 && (
                    <div className="text-[var(--text-dim)] opacity-40 py-2 text-center">No console output</div>
                  )}
                  {consoleEntries.map((entry, i) => (
                    <div key={i} className="py-0.5 border-b border-white/5 flex items-start gap-2" style={{ color: consoleColors[entry.type] }}>
                      <span className="opacity-40 flex-shrink-0 text-[9px] mt-0.5">
                        {entry.type === 'error' ? '✕' : entry.type === 'warn' ? '⚠' : '›'}
                      </span>
                      <span className="break-all whitespace-pre-wrap">{entry.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      {!isCollapsed && !isFullscreen && showEditor && (
        <div className="px-4 py-1.5 border-t border-[var(--border)] bg-[var(--bg2)] flex items-center gap-4">
          <span className="text-[10px] font-mono text-[var(--text-dim)]">
            {html.split('\n').length + css.split('\n').length + js.split('\n').length} lines
          </span>
          <span className="text-[10px] font-mono text-[var(--text-dim)]">
            HTML: {html.length} · CSS: {css.length} · JS: {js.length}
          </span>
          <span className="text-[10px] font-mono text-[var(--text-dim)] ml-auto opacity-60">
            Ctrl+Enter to run · Tab inserts 2 spaces
          </span>
        </div>
      )}
    </div>
  );
}
