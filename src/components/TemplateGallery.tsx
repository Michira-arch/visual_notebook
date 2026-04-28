import React, { useState } from 'react';
import { X } from 'lucide-react';
import { TEMPLATES, TemplateDefinition } from '../templates';

interface Props {
  onSelect: (template: TemplateDefinition) => void;
  onClose: () => void;
}

const CATEGORIES = ['All', 'General', 'Engineering', 'ML / AI', 'Product', 'Research'];

export default function TemplateGallery({ onSelect, onClose }: Props) {
  const [filter, setFilter] = useState('All');

  const shown = filter === 'All' ? TEMPLATES : TEMPLATES.filter(t => t.category === filter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div>
            <h2 className="text-white font-semibold text-lg">Template Gallery</h2>
            <p className="text-xs text-[var(--text-dim)] font-mono mt-0.5">Pick a starting point for your notebook</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white transition-colors"><X size={18} /></button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-[var(--border)] flex-shrink-0 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-colors ${filter === cat ? 'bg-[var(--cyan-dim)] text-white' : 'text-[var(--text-dim)] hover:text-white hover:bg-[var(--bg)]'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="overflow-y-auto p-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          {shown.map(template => (
            <button
              key={template.id}
              onClick={() => { onSelect(template); onClose(); }}
              className="group text-left bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--cyan-dim)] hover:shadow-lg hover:shadow-cyan-900/10 transition-all"
            >
              <div className="text-3xl mb-3">{template.icon}</div>
              <div className="font-semibold text-sm text-white group-hover:text-[var(--cyan)] transition-colors mb-1">{template.name}</div>
              <div className="text-xs text-[var(--text-dim)] leading-relaxed">{template.description}</div>
              <div className="mt-3 flex items-center gap-1">
                <span className="text-[10px] font-mono text-[var(--text-dim)] border border-[var(--border)] rounded px-1.5 py-0.5">{template.category}</span>
                <span className="text-[10px] font-mono text-[var(--text-dim)] ml-auto">{template.cells.length} cell{template.cells.length !== 1 ? 's' : ''}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
