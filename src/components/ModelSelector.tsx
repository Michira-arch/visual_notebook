import React from 'react';
import { ChevronDown } from 'lucide-react';
import { PROVIDERS } from '../providers/registry';

interface Props {
  activeProviderId: string;
  activeModelId: string;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
}

export default function ModelSelector({ activeProviderId, activeModelId, onProviderChange, onModelChange }: Props) {
  const activeProvider = PROVIDERS.find(p => p.id === activeProviderId) ?? PROVIDERS[0];
  const models = activeProvider.models;

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProviderId = e.target.value;
    onProviderChange(newProviderId);
    // Reset to first model of new provider
    const firstModel = PROVIDERS.find(p => p.id === newProviderId)?.models[0];
    if (firstModel) onModelChange(firstModel.id);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Provider dot */}
      <span
        className="w-2 h-2 rounded-full flex-shrink-0 mr-1"
        style={{ backgroundColor: activeProvider.color }}
        title={activeProvider.name}
      />

      {/* Provider dropdown */}
      <div className="relative">
        <select
          value={activeProviderId}
          onChange={handleProviderChange}
          className="appearance-none bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs font-mono rounded px-2.5 py-1 pr-6 outline-none hover:border-[var(--border2)] focus:border-[var(--cyan)] transition-colors cursor-pointer"
        >
          {PROVIDERS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
      </div>

      {/* Divider */}
      <span className="text-[var(--border2)] text-xs font-mono px-0.5">/</span>

      {/* Model dropdown */}
      <div className="relative">
        <select
          value={activeModelId}
          onChange={e => onModelChange(e.target.value)}
          className="appearance-none bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs font-mono rounded px-2.5 py-1 pr-6 outline-none hover:border-[var(--border2)] focus:border-[var(--cyan)] transition-colors cursor-pointer max-w-[160px]"
        >
          {models.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}{m.tier === 'reasoning' ? ' ✦' : ''}
            </option>
          ))}
        </select>
        <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--text-dim)] pointer-events-none" />
      </div>
    </div>
  );
}
