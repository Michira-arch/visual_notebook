import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Bot, User, Check, XCircle, Loader2, Plus, MessageSquare, Trash2, ChevronDown, Image as ImageIcon, Camera } from 'lucide-react';
import { CellData, Reference, CellType, Conversation, ChatMessage } from '../types';
import { ModelConfig } from '../providers/types';
import { generateChatResponse } from '../aiService';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { toPng } from 'html-to-image';
import { wsUrl } from '../serverClient';

interface Props {
  allCells: CellData[];
  references: Reference[];
  modelConfig: ModelConfig;
  isOpen: boolean;
  onClose: () => void;
  onAddCell: (type: CellType, content: string) => void;
  onFloodlight: (prompt: string) => void;
  conversations: Conversation[];
  activeConversationId?: string;
  onUpdateConversations: (conversations: Conversation[], activeId?: string) => void;
  width: number;
  onWidthChange: (width: number) => void;
}

function mkId() { return Math.random().toString(36).substr(2, 9); }

export default React.memo(function AgentChat({ allCells, references, modelConfig, isOpen, onClose, onAddCell, onFloodlight, conversations, activeConversationId, onUpdateConversations, width, onWidthChange }: Props) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConvList, setShowConvList] = useState(false);
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const persistentWsRef = useRef<WebSocket | null>(null);

  // Fallback default message
  const defaultMessages: ChatMessage[] = [
    { id: mkId(), role: 'assistant', content: "Hi! I'm your context-aware assistant. I can help brainstorm, answer questions about your references, or even scaffold cells for you." }
  ];

  const activeConv = conversations.find(c => c.id === activeConversationId);
  const messages = activeConv ? activeConv.messages : defaultMessages;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Persistent WebSocket for incoming WhatsApp messages + outgoing sends
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      ws = new WebSocket(wsUrl());
      ws.onopen = () => {
        persistentWsRef.current = ws;
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'whatsapp_message') {
            const displayName = data.name && data.name !== 'Unknown' ? data.name : data.number;
            const incomingText = `[WhatsApp from ${displayName} (${data.number})]: ${data.data}`;
            window.dispatchEvent(new CustomEvent('incoming_whatsapp', { detail: incomingText }));
          }
        } catch (e) {}
      };
      ws.onclose = () => {
        persistentWsRef.current = null;
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      persistentWsRef.current = null;
      if (ws) ws.close();
    };
  }, []);

  // Listen to the custom event for incoming messages to trigger handleSend
  const handleSendRef = useRef<any>(null);
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  useEffect(() => {
    const listener = (e: any) => {
      const msg = e.detail;
      handleSendRef.current(msg);
    };
    window.addEventListener('incoming_whatsapp', listener);
    return () => window.removeEventListener('incoming_whatsapp', listener);
  }, []);

  // Ensure there's an active conversation if user starts typing and none exists
  const getOrCreateActiveConv = (): Conversation => {
    if (activeConv) return activeConv;
    const newConv: Conversation = {
      id: mkId(),
      title: 'New Conversation',
      messages: defaultMessages,
      updatedAt: Date.now()
    };
    onUpdateConversations([...conversations, newConv], newConv.id);
    return newConv;
  };

  const handleNewChat = () => {
    const newConv: Conversation = {
      id: mkId(),
      title: 'New Conversation',
      messages: defaultMessages,
      updatedAt: Date.now()
    };
    onUpdateConversations([...conversations, newConv], newConv.id);
    setShowConvList(false);
    setAttachedImages([]);
  };

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = conversations.filter(c => c.id !== id);
    let nextActiveId = activeConversationId;
    if (activeConversationId === id) {
      nextActiveId = filtered.length > 0 ? filtered[0].id : undefined;
    }
    onUpdateConversations(filtered, nextActiveId);
  };

  const parseAction = (content: string) => {
    const match = content.match(/<action>([\s\S]*?)<\/action>/);
    if (!match) return { text: content, action: undefined };
    
    try {
      const json = JSON.parse(match[1]);
      const tool = json.tool || 'unknown_tool';
      const args = json.args || json;
      const text = content.replace(match[0], '').trim();
      return { text, action: { tool, args, status: 'pending' as const } };
    } catch (e) {
      return { text: content, action: undefined };
    }
  };

  const handleSend = async (overrideInput?: string, overrideImages?: string[]) => {
    const messageContent = overrideInput || input;
    const messageImages = overrideImages || attachedImages;

    if (!messageContent.trim() && messageImages.length === 0) return;
    if (isLoading) return;

    const userMsg: ChatMessage = { 
      id: mkId(), 
      role: 'user', 
      content: messageContent,
      images: messageImages.length > 0 ? messageImages : undefined 
    };
    
    const conv = getOrCreateActiveConv();
    
    // update title if it's the first user message
    let title = conv.title;
    if (conv.messages.length <= 1 && title === 'New Conversation') {
      title = messageContent.slice(0, 30) + (messageContent.length > 30 ? '...' : '');
      if (!title && messageImages.length > 0) title = "Image Attachment";
    }

    const newMessages = [...conv.messages, userMsg];
    
    const updatedConv = { ...conv, title, messages: newMessages, updatedAt: Date.now() };
    const updatedConvs = conversations.map(c => c.id === conv.id ? updatedConv : c);
    if (!conversations.find(c => c.id === conv.id)) updatedConvs.push(updatedConv);
    onUpdateConversations(updatedConvs, updatedConv.id);
    
    setInput('');
    setAttachedImages([]);
    setIsLoading(true);

    try {
      let currentMessages = [...newMessages];
      let currentConv = updatedConv;

      let keepGoing = true;
      let loopCount = 0;

      while (keepGoing && loopCount < 3) {
        loopCount++;
        setIsLoading(true);
        const response = await generateChatResponse(
          currentMessages.map(m => ({ role: m.role, content: m.content })), 
          allCells, 
          references, 
          modelConfig,
          loopCount === 1 ? messageImages : undefined
        );
        
        const { text, action } = parseAction(response);
        
        if (action) {
          if (action.tool === 'run_terminal_command') {
            const assistantMsg: ChatMessage = { id: mkId(), role: 'assistant', content: text, parsedAction: action };
            currentMessages = [...currentMessages, assistantMsg];
            currentConv = { ...currentConv, messages: currentMessages, updatedAt: Date.now() };
            onUpdateConversations(conversations.map(c => c.id === currentConv.id ? currentConv : c)
              .concat(conversations.find(c => c.id === currentConv.id) ? [] : [currentConv]), currentConv.id);
            keepGoing = false;
          } else {
            // Auto-execute the action
            const acceptedAction = { ...action, status: 'accepted' as const };
            const assistantMsg: ChatMessage = { id: mkId(), role: 'assistant', content: text, parsedAction: acceptedAction };
            currentMessages = [...currentMessages, assistantMsg];
            currentConv = { ...currentConv, messages: currentMessages, updatedAt: Date.now() };
            onUpdateConversations(conversations.map(c => c.id === currentConv.id ? currentConv : c)
              .concat(conversations.find(c => c.id === currentConv.id) ? [] : [currentConv]), currentConv.id);
  
            const { tool, args } = action;
          
          if (tool === 'sandbox_execute') {
            let resultStr = '';
            if (args.language === 'mermaid') {
              try {
                const mermaid = (await import('mermaid')).default;
                const isValid = await mermaid.parse(args.code);
                resultStr = isValid ? 'Mermaid syntax is valid.' : 'Mermaid syntax parsed but returned false.';
              } catch(e: any) {
                resultStr = 'Mermaid Syntax Error: ' + e.message;
              }
            } else if (args.language === 'javascript') {
              try {
                const result = new Function(args.code)();
                resultStr = 'JavaScript executed successfully. Result: ' + (result !== undefined ? JSON.stringify(result) : 'undefined');
              } catch(e: any) {
                resultStr = 'JavaScript Error: ' + e.toString();
              }
            } else {
              resultStr = 'Unsupported language: ' + args.language;
            }
            
            const resultMsg: ChatMessage = { id: mkId(), role: 'user', content: `[Sandbox Execution Result]\n\`\`\`text\n${resultStr}\n\`\`\`` };
            currentMessages = [...currentMessages, resultMsg];
            currentConv = { ...currentConv, messages: currentMessages, updatedAt: Date.now() };
            onUpdateConversations(conversations.map(c => c.id === currentConv.id ? currentConv : c)
              .concat(conversations.find(c => c.id === currentConv.id) ? [] : [currentConv]), currentConv.id);
            // Loop continues
          } else {
            // Other actions (create_cell, run_floodlight, take_screenshot)
            if (tool === 'create_cell') {
              onAddCell(args.type, args.content);
            } else if (tool === 'run_floodlight') {
              onFloodlight(args.prompt);
            } else if (tool === 'take_screenshot') {
              setTimeout(async () => {
                const mainEl = document.querySelector('main');
                if (mainEl) {
                  try {
                    const dataUrl = await toPng(mainEl, { backgroundColor: '#0F1115' });
                    handleSend("Here is the screenshot you requested.", [dataUrl]);
                  } catch (e) {
                    console.error("Screenshot failed", e);
                  }
                }
              }, 500);
            } else if (tool === 'send_whatsapp_message') {
              const pws = persistentWsRef.current;
              if (pws && pws.readyState === WebSocket.OPEN) {
                pws.send(JSON.stringify({ type: 'send_whatsapp_message', message: args.message, number: args.number }));
              } else {
                console.error("Failed to send WhatsApp message: persistent WS not connected");
              }
            }
            }
            keepGoing = false;
          }
        } else {
          // No action, just text
          const assistantMsg: ChatMessage = { id: mkId(), role: 'assistant', content: text };
          currentMessages = [...currentMessages, assistantMsg];
          currentConv = { ...currentConv, messages: currentMessages, updatedAt: Date.now() };
          onUpdateConversations(conversations.map(c => c.id === currentConv.id ? currentConv : c)
            .concat(conversations.find(c => c.id === currentConv.id) ? [] : [currentConv]), currentConv.id);
          keepGoing = false;
        }
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = { id: mkId(), role: 'assistant', content: `**Error:** ${err.message}` };
      const updatedMessages = activeConv ? [...activeConv.messages, errorMsg] : [...newMessages, errorMsg];
      onUpdateConversations(conversations.map(c => c.id === conv.id ? { ...updatedConv, messages: updatedMessages, updatedAt: Date.now() } : c)
        .concat(conversations.find(c => c.id === conv.id) ? [] : [{...updatedConv, messages: updatedMessages}]), updatedConv.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (msgId: string, accept: boolean) => {
    if (!activeConv) return;
    
    const msgIdx = activeConv.messages.findIndex(m => m.id === msgId);
    if (msgIdx === -1) return;
    const msg = activeConv.messages[msgIdx];
    
    if (!msg.parsedAction || msg.parsedAction.status !== 'pending') return;

    if (accept) {
      const { tool, args } = msg.parsedAction;
      if (tool === 'run_terminal_command') {
        try {
          const ws = new WebSocket(wsUrl());
          ws.onopen = () => {
            const reqId = mkId();
            ws.send(JSON.stringify({ type: 'agent_execute', command: args.command, id: reqId }));
          };
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'agent_result') {
                ws.close();
                handleSend(`[Terminal Execution Result]\n\`\`\`text\n${data.output}\n\`\`\``);
              }
            } catch(e) {}
          };
          ws.onerror = () => {
            handleSend(`[Terminal Error]\nCould not connect to WebSocket server. Is it running?`);
          };
        } catch(e: any) {
          handleSend(`[Terminal Error]\n${e.message}`);
        }
      } else if (tool === 'create_cell') {
        onAddCell(args.type, args.content);
      } else if (tool === 'run_floodlight') {
        onFloodlight(args.prompt);
      } else if (tool === 'take_screenshot') {
        const mainEl = document.querySelector('main');
        if (mainEl) {
          try {
            const dataUrl = await toPng(mainEl, { backgroundColor: '#0F1115' });
            // After taking screenshot, we auto-send it back to the agent
            setTimeout(() => {
              handleSend("Here is the screenshot you requested.", [dataUrl]);
            }, 500);
          } catch (e) {
            console.error("Screenshot failed", e);
          }
        }
      } else if (tool === 'send_whatsapp_message') {
        const pws = persistentWsRef.current;
        if (pws && pws.readyState === WebSocket.OPEN) {
          pws.send(JSON.stringify({ type: 'send_whatsapp_message', message: args.message, number: args.number }));
        } else {
          console.error("Failed to send WhatsApp message: persistent WS not connected");
        }
      }
    }

    const updatedMessages = [...activeConv.messages];
    updatedMessages[msgIdx] = {
      ...msg,
      parsedAction: { ...msg.parsedAction!, status: accept ? 'accepted' : 'rejected' }
    };
    
    const updatedConv = { ...activeConv, messages: updatedMessages, updatedAt: Date.now() };
    onUpdateConversations(conversations.map(c => c.id === activeConv.id ? updatedConv : c), activeConv.id);
  };

  const isResizing = useRef(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
  }, [onWidthChange]);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing.current) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 800) {
        onWidthChange(newWidth);
      }
    }
  }, [onWidthChange]);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResizing);
  }, [resize]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed right-0 top-14 h-[calc(100vh-3.5rem)] bg-[var(--bg2)] border-l border-[var(--border)] shadow-2xl flex flex-col z-40 transition-all duration-300"
      style={{ width: `${width}px` }}
    >
      <div 
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--cyan)] transition-colors z-50"
        onMouseDown={startResizing}
      />
      
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0 relative">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setShowConvList(!showConvList)}>
          <Bot size={16} className="text-[var(--cyan)]" />
          <span className="font-mono text-sm font-semibold tracking-wide text-white truncate max-w-[150px] group-hover:text-[var(--cyan)] transition-colors">
            {activeConv ? activeConv.title : 'Agent Chat'}
          </span>
          <ChevronDown size={14} className="text-[var(--text-dim)] group-hover:text-[var(--cyan)]" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleNewChat} className="text-[var(--text-dim)] hover:text-[var(--cyan)] transition-colors" title="New Chat"><Plus size={16} /></button>
          <button onClick={onClose} className="text-[var(--text-dim)] hover:text-white transition-colors" title="Close"><X size={16} /></button>
        </div>
        
        {/* Conversations Dropdown */}
        {showConvList && (
          <div className="absolute top-full left-0 right-0 bg-[var(--bg)] border-b border-[var(--border)] shadow-xl z-50 max-h-60 overflow-y-auto">
            {conversations.length === 0 && <div className="p-3 text-xs text-[var(--text-dim)] font-mono text-center">No previous chats</div>}
            {[...conversations].sort((a, b) => b.updatedAt - a.updatedAt).map(c => (
              <div 
                key={c.id} 
                onClick={() => { onUpdateConversations(conversations, c.id); setShowConvList(false); }}
                className={`flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-[var(--bg2)] border-b border-[var(--border)] last:border-0 ${c.id === activeConversationId ? 'bg-[var(--bg2)]' : ''}`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare size={12} className={c.id === activeConversationId ? 'text-[var(--cyan)]' : 'text-[var(--text-dim)]'} />
                  <span className={`text-xs font-mono truncate ${c.id === activeConversationId ? 'text-[var(--cyan)]' : 'text-[var(--text)]'}`}>{c.title}</span>
                </div>
                <button onClick={(e) => handleDeleteChat(c.id, e)} className="text-[var(--text-dim)] hover:text-[var(--red)] opacity-50 hover:opacity-100 transition-all"><Trash2 size={12}/></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[90%] p-3 rounded-lg text-sm ${m.role === 'user' ? 'bg-[var(--cyan-dim)]/20 border border-[var(--cyan-dim)]/30 text-white' : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]'}`}>
              <div className="flex items-center gap-2 mb-1 opacity-50">
                {m.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                <span className="text-[10px] font-mono uppercase">{m.role}</span>
              </div>
              
              {m.images && m.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {m.images.map((img, i) => (
                    <img key={i} src={img} alt="attachment" className="max-w-full rounded border border-[var(--border)] shadow-sm" style={{ maxHeight: '200px' }} />
                  ))}
                </div>
              )}

              <div className="markdown-body text-sm max-w-none">
                <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{m.content}</Markdown>
              </div>
            </div>

            {m.parsedAction && (
              <div className="w-[90%] mt-1 bg-[var(--bg)] border border-[var(--orange)]/30 rounded p-3 self-start shadow-lg">
                <div className="text-xs font-mono text-[var(--orange)] mb-2 flex items-center gap-1">
                  <Bot size={12} /> Action Request: {m.parsedAction.tool}
                </div>
                <div className="text-xs font-mono text-white bg-black/30 p-2 rounded mb-3 break-all">
                  {JSON.stringify(m.parsedAction.args, null, 2)}
                </div>
                {m.parsedAction.status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleAction(m.id, true)} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[var(--green)]/20 text-[var(--green)] hover:bg-[var(--green)]/40 rounded transition-colors text-xs font-semibold">
                      <Check size={14} /> Accept
                    </button>
                    <button onClick={() => handleAction(m.id, false)} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[var(--red)]/20 text-[var(--red)] hover:bg-[var(--red)]/40 rounded transition-colors text-xs font-semibold">
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                ) : (
                  <div className={`text-xs font-mono text-center py-1 rounded ${m.parsedAction.status === 'accepted' ? 'text-[var(--green)] bg-[var(--green)]/10' : 'text-[var(--red)] bg-[var(--red)]/10'}`}>
                    {m.parsedAction.status.toUpperCase()}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-[var(--text-dim)] text-xs font-mono self-start p-3">
            <Loader2 size={14} className="animate-spin" /> Thinking...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {attachedImages.length > 0 && (
        <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg)] flex gap-2 overflow-x-auto">
          {attachedImages.map((img, i) => (
            <div key={i} className="relative flex-shrink-0">
              <img src={img} className="w-12 h-12 object-cover rounded border border-[var(--cyan)]" />
              <button onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-[var(--red)] text-white rounded-full p-0.5"><X size={10} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 border-t border-[var(--border)] bg-[var(--bg2)] flex-shrink-0" onClick={() => setShowConvList(false)}>
        <div className="relative">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask or command the agent..."
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg py-2 pl-3 pr-20 text-sm text-white placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--cyan)] resize-none h-14"
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" multiple />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-[var(--text-dim)] hover:text-[var(--cyan)] hover:bg-[var(--cyan)]/20 rounded transition-colors"
              title="Attach Images"
            >
              <ImageIcon size={16} />
            </button>
            <button
              onClick={async () => {
                const mainEl = document.querySelector('main');
                if (mainEl) {
                  const dataUrl = await toPng(mainEl, { backgroundColor: '#0F1115' });
                  setAttachedImages(prev => [...prev, dataUrl]);
                }
              }}
              className="p-1.5 text-[var(--text-dim)] hover:text-[var(--cyan)] hover:bg-[var(--cyan)]/20 rounded transition-colors"
              title="Take Screenshot"
            >
              <Camera size={16} />
            </button>
            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && attachedImages.length === 0) || isLoading}
              className="p-1.5 text-[var(--cyan)] hover:bg-[var(--cyan)]/20 rounded disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
