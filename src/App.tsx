import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, FileText, Settings, Trash2, Zap, PlaySquare, Menu, Bot, Download } from 'lucide-react';
import { CellData, CellType, Reference, NotebookState } from './types';
import { ModelConfig } from './providers/types';
import { generateVisualCell, runFloodlightPlan } from './aiService';
import { PROVIDERS, getActiveProvider, getActiveModel, setActiveProvider, setActiveModel } from './providers/registry';
import { getNotebook, saveNotebook, deleteNotebook, getActiveNotebookId, setActiveNotebookId, createBlankNotebook, migrateOrLoadInitialNotebook, getAllNotebooks } from './notebookStorage';
import ModelSelector from './components/ModelSelector';
import SettingsModal from './components/SettingsModal';
import CellComponent from './components/CellComponent';
import NewCellButton from './components/NewCellButton';
import Sidebar from './components/Sidebar';
import ReferenceViewer from './components/ReferenceViewer';
import TemplateGallery from './components/TemplateGallery';
import PresentationMode from './components/PresentationMode';
import AgentChat from './components/AgentChat';

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
  const [activeModelId, setActiveModelId] = useState(() => getActiveModel(getActiveProvider()));
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
  
  const [floodlightPrompt, setFloodlightPrompt] = useState('');
  const [isFloodlightRunning, setIsFloodlightRunning] = useState(false);

  const handleProviderChange = (pid: string) => { setActiveProvider(pid); setActiveProviderId(pid); const mid = getActiveModel(pid); setActiveModelId(mid); };
  const handleModelChange = (mid: string) => { setActiveModel(activeProviderId, mid); setActiveModelId(mid); };

  const addCell = useCallback((type: CellType = 'canvas') => {
    const c: CellData = { id: mkId(), type, versions: [], currentVersionIndex: -1, isEditing: type === 'markdown', isLoading: false, markdownContent: '', codeContent: '', language: 'javascript' };
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

  const executeFloodlight = async () => {
    if (!floodlightPrompt.trim() || isFloodlightRunning) return;
    setIsFloodlightRunning(true);
    try {
      const plan = await runFloodlightPlan(floodlightPrompt, activeNb.cells, activeNb.references, modelConfig);
      let newCells = [...activeNb.cells];
      for (const item of plan) {
        const id = mkId();
        const nc: CellData = { id, type: item.type, versions: [], currentVersionIndex: -1, isEditing: false, isLoading: item.type === 'canvas', markdownContent: item.type === 'markdown' ? item.content : '' };
        newCells.push(nc);
        setCells([...newCells]);
        if (item.type === 'canvas') {
          const html = await generateVisualCell(item.content, [], newCells, activeNb.references, modelConfig);
          const idx = newCells.findIndex(c => c.id === id);
          if (idx > -1) {
            newCells[idx] = { ...newCells[idx], isLoading: false, versions: [{ prompt: item.content, content: html, timestamp: Date.now() }], currentVersionIndex: 0 };
            setCells([...newCells]);
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

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      <header className="h-14 border-b border-[var(--border)] bg-[var(--bg2)] px-4 flex items-center justify-between sticky top-0 z-50 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[var(--text-dim)] hover:text-[var(--cyan)] transition-colors"><Menu size={18} /></button>
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center"><div className="w-4 h-4 border-2 border-white rotate-45" /></div>
          {editingName
            ? <input ref={nameInputRef} autoFocus value={activeNb.name} onChange={e => setNotebookName(e.target.value)} onBlur={() => setEditingName(false)} onKeyDown={e => { if (e.key === 'Enter') setEditingName(false); }} className="bg-transparent border-b border-[var(--cyan)] outline-none text-white text-sm font-semibold tracking-wide w-48" />
            : <h1 onClick={() => setEditingName(true)} className="text-sm font-semibold tracking-wide text-white hover:text-[var(--cyan)] cursor-text transition-colors truncate max-w-[200px]" title="Click to rename">{activeNb.name}</h1>
          }
        </div>
        <div className="flex gap-3 items-center">
          <ModelSelector activeProviderId={activeProviderId} activeModelId={activeModelId} onProviderChange={handleProviderChange} onModelChange={handleModelChange} />
          <div className="w-px h-5 bg-[var(--border)] hidden sm:block" />
          <button onClick={handleExportHtml} className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors" title="Export HTML"><Download size={14} /> Export</button>
          <button onClick={() => setShowPresentation(true)} className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors" title="Presentation Mode"><PlaySquare size={14} /> Present</button>
          <input type="file" multiple ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"><Upload size={14} /> Refs</button>
          <button onClick={() => setShowChat(!showChat)} className={`flex items-center gap-1.5 text-xs font-mono transition-colors ${showChat ? 'text-[var(--cyan)]' : 'text-slate-400 hover:text-white'}`} title="Agent Chat"><Bot size={14} /> Agent</button>
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors" title="API Key Settings"><Settings size={14} /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar notebooks={notebooks} activeId={activeNbId} onSwitch={(id) => { setActiveNbId(id); setActiveNotebookId(id); }} onCreate={handleCreateNotebook} onDelete={handleDeleteNotebook} onOpenTemplates={() => setShowTemplates(true)} isOpen={sidebarOpen} />
        <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-60' : 'ml-0'} overflow-y-auto`}>
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
              <button onClick={executeFloodlight} disabled={!floodlightPrompt.trim() || isFloodlightRunning} className="px-6 py-2 bg-[var(--orange)] text-orange-950 font-bold rounded hover:bg-orange-400 disabled:opacity-50 transition-colors flex items-center gap-2">{isFloodlightRunning ? <span className="animate-spin text-xl leading-none">⟳</span> : 'Run Floodlight'}</button>
            </div>
          </div>
        </div>
      )}
      {showSettings && <SettingsModal geminiEnvKey={GEMINI_ENV_KEY} onClose={() => setShowSettings(false)} />}
      {showTemplates && <TemplateGallery onSelect={handleApplyTemplate} onClose={() => setShowTemplates(false)} />}
      {showRefViewer && <ReferenceViewer references={activeNb.references} onClose={() => setShowRefViewer(false)} />}
      {showPresentation && <PresentationMode cells={activeNb.cells} onClose={() => setShowPresentation(false)} />}
      <AgentChat
        allCells={activeNb.cells}
        references={activeNb.references}
        modelConfig={modelConfig}
        isOpen={showChat}
        onClose={() => setShowChat(false)}
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
        onAddCell={(type, content) => {
          const id = addCell(type);
          if (type === 'markdown') {
            updateCell(id, { markdownContent: content, isEditing: false });
          } else if (type === 'code') {
            updateCell(id, { codeContent: content, language: 'javascript' }); // Assuming JS by default or parse it if needed
          } else {
            // For canvas, content is the prompt
            updateCell(id, { versions: [{ prompt: content, content: '<div class="custom-card"><div class="custom-card-title">Pending</div><p>Click Run to generate</p></div>', timestamp: Date.now() }], currentVersionIndex: 0 });
          }
        }}
        onFloodlight={(prompt) => {
          setFloodlightPrompt(prompt);
          setShowFloodlight(true);
        }}
      />
    </div>
  );
}
