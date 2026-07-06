import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { wsUrl, goTermdWsUrl } from '../serverClient';

interface Props {
  isActive: boolean;
  wsEndpoint?: 'python' | 'go'; // default: 'python'
  onClose?: () => void;
}

export interface SingleTerminalRef {
  fit: () => void;
}

export const SingleTerminal = forwardRef<SingleTerminalRef, Props>(({ isActive, wsEndpoint = 'go' }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useImperativeHandle(ref, () => ({
    fit: () => {
      if (fitAddonRef.current && isActive) {
        fitAddonRef.current.fit();
        // Send resize to server (Go PTY handles this)
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'resize',
            cols: dims.cols,
            rows: dims.rows,
          }));
        }
      }
    }
  }));

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: { background: '#0F1115', foreground: '#cbd5e1', cursor: '#06b6d4' },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
      cursorBlink: true,
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    termInstance.current = term;
    fitAddonRef.current = fitAddon;

    if (isActive) {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
      }
    }

    const url = wsEndpoint === 'python' ? wsUrl() : goTermdWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    const label = wsEndpoint === 'python' ? 'Python Terminal (Deprecated)' : 'Go PTY Terminal';
    ws.onopen = () => {
      term.writeln(`\x1b[36mConnected to ${label}\x1b[0m`);
      // Send initial size to Go PTY
      if (wsEndpoint !== 'python') {
        setTimeout(() => {
          if (isActive && fitAddonRef.current) {
            fitAddonRef.current.fit();
            const dims = fitAddonRef.current.proposeDimensions();
            if (dims) {
              ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
            }
          }
        }, 100);
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'output') {
          let text = data.data;
          if (text.includes('\n') && !text.includes('\r\n')) text = text.replace(/\n/g, '\r\n');
          term.write(text);
        } else if (data.type === 'exit') {
          term.writeln('\r\n\x1b[33mProcess exited.\x1b[0m');
        }
      } catch (e) {}
    };

    ws.onclose = () => term.writeln('\x1b[31m\r\nConnection lost.\x1b[0m');
    ws.onerror = () => term.writeln('\x1b[31m\r\nConnection error — is the server running?\x1b[0m');
    
    term.onData(data => {
      if (ws.readyState === WebSocket.OPEN) {
        let inputData = data;
        if (data === '\r') {
          inputData = '\r\n';
        } else if (data === '\x7f') {
          inputData = '\x08';
        }
        ws.send(JSON.stringify({ type: 'input', data: inputData }));
      }
    });

    const handleResize = () => {
      if (isActive) {
        fitAddon.fit();
        const dims = fitAddon.proposeDimensions();
        if (dims && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
        }
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'terminate' }));
      }
      ws.close();
      term.dispose();
    };
  }, [wsEndpoint]);

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
