import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { PROVIDERS } from '../providers/registry';
import { getProviderConfigs, setProviderConfigs } from '../providers/registry';

interface Props {
  onClose: () => void;
  geminiEnvKey: string; // injected from env at build time
}

export default function SettingsModal({ onClose, geminiEnvKey }: Props) {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = getProviderConfigs();
    // Pre-populate Gemini with env key if not already set
    if (!stored['gemini'] && geminiEnvKey) stored['gemini'] = geminiEnvKey;
    setConfigs(stored);
  }, [geminiEnvKey]);

  const handleSave = () => {
    setProviderConfigs(configs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleVisible = (id: string) =>
    setVisible(v => ({ ...v, [id]: !v[id] }));

  const setKey = (id: string, val: string) =>
    setConfigs(c => ({ ...c, [id]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--bg2)] border border-[var(--border)] rounded-lg shadow-2xl w-full max-w-lg p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-lg tracking-tight">API Keys</h2>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[var(--text-dim)] mb-6 font-mono">
          Keys are stored locally in your browser. They are never sent to any server other than the provider's own API.
        </p>

        <div className="space-y-4">
          {PROVIDERS.map(provider => {
            const key = configs[provider.id] || '';
            const isEnvKey = provider.id === 'gemini' && !!geminiEnvKey && key === geminiEnvKey;
            const hasKey = !!key;

            return (
              <div key={provider.id} className="flex items-center gap-3">
                {/* Provider badge */}
                <div
                  className="w-24 flex-shrink-0 flex items-center gap-1.5"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: provider.color }}
                  />
                  <span className="text-xs font-mono text-[var(--text)]">{provider.name}</span>
                </div>

                {/* Input */}
                <div className="relative flex-1">
                  <input
                    type={visible[provider.id] ? 'text' : 'password'}
                    value={key}
                    onChange={e => setKey(provider.id, e.target.value)}
                    placeholder={isEnvKey ? 'Auto-configured via env' : `Enter ${provider.name} API key`}
                    readOnly={isEnvKey}
                    className={`w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-1.5 text-xs font-mono text-[var(--text)] outline-none focus:border-[var(--cyan)] transition-colors pr-8 ${isEnvKey ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  {!isEnvKey && (
                    <button
                      type="button"
                      onClick={() => toggleVisible(provider.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-white"
                    >
                      {visible[provider.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  )}
                </div>

                {/* Status icon */}
                {hasKey
                  ? <CheckCircle size={14} className="flex-shrink-0" style={{ color: provider.color }} />
                  : <AlertCircle size={14} className="flex-shrink-0 text-[var(--text-dim)]" />
                }
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--text-dim)] hover:text-[var(--cyan)] transition-colors font-mono"
          >
            Where to get keys?
          </a>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded font-semibold text-sm transition-colors"
            style={{ backgroundColor: saved ? '#22c55e' : '#0891b2', color: 'white' }}
          >
            {saved ? '✓ Saved' : 'Save Keys'}
          </button>
        </div>
      </div>
    </div>
  );
}
