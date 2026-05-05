import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface Props {
  isActive: boolean;
  onClose?: () => void;
}

export interface SingleTerminalRef {
  fit: () => void;
}

export const SingleTerminal = forwardRef<SingleTerminalRef, Props>(({ isActive }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useImperativeHandle(ref, () => ({
    fit: () => {
      if (fitAddonRef.current && isActive) {
        fitAddonRef.current.fit();
      }
    }
  }));

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: { background: '#0F1115', foreground: '#cbd5e1', cursor: '#06b6d4' },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    termInstance.current = term;
    fitAddonRef.current = fitAddon;

    if (isActive) fitAddon.fit();

    const ws = new WebSocket('ws://localhost:8765');
    wsRef.current = ws;

    ws.onopen = () => term.writeln('\x1b[36mConnected to Python Terminal Server\x1b[0m');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'output') {
          let text = data.data;
          if (text.includes('\n') && !text.includes('\r\n')) text = text.replace(/\n/g, '\r\n');
          term.write(text);
        }
      } catch (e) {}
    };
    ws.onclose = () => term.writeln('\x1b[31m\r\nConnection lost.\x1b[0m');
    
    term.onData(data => {
      if (ws.readyState === WebSocket.OPEN) {
        // xterm sends \r on Enter. Powershell over a pipe needs \r\n to echo a newline properly
        // so it doesn't overwrite the same line.
        let inputData = data;
        if (data === '\r') {
          inputData = '\r\n';
        }
        ws.send(JSON.stringify({ type: 'input', data: inputData }));
      }
    });

    const handleResize = () => {
      if (isActive) fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, []);

  // When isActive changes to true, we might need a tick to layout before fitting
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 50);
    }
  }, [isActive]);

  return (
    <div 
      className="absolute inset-0 bg-[#0F1115] p-2" 
      style={{ 
        display: isActive ? 'block' : 'none',
        visibility: isActive ? 'visible' : 'hidden' 
      }}
    >
      <div ref={terminalRef} className="absolute inset-2 overflow-hidden" />
    </div>
  );
});
