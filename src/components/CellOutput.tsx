import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Clock, Cpu, Server, Globe, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import { ExecutionResult } from '../types';

interface Props {
  result?: ExecutionResult;
  isExecuting?: boolean;
}

export default function CellOutput({ result, isExecuting }: Props) {
  const [showVars, setShowVars] = useState(true);

  if (isExecuting) {
    return (
      <div className="px-4 py-3 bg-[var(--bg2)] border-t border-[var(--border)] flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--cyan)] animate-ping opacity-75" />
        <span className="font-mono text-xs text-[var(--cyan)] animate-pulse">Running cell execution...</span>
      </div>
    );
  }

  if (!result) return null;

  const isSuccess = result.status === 'success';
  const hasOutputs = Object.keys(result.outputs || {}).length > 0;

  // Tier Badge
  const renderTierIcon = () => {
    switch (result.tier) {
      case 'browser':
        return <Cpu size={12} className="text-[var(--purple)]" />;
      case 'local':
        return <Server size={12} className="text-[var(--cyan)]" />;
      case 'remote':
        return <Globe size={12} className="text-[var(--orange)]" />;
    }
  };

  const getTierLabel = () => {
    switch (result.tier) {
      case 'browser':
        return 'Browser (WASM/Native)';
      case 'local':
        return 'Local Compiler';
      case 'remote':
        return 'Remote Playground API';
    }
  };

  return (
    <div className="border-t border-[var(--border)] bg-black/10 font-mono text-[11px] leading-relaxed">
      {/* Header Summary */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]/50 bg-[var(--bg2)]/60 text-[var(--text-dim)]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            {isSuccess ? (
              <CheckCircle size={12} className="text-[var(--green)]" />
            ) : (
              <AlertCircle size={12} className="text-[var(--red)]" />
            )}
            <span className={isSuccess ? 'text-[var(--green)]/80' : 'text-[var(--red)]/80'}>
              {result.status.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-1.5" title="Execution Method">
            {renderTierIcon()}
            <span>{getTierLabel()}</span>
          </div>

          <div className="flex items-center gap-1">
            <Clock size={12} />
            <span>{result.duration}ms</span>
          </div>
        </div>

        {result.exitCode !== 0 && (
          <span className="text-[var(--red)] opacity-85">Exit Code {result.exitCode}</span>
        )}
      </div>

      {/* Stdout Output */}
      {result.stdout && (
        <div className="px-4 py-3 border-b border-[var(--border)]/30 max-h-60 overflow-y-auto">
          <div className="text-[var(--text-dim)] text-[9px] uppercase tracking-wider mb-1 select-none">stdout</div>
          <pre className="text-[var(--text)] whitespace-pre-wrap font-mono">{result.stdout}</pre>
        </div>
      )}

      {/* Stderr Output */}
      {result.stderr && (
        <div className="px-4 py-3 bg-[var(--red)]/5 border-b border-[var(--border)]/30 max-h-60 overflow-y-auto">
          <div className="text-[var(--red)]/70 text-[9px] uppercase tracking-wider mb-1 select-none">stderr</div>
          <pre className="text-[var(--red)]/90 whitespace-pre-wrap font-mono font-medium">{result.stderr}</pre>
        </div>
      )}

      {/* Data Registry Updates (Vars set) */}
      {hasOutputs && (
        <div className="px-4 py-2 bg-[var(--bg2)]/20">
          <button
            onClick={() => setShowVars(!showVars)}
            className="flex items-center gap-1 text-[var(--purple)] hover:text-white transition-colors cursor-pointer select-none text-[9px] uppercase tracking-wider font-semibold py-1"
          >
            {showVars ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <span>Exported variables ({Object.keys(result.outputs).length})</span>
          </button>
          
          {showVars && (
            <div className="mt-1.5 pb-2 grid grid-cols-1 gap-1">
              {Object.entries(result.outputs).map(([key, val]) => {
                const valType = typeof val;
                const formattedVal = valType === 'object' ? JSON.stringify(val) : String(val);
                return (
                  <div key={key} className="flex items-start gap-2 py-0.5 px-2 hover:bg-[var(--border)]/30 rounded border border-transparent hover:border-[var(--border)]/50 transition-colors">
                    <span className="text-[var(--cyan)] font-semibold select-all">{key}</span>
                    <span className="text-[var(--text-dim)] select-none">:</span>
                    <span className="text-[var(--text-dim)] text-[9px] italic select-none">({valType})</span>
                    <span className="text-white/90 truncate flex-1 max-w-[600px] select-all font-mono">
                      {formattedVal.length > 120 ? formattedVal.slice(0, 120) + '...' : formattedVal}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
