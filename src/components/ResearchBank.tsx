import React, { useState, useEffect } from 'react';
import {
  X, Search, Plus, Trash2, Edit3, Save, ArrowLeft,
  GraduationCap, Library, Hash, User, Link as LinkIcon,
  FileText, Upload, Eye, Code2, BookOpen, Calendar,
  ChevronRight, Sparkles, AlignLeft
} from 'lucide-react';
import { ResearchArticle } from '../types';
import { getAllResearches, saveResearch, deleteResearch, createBlankResearch } from '../researchStorage';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import MermaidChart from './MermaidChart';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

type EditorTab = 'write' | 'preview';

export default function ResearchBank({ isOpen, onClose }: Props) {
  const [articles, setArticles] = useState<ResearchArticle[]>([]);
  const [search, setSearch] = useState('');
  const [editingArticle, setEditingArticle] = useState<ResearchArticle | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'edit'>('list');
  const [editorTab, setEditorTab] = useState<EditorTab>('write');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) setArticles(getAllResearches());
  }, [isOpen]);

  // Collect all unique tags
  const allTags = Array.from(new Set(articles.flatMap(a => a.tags))).slice(0, 12);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const title = file.name.replace(/\.[^/.]+$/, '');
      const newArt = createBlankResearch(title);
      newArt.content = text;
      setEditingArticle(newArt);
      setViewMode('edit');
      setEditorTab('write');
    } catch {
      alert('Failed to read file');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreate = () => {
    const newArt = createBlankResearch();
    setEditingArticle(newArt);
    setViewMode('edit');
    setEditorTab('write');
  };

  const handleEdit = (article: ResearchArticle) => {
    setEditingArticle({ ...article });
    setViewMode('edit');
    setEditorTab('write');
  };

  const handleSave = () => {
    if (editingArticle) {
      saveResearch(editingArticle);
      setArticles(getAllResearches());
      setViewMode('list');
      setEditingArticle(null);
    }
  };

  const handleDelete = (id: string) => {
    deleteResearch(id);
    setArticles(getAllResearches());
    setDeleteConfirmId(null);
  };

  const handleBack = () => {
    setViewMode('list');
    setEditingArticle(null);
    setActiveTag(null);
  };

  const filteredArticles = articles.filter(a => {
    const matchesSearch =
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.author.toLowerCase().includes(search.toLowerCase()) ||
      a.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesTag = !activeTag || a.tags.includes(activeTag);
    return matchesSearch && matchesTag;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: 'var(--bg)', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── TOP NAV ── */}
      <header style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)',
        flexShrink: 0,
      }}>
        {/* Left: brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {viewMode === 'edit' && (
            <button
              onClick={handleBack}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, color: 'var(--text-dim)', background: 'none',
                border: 'none', cursor: 'pointer', padding: '4px 8px',
                borderRadius: 6, transition: 'color .15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
            >
              <ArrowLeft size={14} />
              <span style={{ fontFamily: 'monospace', letterSpacing: 1 }}>LIBRARY</span>
            </button>
          )}
          {viewMode === 'list' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'linear-gradient(135deg, #d97706, #92400e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <GraduationCap size={16} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: '#fff', textTransform: 'uppercase' }}>Research Bank</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: 1 }}>{articles.length} article{articles.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          )}
          {viewMode === 'edit' && (
            <div style={{ height: 20, width: 1, background: 'var(--border)', margin: '0 4px' }} />
          )}
          {viewMode === 'edit' && (
            <span style={{ fontSize: 13, color: '#fff', fontWeight: 600, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {editingArticle?.title || 'Untitled Research'}
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {viewMode === 'edit' && (
            <>
              {/* Tab switcher */}
              <div style={{
                display: 'flex', gap: 2,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                borderRadius: 8, padding: 3,
              }}>
                {(['write', 'preview'] as EditorTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setEditorTab(tab)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 6,
                      fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
                      letterSpacing: 1, textTransform: 'uppercase',
                      border: 'none', cursor: 'pointer',
                      background: editorTab === tab ? '#d97706' : 'transparent',
                      color: editorTab === tab ? '#fff' : 'var(--text-dim)',
                      transition: 'all .15s',
                    }}
                  >
                    {tab === 'write' ? <Code2 size={11} /> : <Eye size={11} />}
                    {tab}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSave}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8,
                  background: '#16a34a', color: '#fff',
                  fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                  letterSpacing: 1, border: 'none', cursor: 'pointer',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#15803d')}
                onMouseLeave={e => (e.currentTarget.style.background = '#16a34a')}
              >
                <Save size={13} /> SAVE
              </button>
            </>
          )}

          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center',
              justifyContent: 'center', borderRadius: 8, border: 'none',
              background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer',
              transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
          >
            <X size={17} />
          </button>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

        {/* ════════════ LIST VIEW ════════════ */}
        {viewMode === 'list' && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* Sidebar */}
            <aside style={{
              width: 220, borderRight: '1px solid var(--border)',
              background: 'var(--bg2)', display: 'flex', flexDirection: 'column',
              flexShrink: 0, padding: '20px 0',
            }}>
              <div style={{ padding: '0 16px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleImport}
                  accept=".md,.txt"
                  style={{ display: 'none' }}
                />
                <button
                  onClick={handleCreate}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    padding: '9px 0', borderRadius: 8,
                    background: 'linear-gradient(135deg, #d97706, #b45309)',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                    fontFamily: 'monospace', letterSpacing: 1,
                    border: 'none', cursor: 'pointer', width: '100%',
                    boxShadow: '0 4px 12px rgba(217,119,6,0.3)',
                    transition: 'opacity .15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  <Plus size={14} /> NEW ARTICLE
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    padding: '8px 0', borderRadius: 8,
                    background: 'transparent', color: 'var(--text-dim)',
                    border: '1px solid var(--border)', fontSize: 11,
                    fontFamily: 'monospace', letterSpacing: 1,
                    cursor: 'pointer', width: '100%', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(217,119,6,0.4)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                >
                  <Upload size={12} /> IMPORT .MD
                </button>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)', margin: '0 16px 16px' }} />

              {/* Nav items */}
              <nav style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <NavItem
                  icon={<BookOpen size={14} />}
                  label="All Articles"
                  count={articles.length}
                  active={!activeTag}
                  onClick={() => setActiveTag(null)}
                />
              </nav>

              {allTags.length > 0 && (
                <>
                  <div style={{ padding: '16px 16px 8px', fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' }}>
                    Topics
                  </div>
                  <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
                    {allTags.map(tag => (
                      <NavItem
                        key={tag}
                        icon={<Hash size={12} />}
                        label={tag}
                        count={articles.filter(a => a.tags.includes(tag)).length}
                        active={activeTag === tag}
                        onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      />
                    ))}
                  </div>
                </>
              )}
            </aside>

            {/* Main list area */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Search bar */}
              <div style={{
                padding: '16px 24px', borderBottom: '1px solid var(--border)',
                background: 'var(--bg2)', flexShrink: 0,
              }}>
                <div style={{ position: 'relative', maxWidth: 480 }}>
                  <Search size={15} style={{
                    position: 'absolute', left: 12, top: '50%',
                    transform: 'translateY(-50%)', color: 'var(--text-dim)',
                  }} />
                  <input
                    type="text"
                    placeholder="Search title, author, tag…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border)', borderRadius: 8,
                      padding: '8px 14px 8px 38px', fontSize: 13,
                      color: '#fff', outline: 'none',
                      transition: 'border-color .15s',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(217,119,6,0.5)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  />
                </div>
              </div>

              {/* Article grid */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                {filteredArticles.length === 0 ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100%', gap: 12,
                    color: 'var(--text-dim)', opacity: 0.4,
                  }}>
                    <Library size={44} />
                    <p style={{ fontSize: 12, fontFamily: 'monospace', letterSpacing: 3, textTransform: 'uppercase' }}>
                      {search || activeTag ? 'No matching articles' : 'The library is empty'}
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                    {filteredArticles.map(article => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        onEdit={() => handleEdit(article)}
                        onDelete={() => setDeleteConfirmId(article.id)}
                        deleteConfirm={deleteConfirmId === article.id}
                        onDeleteConfirm={() => handleDelete(article.id)}
                        onDeleteCancel={() => setDeleteConfirmId(null)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </main>
          </div>
        )}

        {/* ════════════ EDIT VIEW ════════════ */}
        {viewMode === 'edit' && editingArticle && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Metadata strip — write mode only */}
            <div style={{
              padding: '16px 28px', borderBottom: '1px solid var(--border)',
              background: 'var(--bg2)', flexShrink: 0,
              display: editorTab === 'write' ? 'grid' : 'none',
              gridTemplateColumns: '2fr 1fr 1fr', gap: 16,
            }}>
              <Field label="Title">
                <input
                  type="text"
                  value={editingArticle.title}
                  onChange={e => setEditingArticle(p => p ? { ...p, title: e.target.value } : null)}
                  placeholder="Research title"
                  style={metaInputStyle}
                />
              </Field>
              <Field label="Author">
                <input
                  type="text"
                  value={editingArticle.author}
                  onChange={e => setEditingArticle(p => p ? { ...p, author: e.target.value } : null)}
                  placeholder="Lead author"
                  style={metaInputStyle}
                />
              </Field>
              <Field label="DOI / URL">
                <input
                  type="text"
                  value={editingArticle.sourceUrl || ''}
                  onChange={e => setEditingArticle(p => p ? { ...p, sourceUrl: e.target.value } : null)}
                  placeholder="https://arxiv.org/…"
                  style={metaInputStyle}
                />
              </Field>
            </div>

            {/* Abstract + tags strip — write mode only */}
            <div style={{
              padding: '12px 28px', borderBottom: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.15)', flexShrink: 0,
              display: editorTab === 'write' ? 'grid' : 'none',
              gridTemplateColumns: '3fr 1fr', gap: 16, alignItems: 'start',
            }}>
              <Field label="Abstract">
                <textarea
                  value={editingArticle.abstract || ''}
                  onChange={e => setEditingArticle(p => p ? { ...p, abstract: e.target.value } : null)}
                  placeholder="Brief summary of the research…"
                  rows={2}
                  style={{ ...metaInputStyle, resize: 'none', lineHeight: 1.5 }}
                />
              </Field>
              <Field label="Tags (comma-separated)">
                <input
                  type="text"
                  value={editingArticle.tags.join(', ')}
                  onChange={e => setEditingArticle(p => p ? { ...p, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) } : null)}
                  placeholder="AI, Physics, ML"
                  style={metaInputStyle}
                />
              </Field>
            </div>

            {/* Editor / Preview pane */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {/* Write */}
              {editorTab === 'write' && (
                <textarea
                  value={editingArticle.content || ''}
                  onChange={e => setEditingArticle(p => p ? { ...p, content: e.target.value } : null)}
                  placeholder={"# Introduction\n\nStart writing in Markdown + LaTeX…\n\n$$E = mc^2$$"}
                  style={{
                    width: '100%', height: '100%', background: '#0a0c10',
                    border: 'none', outline: 'none', resize: 'none',
                    color: '#e2e8f0', fontSize: 14, lineHeight: 1.8,
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    padding: '32px 40px', boxSizing: 'border-box',
                    caretColor: '#d97706',
                  }}
                />
              )}

              {/* Preview */}
              {editorTab === 'preview' && (
                <div style={{ height: '100%', overflowY: 'auto', padding: '40px 80px', background: 'var(--bg)' }}>
                  <div style={{ maxWidth: 680, margin: '0 auto' }}>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8, lineHeight: 1.2 }}>
                      {editingArticle.title || 'Untitled Research'}
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace', marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <User size={12} /> {editingArticle.author || 'Unknown Author'}
                      </span>
                      {editingArticle.sourceUrl && (
                        <a href={editingArticle.sourceUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#d97706', textDecoration: 'none' }}>
                          <LinkIcon size={12} /> Source
                        </a>
                      )}
                    </div>

                    {editingArticle.abstract && (
                      <div style={{
                        marginBottom: 36, padding: '16px 20px',
                        background: 'rgba(217,119,6,0.06)',
                        borderLeft: '3px solid rgba(217,119,6,0.6)',
                        borderRadius: '0 6px 6px 0',
                      }}>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#d97706', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Abstract</div>
                        <p style={{ fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>{editingArticle.abstract}</p>
                      </div>
                    )}

                    <div className="markdown-body prose prose-invert max-w-none prose-amber">
                      <Markdown
                        remarkPlugins={remarkPlugins}
                        rehypePlugins={rehypePlugins as any}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            if (!inline && match?.[1] === 'mermaid') {
                              return <MermaidChart chart={String(children).replace(/\n$/, '')} />;
                            }
                            return <code className={className} {...props}>{children}</code>;
                          }
                        }}
                      >
                        {editingArticle.content || '*No content yet.*'}
                      </Markdown>
                    </div>

                    {editingArticle.tags.length > 0 && (
                      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {editingArticle.tags.map(tag => (
                          <span key={tag} style={{
                            padding: '4px 10px', borderRadius: 20,
                            background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)',
                            fontSize: 10, fontFamily: 'monospace', color: 'rgba(217,119,6,0.8)',
                            letterSpacing: 1, textTransform: 'uppercase',
                          }}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function NavItem({ icon, label, count, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 7,
        background: active ? 'rgba(217,119,6,0.15)' : 'transparent',
        border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
        color: active ? '#d97706' : 'var(--text-dim)',
        fontSize: 13, transition: 'all .15s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ opacity: 0.7, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400 }}>{label}</span>
      <span style={{
        fontSize: 10, fontFamily: 'monospace', opacity: 0.5,
        background: 'rgba(255,255,255,0.07)', borderRadius: 4,
        padding: '1px 5px',
      }}>{count}</span>
    </button>
  );
}

function ArticleCard({ article, onEdit, onDelete, deleteConfirm, onDeleteConfirm, onDeleteCancel }: {
  article: ResearchArticle;
  onEdit: () => void;
  onDelete: () => void;
  deleteConfirm: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const wordCount = article.content?.split(/\s+/).filter(Boolean).length ?? 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '20px', cursor: 'pointer',
        transition: 'all .2s',
        borderColor: hovered ? 'rgba(217,119,6,0.35)' : 'var(--border)',
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.3)' : 'none',
        transform: hovered ? 'translateY(-1px)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
      onClick={onEdit}
    >
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <h3 style={{
          fontSize: 15, fontWeight: 700, color: hovered ? '#f59e0b' : '#fff',
          margin: 0, lineHeight: 1.35, transition: 'color .15s',
        }}>
          {article.title}
        </h3>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, opacity: hovered ? 1 : 0, transition: 'opacity .15s' }}>
          <IconBtn onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Edit">
            <Edit3 size={13} />
          </IconBtn>
          <IconBtn
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete"
            danger
          >
            <Trash2 size={13} />
          </IconBtn>
        </div>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <User size={11} /> {article.author || 'Unknown'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlignLeft size={11} /> {wordCount.toLocaleString()} words
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={11} /> {new Date(article.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* Abstract */}
      {article.abstract && (
        <p style={{
          fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.65,
          fontStyle: 'italic', margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {article.abstract}
        </p>
      )}

      {/* Footer: tags + arrow */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {article.tags.slice(0, 4).map(tag => (
            <span key={tag} style={{
              padding: '2px 8px', borderRadius: 4,
              background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.18)',
              fontSize: 9, fontFamily: 'monospace', color: 'rgba(217,119,6,0.75)',
              letterSpacing: 1, textTransform: 'uppercase',
            }}>{tag}</span>
          ))}
          {article.tags.length > 4 && (
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-dim)', padding: '2px 0' }}>+{article.tags.length - 4}</span>
          )}
        </div>
        <ChevronRight size={14} style={{ color: 'var(--text-dim)', opacity: hovered ? 1 : 0, transition: 'opacity .15s' }} />
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            marginTop: 4, padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 11, color: '#fca5a5', fontFamily: 'monospace' }}>Delete permanently?</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onDeleteCancel} style={{ fontSize: 11, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>Cancel</button>
            <button onClick={onDeleteConfirm} style={{ fontSize: 11, color: '#fff', background: '#dc2626', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 8px', fontWeight: 700 }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ onClick, title, danger, children }: {
  onClick: (e: React.MouseEvent) => void;
  title?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 26, height: 26, display: 'flex', alignItems: 'center',
        justifyContent: 'center', borderRadius: 6,
        background: 'transparent', border: '1px solid var(--border)',
        color: 'var(--text-dim)', cursor: 'pointer', transition: 'all .15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = danger ? '#f87171' : '#fff';
        e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--text-dim)';
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const metaInputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)', borderRadius: 6,
  padding: '7px 10px', fontSize: 13, color: '#fff',
  outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box', transition: 'border-color .15s',
};