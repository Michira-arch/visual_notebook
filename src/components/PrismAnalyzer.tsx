import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Copy, Check, Trash2, ChevronDown, Sparkles, FileCode2, Sigma, GitBranch, AlertTriangle, Lightbulb, Shield, Zap } from 'lucide-react';
import { ModelConfig } from '../providers/types';
import { generateCodeAnalysis, CodeAnalysisResult } from '../aiService';
import MermaidChart from './MermaidChart';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const LANGUAGES = [
  'auto', 'javascript', 'typescript', 'python', 'rust', 'go', 'java', 'c++',
  'c#', 'ruby', 'swift', 'kotlin', 'php', 'sql', 'html', 'css', 'bash', 'lua', 'zig', 'haskell',
];

type TabId = 'nl' | 'math' | 'diagram' | 'insights';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
}

const TABS: TabDef[] = [
  { id: 'nl', label: 'Natural Language', icon: <FileCode2 size={14} />, color: 'text-amber-400', borderColor: 'border-amber-400' },
  { id: 'math', label: 'Mathematics', icon: <Sigma size={14} />, color: 'text-cyan-400', borderColor: 'border-cyan-400' },
  { id: 'diagram', label: 'Flow Diagram', icon: <GitBranch size={14} />, color: 'text-purple-400', borderColor: 'border-purple-400' },
  { id: 'insights', label: 'Deep Insights', icon: <Lightbulb size={14} />, color: 'text-emerald-400', borderColor: 'border-emerald-400' },
];

const LOADING_MESSAGES = [
  'Parsing abstract syntax tree...',
  'Mapping function relationships...',
  'Computing complexity bounds...',
  'Identifying design patterns...',
  'Analyzing security surface...',
  'Generating formal notation...',
  'Building flow diagrams...',
  'Synthesizing deep insights...',
];

const SAMPLE_CODE = `class TaskQueue {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.run();
    });
  }

  async run() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;
    this.running++;
    const { task, resolve, reject } = this.queue.shift();
    try {
      resolve(await task());
    } catch (err) {
      reject(err);
    } finally {
      this.running--;
      this.run();
    }
  }
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function memoize(fn) {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}`;

interface Props {
  modelConfig: ModelConfig;
  isOpen: boolean;
  onClose: () => void;
}

