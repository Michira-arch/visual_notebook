import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Bot, User, Check, XCircle, Loader2, Plus, MessageSquare, Trash2, ChevronDown } from 'lucide-react';
import { CellData, Reference, CellType, Conversation, ChatMessage } from '../types';
import { ModelConfig } from '../providers/types';
import { generateChatResponse } from '../aiService';
import Markdown from 'react-markdown';

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
}

function mkId() { return Math.random().toString(36).substr(2, 9); }

export default function AgentChat({ allCells, references, modelConfig, isOpen, onClose, onAddCell, onFloodlight, conversations, activeConversationId, onUpdateConversations }: Props) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showConvList, setShowConvList] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Fallback default message
  const defaultMessages: ChatMessage[] = [
    { id: mkId(), role: 'assistant', content: "Hi! I'm your context-aware assistant. I can help brainstorm, answer questions about your references, or even scaffold cells for you." }
  ];

  const activeConv = conversations.find(c => c.id === activeConversationId);
  const messages = activeConv ? activeConv.messages : defaultMessages;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: ChatMessage = { id: mkId(), role: 'user', content: input };
    
    const conv = getOrCreateActiveConv();
    
    // update title if it's the first user message
    let title = conv.title;
    if (conv.messages.length <= 1 && title === 'New Conversation') {
      title = input.slice(0, 30) + (input.length > 30 ? '...' : '');
    }

    const newMessages = [...conv.messages, userMsg];
    
    const updatedConv = { ...conv, title, messages: newMessages, updatedAt: Date.now() };
    const updatedConvs = conversations.map(c => c.id === conv.id ? updatedConv : c);
    if (!conversations.find(c => c.id === conv.id)) updatedConvs.push(updatedConv);
    onUpdateConversations(updatedConvs, updatedConv.id);
    
    setInput('');
    setIsLoading(true);

    try {
      const response = await generateChatResponse(newMessages.map(m => ({ role: m.role, content: m.content })), allCells, references, modelConfig);
      const { text, action } = parseAction(response);
      const assistantMsg: ChatMessage = { id: mkId(), role: 'assistant', content: text, parsedAction: action };
      
      onUpdateConversations(conversations.map(c => c.id === conv.id ? { ...updatedConv, messages: [...newMessages, assistantMsg], updatedAt: Date.now() } : c)
        .concat(conversations.find(c => c.id === conv.id) ? [] : [{...updatedConv, messages: [...newMessages, assistantMsg]}]), updatedConv.id);
    } catch (err: any) {
      const errorMsg: ChatMessage = { id: mkId(), role: 'assistant', content: `**Error:** ${err.message}` };
      onUpdateConversations(conversations.map(c => c.id === conv.id ? { ...updatedConv, messages: [...newMessages, errorMsg], updatedAt: Date.now() } : c)
        .concat(conversations.find(c => c.id === conv.id) ? [] : [{...updatedConv, messages: [...newMessages, errorMsg]}]), updatedConv.id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (msgId: string, accept: boolean) => {
    if (!activeConv) return;
    
    const msgIdx = activeConv.messages.findIndex(m => m.id === msgId);
    if (msgIdx === -1) return;
    const msg = activeConv.messages[msgIdx];
    
    if (!msg.parsedAction || msg.parsedAction.status !== 'pending') return;

    if (accept) {
      const { tool, args } = msg.parsedAction;
      if (tool === 'create_cell') {
        onAddCell(args.type, args.content);
      } else if (tool === 'run_floodlight') {
        onFloodlight(args.prompt);
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

  const [width, setWidth] = useState(320);
  const isResizing = useRef(false);

  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing.current) {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 250 && newWidth < 800) {
        setWidth(newWidth);
      }
    }
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', resize);
    document.removeEventListener('mouseup', stopResizing);
  }, [resize]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed right-0 top-14 h-[calc(100vh-3.5rem)] bg-[var(--bg2)] border-l border-[var(--border)] shadow-2xl flex flex-col z-40 transition-transform duration-300"
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
              <div className="prose prose-invert prose-sm max-w-none">
                <Markdown>{m.content}</Markdown>
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
            className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg py-2 pl-3 pr-10 text-sm text-white placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--cyan)] resize-none h-14"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 p-1.5 text-[var(--cyan)] hover:bg-[var(--cyan)]/20 rounded disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
