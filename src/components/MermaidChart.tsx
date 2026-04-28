import React, { useRef, useEffect } from 'react';
import mermaid from 'mermaid';

export default function MermaidChart({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
    mermaid.render(id, chart)
      .then(({ svg }) => { if (ref.current) ref.current.innerHTML = svg; })
      .catch(e => { if (ref.current) ref.current.innerHTML = `<pre class="text-red-500 font-mono text-xs">${e.message}</pre>`; });
  }, [chart]);
  
  return <div ref={ref} className="mermaid-container flex justify-center py-4" />;
}