export default function PrismAnalyzer({ modelConfig, isOpen, onClose }: Props) {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [language, setLanguage] = useState('auto');
  const [activeTab, setActiveTab] = useState<TabId>('nl');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<CodeAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lineCount = code.split('\n').length;
  const charCount = code.length;

  // Loading animation
  useEffect(() => {
    if (isAnalyzing) {
      setLoadingStepIdx(0);
      stepIntervalRef.current = setInterval(() => {
        setLoadingStepIdx(prev => Math.min(prev + 1, LOADING_MESSAGES.length - 1));
      }, 1200);
    } else {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
    }
    return () => { if (stepIntervalRef.current) clearInterval(stepIntervalRef.current); };
  }, [isAnalyzing]);

  const handleAnalyze = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const data = await generateCodeAnalysis(trimmed, language, modelConfig);
      setResult(data);
      setActiveTab('nl');
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Check your API key and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [code, language, modelConfig]);

  const handleCopy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* */ }
  }, []);

  const handleClear = useCallback(() => {
    setCode('');
    setResult(null);
    setError(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#07090e' }}>
      {/* ─── HEADER ─── */}
      <header className="h-14 flex items-center gap-5 px-5 border-b border-white/[0.07] flex-shrink-0" style={{ background: '#0d1118' }}>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-7 h-7 bg-amber-500 rounded-md flex items-center justify-center text-sm font-bold text-black tracking-tighter">P</div>
          <div>
            <div className="text-[13px] font-semibold tracking-[3px] text-white uppercase">PRISM</div>
            <div className="text-[10px] text-slate-500 tracking-wide">Code Intelligence</div>
          </div>
        </div>

        <div className="flex-1 flex items-center gap-3">
          {/* Language selector */}
          <div className="relative">
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="appearance-none text-[13px] font-sans text-slate-400 rounded-lg px-3 py-1.5 pr-7 outline-none cursor-pointer border border-white/[0.07] hover:border-white/[0.12] transition-colors"
              style={{ background: '#07090e' }}
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l === 'auto' ? 'Auto-detect' : l}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* Complexity badges */}
          {result?.complexity_summary && (
            <div className="hidden sm:flex items-center gap-2 ml-4">
              {result.complexity_summary.time && (
                <span className="text-[11px] font-mono text-cyan-400 bg-cyan-400/[0.08] border border-cyan-400/20 rounded-full px-3 py-0.5 flex items-center gap-1.5">
                  <Zap size={10} /> {result.complexity_summary.time}
                </span>
              )}
              {result.complexity_summary.space && (
                <span className="text-[11px] font-mono text-purple-400 bg-purple-400/[0.08] border border-purple-400/20 rounded-full px-3 py-0.5 flex items-center gap-1.5">
                  <Shield size={10} /> {result.complexity_summary.space}
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X size={16} />
        </button>
      </header>

      {/* ─── MAIN SPLIT PANELS ─── */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {/* ─── LEFT: CODE INPUT ─── */}
        <div className="flex flex-col border-r border-white/[0.07] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.07] flex-shrink-0" style={{ background: '#0d1118' }}>
            <span className="text-[11px] uppercase tracking-[1.5px] text-slate-500 font-medium">Source Code</span>
            <button
              onClick={handleClear}
              className="text-[11px] font-mono text-slate-500 hover:text-slate-300 border border-white/[0.07] hover:border-white/[0.12] rounded-md px-2.5 py-1 transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder={"// Paste your code here...\n// PRISM will break it down into natural language,\n// mathematical notation, flow diagrams, and deep insights."}
              spellCheck={false}
              className="w-full h-full resize-none outline-none border-none text-slate-300 text-[13px] leading-[1.7] p-5 placeholder-slate-600"
              style={{
                background: '#07090e',
                fontFamily: "'JetBrains Mono', monospace",
                tabSize: 2,
              }}
            />
          </div>

          <div className="flex items-center gap-3 px-4 py-3 border-t border-white/[0.07] flex-shrink-0" style={{ background: '#0d1118' }}>
            <span className="text-[11px] text-slate-500 flex-1 font-mono">
              {charCount.toLocaleString()} chars · {lineCount} lines
            </span>
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !code.trim()}
              className="flex items-center gap-2 px-5 h-9 rounded-lg bg-amber-500 text-black font-semibold text-[13px] tracking-wide border-none cursor-pointer transition-all hover:bg-amber-400 hover:-translate-y-px active:translate-y-0 disabled:bg-slate-700/50 disabled:text-slate-500 disabled:cursor-not-allowed disabled:transform-none flex-shrink-0"
            >
              {isAnalyzing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Analyzing
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Analyze
                </>
              )}
            </button>
          </div>
        </div>

        {/* ─── RIGHT: OUTPUT ─── */}
        <div className="flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/[0.07] flex-shrink-0" style={{ background: '#0d1118' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 h-[42px] text-[13px] border-b-2 -mb-px transition-colors cursor-pointer bg-transparent ${
                  activeTab === tab.id
                    ? `${tab.color} ${tab.borderColor}`
                    : 'text-slate-500 hover:text-slate-400 border-transparent'
                }`}
              >
                {tab.icon} <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Loading overlay */}
          {isAnalyzing && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5">
              <div className="w-12 h-12 border-[3px] border-slate-700 border-t-amber-500 rounded-full animate-spin" />
              <div className="text-[13px] text-slate-500 tracking-wide">Analyzing codebase...</div>
              <div className="flex flex-col gap-1.5 mt-2">
                {LOADING_MESSAGES.slice(0, loadingStepIdx + 1).map((msg, i) => (
                  <div
                    key={i}
                    className="text-[11px] text-slate-500 text-center animate-fade-in"
                    style={{ opacity: 0.6, animation: 'fadeIn 0.4s ease forwards' }}
                  >
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          {!isAnalyzing && (
            <div className="flex-1 overflow-y-auto p-6 prism-output">
              {error && (
                <div className="bg-red-500/[0.08] border border-red-500/20 rounded-lg p-4 text-[13px] text-red-400 leading-relaxed flex items-start gap-3">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Analysis failed:</strong> {error}
                    <br /><br />Make sure your API key is configured in Settings and try again.
                  </div>
                </div>
              )}

              {!result && !error && (
                <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
                  <div className="text-5xl opacity-[0.12]">◎</div>
                  <div className="text-[15px] text-slate-500 font-medium">Awaiting analysis</div>
                  <div className="text-[13px] text-slate-600 max-w-[260px] leading-relaxed">
                    Paste your code on the left and press <strong className="text-amber-500">Analyze</strong> to get a complete breakdown.
                  </div>
                </div>
              )}

              {result && activeTab === 'nl' && <NLPane result={result} onCopy={handleCopy} copied={copied} />}
              {result && activeTab === 'math' && <MathPane result={result} onCopy={handleCopy} copied={copied} />}
              {result && activeTab === 'diagram' && <DiagramPane result={result} onCopy={handleCopy} copied={copied} />}
              {result && activeTab === 'insights' && <InsightsPane result={result} onCopy={handleCopy} copied={copied} />}
            </div>
          )}

          {/* Status bar */}
          <div className="h-6 border-t border-white/[0.07] flex items-center gap-4 px-4 flex-shrink-0" style={{ background: '#0d1118' }}>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <div className={`w-1.5 h-1.5 rounded-full ${result ? 'bg-emerald-500' : 'bg-slate-500'}`} />
              {isAnalyzing ? 'Analyzing...' : result ? `Analyzed · ${result.detected_language || language}` : 'Ready'}
            </div>
            {result && (
              <div className="text-[10px] text-slate-600 ml-auto font-mono">{modelConfig.modelId}</div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 0.6; transform: translateY(0); } }
        .prism-output .md-render h1 { font-size: 18px; font-weight: 600; color: #e2e8f0; margin: 0 0 16px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .prism-output .md-render h2 { font-size: 14px; font-weight: 600; color: #f59e0b; margin: 24px 0 10px; text-transform: uppercase; letter-spacing: 1px; }
        .prism-output .md-render h3 { font-size: 13px; font-weight: 500; color: #94a3b8; margin: 18px 0 8px; }
        .prism-output .md-render p { font-size: 13px; color: #94a3b8; margin: 0 0 10px; line-height: 1.7; }
        .prism-output .md-render ul, .prism-output .md-render ol { padding-left: 18px; margin: 0 0 10px; }
        .prism-output .md-render li { font-size: 13px; color: #94a3b8; margin: 3px 0; line-height: 1.6; }
        .prism-output .md-render code { font-family: 'JetBrains Mono', monospace; font-size: 11px; background: #141b27; border: 1px solid rgba(255,255,255,0.07); border-radius: 4px; padding: 1px 5px; color: #22d3ee; }
        .prism-output .md-render pre { background: #0d1118; border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 14px; margin: 10px 0; overflow-x: auto; }
        .prism-output .md-render pre code { background: none; border: none; padding: 0; color: #94a3b8; }
        .prism-output .md-render strong { color: #e2e8f0; font-weight: 600; }
        .prism-output .md-render blockquote { border-left: 3px solid #f59e0b; padding-left: 12px; margin: 10px 0; }
        .prism-output .md-render blockquote p { color: #64748b; font-style: italic; }
        .prism-output ::-webkit-scrollbar { width: 5px; height: 5px; }
        .prism-output ::-webkit-scrollbar-track { background: transparent; }
        .prism-output ::-webkit-scrollbar-thumb { background: #1b2436; border-radius: 3px; }
      `}</style>
    </div>
  );
}

/* ─── SUB-PANES ─── */

function CopyButton({ text, label, onCopy, copied }: { text: string; label: string; onCopy: (text: string, label: string) => void; copied: string | null }) {
  const isCopied = copied === label;
  return (
    <button
      onClick={() => onCopy(text, label)}
      className={`flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-md border transition-colors ${
        isCopied
          ? 'border-emerald-500/30 text-emerald-400'
          : 'border-white/[0.07] text-slate-500 hover:text-slate-400 hover:border-white/[0.12]'
      }`}
    >
      {isCopied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
    </button>
  );
}

function SummaryBar({ summary }: { summary: string }) {
  return (
    <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}>
      <div className="text-[10px] text-amber-500 uppercase tracking-[1.5px] mb-1.5 font-medium">Summary</div>
      <div className="text-[13px] text-slate-400 leading-relaxed">{summary}</div>
    </div>
  );
}

function NLPane({ result, onCopy, copied }: { result: CodeAnalysisResult; onCopy: (t: string, l: string) => void; copied: string | null }) {
  return (
    <div>
      {result.summary && <SummaryBar summary={result.summary} />}

      {result.complexity_summary && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {result.complexity_summary.time && (
            <div className="text-[11px] text-cyan-400 bg-cyan-400/[0.06] border border-cyan-400/15 rounded-full px-3 py-1 flex items-center gap-1.5 font-mono">
              <span className="opacity-50">Time</span> {result.complexity_summary.time}
            </div>
          )}
          {result.complexity_summary.space && (
            <div className="text-[11px] text-purple-400 bg-purple-400/[0.06] border border-purple-400/15 rounded-full px-3 py-1 flex items-center gap-1.5 font-mono">
              <span className="opacity-50">Space</span> {result.complexity_summary.space}
            </div>
          )}
          {result.complexity_summary.dominant_operation && (
            <div className="text-[11px] text-slate-500 bg-white/[0.03] border border-white/[0.07] rounded-full px-3 py-1">
              {result.complexity_summary.dominant_operation}
            </div>
          )}
        </div>
      )}

      {result.natural_language && (
        <div className="md-render">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{result.natural_language}</ReactMarkdown>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-white/[0.07] flex justify-end">
        <CopyButton text={result.natural_language || ''} label="nl" onCopy={onCopy} copied={copied} />
      </div>
    </div>
  );
}

function MathPane({ result, onCopy, copied }: { result: CodeAnalysisResult; onCopy: (t: string, l: string) => void; copied: string | null }) {
  return (
    <div>
      {result.math && (
        <div className="md-render math-render">
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{result.math}</ReactMarkdown>
        </div>
      )}

      {!result.math && (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
          <div className="text-4xl opacity-[0.12]">∑</div>
          <div className="text-[14px] text-slate-500">No mathematical analysis generated</div>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-white/[0.07] flex justify-end">
        <CopyButton text={result.math || ''} label="math" onCopy={onCopy} copied={copied} />
      </div>
    </div>
  );
}

function DiagramPane({ result, onCopy, copied }: { result: CodeAnalysisResult; onCopy: (t: string, l: string) => void; copied: string | null }) {
  if (!result.mermaid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
        <div className="text-4xl opacity-[0.12]">⬡</div>
        <div className="text-[14px] text-slate-500">No diagram generated</div>
      </div>
    );
  }

  return (
    <div>
      <div className="inline-flex items-center gap-2 bg-purple-400/[0.08] border border-purple-400/20 rounded-full px-3 py-1 text-[11px] text-purple-400 uppercase tracking-wide mb-4">
        <GitBranch size={11} /> Mermaid Diagram
      </div>

      <div className="rounded-xl border border-white/[0.07] p-6 min-h-[300px] overflow-auto" style={{ background: '#0d1118' }}>
        <MermaidChart chart={result.mermaid} />
      </div>

      <div className="mt-4 rounded-lg border border-white/[0.07] overflow-hidden" style={{ background: '#07090e' }}>
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/[0.07]" style={{ background: '#0d1118' }}>
          <span className="text-[11px] text-slate-500 uppercase tracking-wide">Diagram Source</span>
          <CopyButton text={result.mermaid} label="mermaid" onCopy={onCopy} copied={copied} />
        </div>
        <pre className="p-4 text-[12px] text-slate-400 overflow-x-auto whitespace-pre" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {result.mermaid}
        </pre>
      </div>
    </div>
  );
}

function InsightsPane({ result, onCopy, copied }: { result: CodeAnalysisResult; onCopy: (t: string, l: string) => void; copied: string | null }) {
  if (!result.insights) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
        <div className="text-4xl opacity-[0.12]">💡</div>
        <div className="text-[14px] text-slate-500">No deep insights generated</div>
      </div>
    );
  }

  return (
    <div>
      <div className="inline-flex items-center gap-2 bg-emerald-400/[0.08] border border-emerald-400/20 rounded-full px-3 py-1 text-[11px] text-emerald-400 uppercase tracking-wide mb-4">
        <Lightbulb size={11} /> Deep Analysis
      </div>

      <div className="md-render">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{result.insights}</ReactMarkdown>
      </div>

      <div className="mt-6 pt-4 border-t border-white/[0.07] flex justify-end">
        <CopyButton text={result.insights || ''} label="insights" onCopy={onCopy} copied={copied} />
      </div>
    </div>
  );
}
