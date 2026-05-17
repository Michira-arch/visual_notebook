import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, FileText, FileCode2, Settings, Trash2, Zap, PlaySquare, Menu, Bot, Download, Ship, Maximize2, Minimize2 } from 'lucide-react';
import { CellData, CellType, Reference, NotebookState } from './types';
import { ModelConfig } from './providers/types';
import { generateVisualCell, runFloodlightPlan } from './aiService';
import { PROVIDERS, getActiveProvider, getActiveModel, setActiveProvider, setActiveModel } from './providers/registry';
import { getNotebook, saveNotebook, deleteNotebook, getActiveNotebookId, setActiveNotebookId, createBlankNotebook, migrateOrLoadInitialNotebook, getAllNotebooks } from './notebookStorage';
import { apiFetch } from './serverClient';
import ModelSelector from './components/ModelSelector';
import SettingsModal from './components/SettingsModal';
import CellComponent from './components/CellComponent';
import NewCellButton from './components/NewCellButton';
import Sidebar from './components/Sidebar';
import ReferenceViewer from './components/ReferenceViewer';
import TemplateGallery from './components/TemplateGallery';
import PresentationMode from './components/PresentationMode';
import AgentChat from './components/AgentChat';
import PrismAnalyzer from './components/PrismAnalyzer';
import Shipper from './components/Shipper';
import ResearchBank from './components/ResearchBank';
import TerminalManager from './components/TerminalManager';
import { Terminal as TerminalIcon, GraduationCap } from 'lucide-react';
import 'katex/dist/katex.min.css';

const GEMINI_ENV_KEY = process.env.GEMINI_API_KEY || '';
function mkId() { return Math.random().toString(36).substr(2, 9); }

// The old DEMO cells for migration
const DEMO_HTML = `<div class="custom-card"><div class="custom-card-title">WELCOME</div><p>Start brainstorming.</p></div>`;
const DEFAULT_CELLS: CellData[] = [
  { id: mkId(), type: 'markdown', versions: [], currentVersionIndex: 0, isEditing: false, isLoading: false, markdownContent: "### Context & Reasoning Engine\nHere we draft context." },
  { id: mkId(), type: 'canvas', versions: [{ prompt: 'Create a welcome pipeline', content: DEMO_HTML, timestamp: Date.now() }], currentVersionIndex: 0, isEditing: false, isLoading: false },
];

