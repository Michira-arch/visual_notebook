import React, { useEffect } from 'react';
import { X, Ship } from 'lucide-react';
import { ModelConfig } from '../providers/types';
import { generateText } from '../providers/adapters';

interface Props {
  modelConfig: ModelConfig;
  isOpen: boolean;
  onClose: () => void;
}

export default function Shipper({ modelConfig, isOpen, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'SHIPPER_AI_REQUEST') {
        const iframe = document.getElementById('shipper-iframe') as HTMLIFrameElement;
        try {
          const result = await generateText({
            ...modelConfig,
            systemPrompt: event.data.systemPrompt,
            userPrompt: event.data.userPrompt,
            temperature: 0.3,
          });
          iframe?.contentWindow?.postMessage({
            type: 'SHIPPER_AI_RESPONSE',
            id: event.data.id,
            text: result
          }, '*');
        } catch (error: any) {
          iframe?.contentWindow?.postMessage({
            type: 'SHIPPER_AI_RESPONSE',
            id: event.data.id,
            error: error.message
          }, '*');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, modelConfig]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#07090e' }}>
      {/* ─── HEADER ─── */}
      <header className="h-14 flex items-center justify-between px-5 border-b border-white/[0.07] flex-shrink-0" style={{ background: '#0d1118' }}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-500 rounded-md flex items-center justify-center text-white">
            <Ship size={16} />
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-[3px] text-white uppercase">SHIPPER</div>
            <div className="text-[10px] text-slate-500 tracking-wide">The Deliverable-Focused Manager</div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X size={16} />
        </button>
      </header>

      {/* ─── IFRAME ─── */}
      <div className="flex-1 relative bg-white">
        <iframe
          id="shipper-iframe"
          src="/shipper1.html"
          className="absolute inset-0 w-full h-full border-none"
          title="Shipper App"
        />
      </div>
    </div>
  );
}