export default function App() {
  const [notebooks, setNotebooks] = useState<NotebookState[]>(() => {
    migrateOrLoadInitialNotebook(DEFAULT_CELLS);
    return getAllNotebooks();
  });
  
  const [activeNbId, setActiveNbId] = useState<string>(() => getActiveNotebookId() || notebooks[0].id);
  const activeNb = notebooks.find(n => n.id === activeNbId) || notebooks[0];

  // Recovery mechanism: If the browser's localStorage is wiped, pull from the Python DB
  useEffect(() => {
    apiFetch('/api/notebooks')
      .then(res => res.json())
      .then(dbMeta => {
        if (!Array.isArray(dbMeta) || dbMeta.length === 0) return;
        const localMeta = JSON.parse(localStorage.getItem('vnb-meta-v3') || '[]');
        // If browser cache is empty but Python DB has data, perform a full recovery
        if (localMeta.length === 0 || (localMeta.length === 1 && localMeta[0].name === 'My First Notebook' && dbMeta.length > 0 && dbMeta[0].name !== 'My First Notebook')) {
          apiFetch(`/api/notebooks/${dbMeta[0].id}`)
            .then(res => res.json())
            .then(fullNb => {
              if (!fullNb || !fullNb.id) return;
              localStorage.setItem('vnb-meta-v3', JSON.stringify(dbMeta));
              localStorage.setItem(`vnb-data-${fullNb.id}`, JSON.stringify(fullNb));
              localStorage.setItem('vnb-active-id-v3', fullNb.id);
              setActiveNbId(fullNb.id);
              setNotebooks([fullNb, ...dbMeta.slice(1).map((m: any) => ({ ...m, cells: [], references: [], conversations: [] }))]);
            });
        }
      })
      .catch(() => {});
  }, []);

  const setCells = useCallback((updater: CellData[] | ((cells: CellData[]) => CellData[])) => {
    setNotebooks(prev => {
      const idx = prev.findIndex(n => n.id === activeNbId);
      if (idx === -1) return prev;
      const nextCells = typeof updater === 'function' ? updater(prev[idx].cells) : updater;
      const nextNb = { ...prev[idx], cells: nextCells, updatedAt: Date.now() };
      saveNotebook(nextNb);
      const nextAll = [...prev]; nextAll[idx] = nextNb;
      return nextAll;
    });
  }, [activeNbId]);

  const setReferences = useCallback((updater: Reference[] | ((refs: Reference[]) => Reference[])) => {
    setNotebooks(prev => {
      const idx = prev.findIndex(n => n.id === activeNbId);
      if (idx === -1) return prev;
      const nextRefs = typeof updater === 'function' ? updater(prev[idx].references) : updater;
      const nextNb = { ...prev[idx], references: nextRefs, updatedAt: Date.now() };
      saveNotebook(nextNb);
      const nextAll = [...prev]; nextAll[idx] = nextNb;
      return nextAll;
    });
  }, [activeNbId]);

  const setNotebookName = (name: string) => {
    setNotebooks(prev => {
      const idx = prev.findIndex(n => n.id === activeNbId);
      if (idx === -1) return prev;
      const nextNb = { ...prev[idx], name, updatedAt: Date.now() };
      saveNotebook(nextNb);
      const nextAll = [...prev]; nextAll[idx] = nextNb;
      return nextAll;
    });
  };

  const [activeProviderId, setActiveProviderId] = useState(() => getActiveProvider());
  const [activeModelId, setActiveModelId] = useState(() => {
    const pid = getActiveProvider();
    let mid = getActiveModel(pid);
    const provider = PROVIDERS.find(p => p.id === pid);
    if (provider && !provider.models.find(m => m.id === mid)) {
      mid = provider.models[0].id;
      setActiveModel(pid, mid);
    }
    return mid;
  });
  const modelConfig: ModelConfig = { providerId: activeProviderId, modelId: activeModelId };

  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showFloodlight, setShowFloodlight] = useState(false);
  const [showRefViewer, setShowRefViewer] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPrism, setShowPrism] = useState(false);
  const [showShipper, setShowShipper] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [chatWidth, setChatWidth] = useState(320);
  
  const [floodlightPrompt, setFloodlightPrompt] = useState('');
  const [isFloodlightRunning, setIsFloodlightRunning] = useState(false);

  const handleProviderChange = (pid: string) => { 
    setActiveProvider(pid); 
    setActiveProviderId(pid); 
    let mid = getActiveModel(pid); 
    const provider = PROVIDERS.find(p => p.id === pid);
    if (provider && !provider.models.find(m => m.id === mid)) {
      mid = provider.models[0].id;
      setActiveModel(pid, mid);
    }
    setActiveModelId(mid); 
  };
  const handleModelChange = (mid: string) => { setActiveModel(activeProviderId, mid); setActiveModelId(mid); };

  const addCell = useCallback((type: CellType = 'canvas') => {
    const c: CellData = {
      id: mkId(), type, versions: [], currentVersionIndex: -1,
      isEditing: type === 'markdown', isLoading: false,
      markdownContent: '', codeContent: '', language: 'javascript',
      sandboxHtml: '', sandboxCss: '', sandboxJs: '', sandboxAutoRun: true,
    };
    setCells(p => [...p, c]);
    return c.id;
  }, [setCells]);

  const updateCell = useCallback((id: string, u: Partial<CellData>) => { setCells(p => p.map(c => c.id === id ? { ...c, ...u } : c)); }, [setCells]);
  const removeCell = useCallback((id: string) => { setCells(p => p.filter(c => c.id !== id)); }, [setCells]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const file of Array.from(e.target.files || [])) {
      try { const text = await file.text(); setReferences(p => [...p, { id: mkId(), name: file.name, content: text.slice(0, 50000) }]); } catch { /**/ }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeFloodlight = async (promptOverride?: string) => {
    const promptToUse = promptOverride || floodlightPrompt;
    if (!promptToUse.trim() || isFloodlightRunning) return;
    setIsFloodlightRunning(true);
    try {
      const plan = await runFloodlightPlan(promptToUse, activeNb.cells, activeNb.references, modelConfig);
      let newCells = [...activeNb.cells];
      for (const item of plan) {
        const id = mkId();
        const nc: CellData = { id, type: item.type, versions: [], currentVersionIndex: -1, isEditing: false, isLoading: item.type === 'canvas', markdownContent: item.type === 'markdown' ? item.content : '', sandboxHtml: '', sandboxCss: '', sandboxJs: '', sandboxAutoRun: true };
        newCells.push(nc);
        setCells([...newCells]);
        if (item.type === 'sandbox') {
          // Sandbox cells from floodlight get their content as HTML
          const idx = newCells.findIndex(c => c.id === id);
          if (idx > -1) {
            newCells[idx] = { ...newCells[idx], sandboxHtml: item.content };
            setCells([...newCells]);
          }
        } else if (item.type === 'canvas') {
          try {
            const html = await generateVisualCell(item.content, [], newCells, activeNb.references, modelConfig);
            const idx = newCells.findIndex(c => c.id === id);
            if (idx > -1) {
              newCells[idx] = { ...newCells[idx], isLoading: false, versions: [{ prompt: item.content, content: html, timestamp: Date.now() }], currentVersionIndex: 0 };
              setCells([...newCells]);
            }
          } catch (e) {
            const idx = newCells.findIndex(c => c.id === id);
            if (idx > -1) {
              newCells[idx] = { ...newCells[idx], isLoading: false, versions: [{ prompt: item.content, content: '<div class="custom-card red"><div class="custom-card-title">Error</div><p>Failed to generate content</p></div>', timestamp: Date.now() }], currentVersionIndex: 0 };
              setCells([...newCells]);
            }
          }
        }
      }
      setShowFloodlight(false); setFloodlightPrompt('');
    } catch (e: any) { alert(e.message || 'Floodlight failed. See console.'); } finally { setIsFloodlightRunning(false); }
  };

  const handleCreateNotebook = () => {
    const nb = createBlankNotebook('New Notebook');
    saveNotebook(nb);
    setNotebooks(getAllNotebooks());
    setActiveNotebookId(nb.id);
    setActiveNbId(nb.id);
  };

  const handleDeleteNotebook = (id: string) => {
    deleteNotebook(id);
    const updated = getAllNotebooks();
    if (updated.length === 0) {
      const nb = createBlankNotebook('First Notebook');
      saveNotebook(nb);
      updated.push(nb);
    }
    setNotebooks(updated);
    if (activeNbId === id) {
      setActiveNbId(updated[0].id);
      setActiveNotebookId(updated[0].id);
    }
  };

  const handleApplyTemplate = (template: any) => {
    const nb = createBlankNotebook(template.name);
    nb.cells = template.cells.map((c: any) => ({ ...c, id: mkId() }));
    saveNotebook(nb);
    setNotebooks(getAllNotebooks());
    setActiveNotebookId(nb.id);
    setActiveNbId(nb.id);
  };

  const handleExportHtml = () => {
    // Collect styles from the current document
    let styles = '';
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          styles += rule.cssText + '\n';
        }
      } catch (e) {
        // Cross-origin stylesheet, try to load it via href if needed, but tailwind is inline usually
      }
    }
    // Also grab all raw style tags just in case
    document.querySelectorAll('style').forEach(s => { styles += s.innerHTML + '\n'; });

    // Clone the main container to strip UI elements
    const mainEl = document.querySelector('main');
    if (!mainEl) return;
    const clone = mainEl.cloneNode(true) as HTMLElement;
    
    // Remove UI elements like buttons
    clone.querySelectorAll('button').forEach(btn => btn.remove());
    
    // Clean up hover states and edit UI
    clone.querySelectorAll('.opacity-0, .group-hover\\:opacity-100').forEach(el => el.remove());
    
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${activeNb.name} - Visual Notebook</title>
  <!-- VISUAL_NOTEBOOK_EXPORT: Please do not delete this comment or the script tag below if you plan to import this file back into Visual Notebook. -->
  <script id="visual-notebook-state" type="application/json">${JSON.stringify(activeNb)}</script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${styles}
    body { background-color: #0F1115; color: #cbd5e1; font-family: 'Inter', sans-serif; padding: 2rem; }
    .custom-card, .formula-box, .pipe-step, .layer { color: inherit; }
  </style>
</head>
<body class="bg-[#0F1115]">
  <div style="max-width: 64rem; margin: 0 auto;">
    <h1 style="font-size: 2rem; color: #fff; margin-bottom: 2rem; border-bottom: 1px solid #334155; padding-bottom: 1rem;">
      ${activeNb.name}
    </h1>
    ${clone.innerHTML}
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeNb.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportNotebook = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const name = file.name.replace(/\.[^/.]+$/, ""); 

    let cells: CellData[] = [];
    let importedReferences = activeNb.references; // fallback to current refs if not embedded

    if (file.name.endsWith('.html')) {
      const match = text.match(/<script id="visual-notebook-state" type="application\/json">([\s\S]*?)<\/script>/);
      if (match) {
        try {
          const state = JSON.parse(match[1]);
          cells = state.cells.map((c: any) => ({...c, id: mkId()}));
          if (state.references) importedReferences = state.references.map((r: any) => ({...r, id: mkId()}));
        } catch(e) { console.error("Failed to parse embedded state", e); }
      }
      
      if (cells.length === 0) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        doc.querySelectorAll('.custom-card, .pipeline, pre, code').forEach(el => {
           if (el.tagName.toLowerCase() === 'pre' || el.tagName.toLowerCase() === 'code') {
             cells.push({ id: mkId(), type: 'code', codeContent: el.textContent || '', language: 'javascript', versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false });
           } else {
             cells.push({ id: mkId(), type: 'canvas', versions: [{ prompt: 'Imported', content: el.outerHTML, timestamp: Date.now() }], currentVersionIndex: 0, isEditing: false, isLoading: false });
           }
        });
      }
    } else if (file.name.endsWith('.ipynb')) {
      try {
        const ipynb = JSON.parse(text);
        for (const cell of ipynb.cells || []) {
          const content = Array.isArray(cell.source) ? cell.source.join('') : cell.source || '';
          if (cell.cell_type === 'markdown') {
            cells.push({ id: mkId(), type: 'markdown', markdownContent: content, versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false });
          } else if (cell.cell_type === 'code') {
            cells.push({ id: mkId(), type: 'code', codeContent: content, language: 'python', versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false });
          }
        }
      } catch(e) { alert("Failed to parse .ipynb"); }
    } else if (file.name.endsWith('.jl')) {
      const parts = text.split(/# ╔═╡/);
      if (parts.length > 1) {
         parts.slice(1).forEach(p => {
            const lines = p.split('\n');
            const code = lines.slice(1).join('\n').trim();
            if (code) {
               if (code.startsWith('md"')) {
                 cells.push({ id: mkId(), type: 'markdown', markdownContent: code.slice(3, -1), versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false });
               } else {
                 cells.push({ id: mkId(), type: 'code', codeContent: code, language: 'julia', versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false });
               }
            }
         });
      } else {
         cells.push({ id: mkId(), type: 'code', codeContent: text, language: 'julia', versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false });
      }
    } else {
       cells.push({ id: mkId(), type: 'markdown', markdownContent: text, versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false });
    }

    if (cells.length === 0) {
      cells = [{ id: mkId(), type: 'markdown', markdownContent: "Import failed or file empty.", versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false }];
    }

    const nb = createBlankNotebook(name);
    nb.cells = cells;
    nb.references = importedReferences;
    saveNotebook(nb);
    setNotebooks(getAllNotebooks());
    setActiveNotebookId(nb.id);
    setActiveNbId(nb.id);
    
    if (importInputRef.current) importInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <header className="h-14 border-b border-[var(--border)] bg-[var(--bg2)] px-4 flex items-center justify-between sticky top-0 z-50 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[var(--text-dim)] hover:text-[var(--cyan)] transition-colors"><Menu size={18} /></button>
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center"><div className="w-4 h-4 border-2 border-white rotate-45" /></div>
          {editingName
            ? <input ref={nameInputRef} autoFocus value={activeNb.name} onChange={e => setNotebookName(e.target.value)} onBlur={() => setEditingName(false)} onKeyDown={e => { if (e.key === 'Enter') setEditingName(false); }} className="bg-transparent border-b border-[var(--cyan)] outline-none text-white text-sm font-semibold tracking-wide w-48" />
            : <div className="flex items-center gap-4">
                <h1 onClick={() => setEditingName(true)} className="text-sm font-semibold tracking-wide text-white hover:text-[var(--cyan)] cursor-text transition-colors truncate max-w-[200px]" title="Click to rename">{activeNb.name}</h1>
                <div className="flex items-center gap-1 border-l border-[var(--border)] pl-4 ml-2">
                  <button 
                    onClick={() => setCells(cells => cells.map(c => ({ ...c, isCollapsed: true })))}
                    className="text-[10px] font-mono text-[var(--text-dim)] hover:text-white transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5"
                    title="Collapse All"
                  >
                    <Minimize2 size={10} /> COLLAPSE
                  </button>
                  <button 
                    onClick={() => setCells(cells => cells.map(c => ({ ...c, isCollapsed: false })))}
                    className="text-[10px] font-mono text-[var(--text-dim)] hover:text-white transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-white/5"
                    title="Expand All"
                  >
                    <Maximize2 size={10} /> EXPAND
                  </button>
                </div>
              </div>
          }
        </div>
        <div className="flex gap-3 items-center">
          <ModelSelector activeProviderId={activeProviderId} activeModelId={activeModelId} onProviderChange={handleProviderChange} onModelChange={handleModelChange} />
          <div className="w-px h-5 bg-[var(--border)] hidden sm:block" />
          <button onClick={handleExportHtml} className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors" title="Export HTML"><Download size={14} /> Export</button>
          <button onClick={() => setShowPresentation(true)} className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors" title="Presentation Mode"><PlaySquare size={14} /> Present</button>
          <button onClick={() => setShowTerminal(true)} className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-cyan-400/70 hover:text-cyan-300 transition-colors" title="System Terminal"><TerminalIcon size={14} /> TERMINAL</button>
          <button onClick={() => setShowPrism(true)} className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-amber-400/70 hover:text-amber-300 transition-colors" title="PRISM Code Intelligence"><FileCode2 size={14} /> PRISM</button>
          <button onClick={() => setShowShipper(true)} className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-blue-400/70 hover:text-blue-300 transition-colors" title="Shipper Management"><Ship size={14} /> SHIPPER</button>
          <button onClick={() => setShowResearch(true)} className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-amber-400/70 hover:text-amber-300 transition-colors" title="Research Bank"><GraduationCap size={14} /> RESEARCH</button>
          <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"><Upload size={14} /> Refs</button>
          <button onClick={() => setShowChat(!showChat)} className={`flex items-center gap-1.5 text-xs font-mono transition-colors ${showChat ? 'text-[var(--cyan)]' : 'text-slate-400 hover:text-white'}`} title="Agent Chat"><Bot size={14} /> Agent</button>
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors" title="API Key Settings"><Settings size={14} /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <input type="file" ref={importInputRef} onChange={handleImportNotebook} className="hidden" accept=".html,.ipynb,.jl,.txt,.md" />
        <Sidebar notebooks={notebooks} activeId={activeNbId} onSwitch={(id) => { setActiveNbId(id); setActiveNotebookId(id); setNotebooks(getAllNotebooks()); }} onCreate={handleCreateNotebook} onDelete={handleDeleteNotebook} onOpenTemplates={() => setShowTemplates(true)} onImport={() => importInputRef.current?.click()} isOpen={sidebarOpen} />
        <div 
          className="flex-1 flex flex-col transition-all duration-300 overflow-y-auto"
          style={{ 
            marginLeft: sidebarOpen ? '15rem' : '0',
            marginRight: showChat ? `${chatWidth}px` : '0'
          }}
        >
          {activeNb.references.length > 0 && (
            <div className="w-full bg-[var(--bg2)] border-b border-[var(--border)] px-4 py-2 flex flex-wrap gap-2 items-center sticky top-0 z-40">
              <span className="text-xs font-mono text-[var(--text-dim)] uppercase tracking-widest mr-2">Refs:</span>
              {activeNb.references.map(r => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-1 bg-[var(--bg)] border border-[var(--border)] rounded cursor-pointer hover:border-[var(--cyan-dim)] transition-colors group" onClick={() => setShowRefViewer(true)}>
                  <FileText size={11} className="text-slate-300" />
                  <span className="text-xs text-slate-300 font-mono truncate max-w-[150px]">{r.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); setReferences(p => p.filter(x => x.id !== r.id)); }} className="ml-1 text-[var(--text-dim)] hover:text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          )}
          <main className="w-full max-w-4xl mx-auto p-8 relative">
            {activeNb.cells.map(cell => <CellComponent key={cell.id} cell={cell} allCells={activeNb.cells} references={activeNb.references} modelConfig={modelConfig} onUpdate={updateCell} onRemove={removeCell} />)}
            <NewCellButton onAdd={addCell} onFloodlight={() => setShowFloodlight(true)} />
          </main>
        </div>
      </div>

      {showFloodlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg2)] border border-[var(--border)] p-6 rounded shadow-2xl w-full max-w-xl">
            <h2 className="text-xl text-[var(--orange)] flex items-center gap-2 mb-2 font-semibold"><Zap size={20} fill="currentColor" /> Floodlight Kickstart</h2>
            <p className="text-xs text-[var(--text-dim)] mb-5 font-mono">AI autonomously creates a sequence of cells. Using: <span style={{ color: PROVIDERS.find(p => p.id === activeProviderId)?.color }}>{PROVIDERS.find(p => p.id === activeProviderId)?.name}</span></p>
            <textarea value={floodlightPrompt} onChange={e => setFloodlightPrompt(e.target.value)} placeholder="Describe the overarching project or sweeping changes..." className="w-full h-32 bg-[var(--bg)] border border-[var(--border)] rounded p-4 text-white placeholder-[var(--text-dim)] outline-none focus:border-[var(--orange)] transition-colors resize-none mb-5" />
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowFloodlight(false)} disabled={isFloodlightRunning} className="px-4 py-2 rounded text-sm text-[var(--text-dim)] hover:text-white transition-colors">Cancel</button>
              <button onClick={() => executeFloodlight()} disabled={!floodlightPrompt.trim() || isFloodlightRunning} className="px-6 py-2 bg-[var(--orange)] text-orange-950 font-bold rounded hover:bg-orange-400 disabled:opacity-50 transition-colors flex items-center gap-2">{isFloodlightRunning ? <span className="animate-spin text-xl leading-none">⟳</span> : 'Run Floodlight'}</button>
            </div>
          </div>
        </div>
      )}
      {showSettings && <SettingsModal geminiEnvKey={GEMINI_ENV_KEY} onClose={() => setShowSettings(false)} />}
      {showTemplates && <TemplateGallery onSelect={handleApplyTemplate} onClose={() => setShowTemplates(false)} />}
      {showRefViewer && <ReferenceViewer references={activeNb.references} onClose={() => setShowRefViewer(false)} />}
      {showPresentation && <PresentationMode cells={activeNb.cells} onClose={() => setShowPresentation(false)} />}
      <TerminalManager isOpen={showTerminal} onClose={() => setShowTerminal(false)} />
      <PrismAnalyzer modelConfig={modelConfig} isOpen={showPrism} onClose={() => setShowPrism(false)} />
      <Shipper modelConfig={modelConfig} isOpen={showShipper} onClose={() => setShowShipper(false)} />
      <ResearchBank isOpen={showResearch} onClose={() => setShowResearch(false)} />
      <AgentChat
        allCells={activeNb.cells}
        references={activeNb.references}
        modelConfig={modelConfig}
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        width={chatWidth}
        onWidthChange={setChatWidth}
        conversations={activeNb.conversations || []}
        activeConversationId={activeNb.activeConversationId}
        onUpdateConversations={(convs, activeId) => {
          setNotebooks(prev => {
            const idx = prev.findIndex(n => n.id === activeNbId);
            if (idx === -1) return prev;
            const nextNb = { ...prev[idx], conversations: convs, activeConversationId: activeId, updatedAt: Date.now() };
            saveNotebook(nextNb);
            const nextAll = [...prev]; nextAll[idx] = nextNb;
            return nextAll;
          });
        }}
        onAddCell={async (type, content) => {
          const id = addCell(type);
          if (type === 'markdown') {
            updateCell(id, { markdownContent: content, isEditing: false });
          } else if (type === 'code') {
            updateCell(id, { codeContent: content, language: 'javascript' });
          } else if (type === 'sandbox') {
            // For sandbox, content can be raw HTML or a JSON with html/css/js
            try {
              const parsed = JSON.parse(content);
              updateCell(id, { sandboxHtml: parsed.html || '', sandboxCss: parsed.css || '', sandboxJs: parsed.js || '' });
            } catch {
              updateCell(id, { sandboxHtml: content });
            }
          } else {
            // For canvas, content is the prompt - TRIGGER AUTO GENERATION
            updateCell(id, { isLoading: true, versions: [{ prompt: content, content: '', timestamp: Date.now() }], currentVersionIndex: 0 });
            try {
              const html = await generateVisualCell(content, [], activeNb.cells, activeNb.references, modelConfig);
              updateCell(id, { isLoading: false, versions: [{ prompt: content, content: html, timestamp: Date.now() }] });
            } catch (e) {
              updateCell(id, { isLoading: false, versions: [{ prompt: content, content: '<div class="custom-card red"><div class="custom-card-title">Error</div><p>Failed to generate content</p></div>', timestamp: Date.now() }] });
            }
          }
        }}
        onFloodlight={(prompt) => {
          executeFloodlight(prompt);
        }}
      />
    </div>
  );
}
