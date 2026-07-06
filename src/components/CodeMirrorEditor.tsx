import React, { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, drawSelection, lineNumbers, highlightActiveLineGutter, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';

// Language Imports
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { rust } from '@codemirror/lang-rust';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { go } from '@codemirror/lang-go';
import { yaml } from '@codemirror/lang-yaml';

// Define a Compartment for dynamically switching languages
const languageConf = new Compartment();

interface Props {
  code: string;
  language: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  readOnly?: boolean;
}

export default function CodeMirrorEditor({ code, language, onChange, onExecute, readOnly = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const codeRef = useRef<string>(code); // Track code without triggering effect loop

  // Keep track of current code so we don't dispatch when code matches
  useEffect(() => {
    codeRef.current = code;
    if (viewRef.current && viewRef.current.state.doc.toString() !== code) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: code }
      });
    }
  }, [code]);

  // Map language string to CM6 extension
  const getLanguageExtension = (lang: string) => {
    switch (lang.toLowerCase()) {
      case 'javascript':
      case 'typescript':
      case 'js':
      case 'ts':
        return javascript({ typescript: lang.includes('type') });
      case 'python':
      case 'py':
        return python();
      case 'html':
        return html();
      case 'css':
        return css();
      case 'json':
        return json();
      case 'markdown':
      case 'md':
        return markdown();
      case 'sql':
        return sql();
      case 'rust':
      case 'rs':
        return rust();
      case 'cpp':
      case 'c++':
      case 'c':
        return cpp();
      case 'java':
        return java();
      case 'go':
        return go();
      case 'yaml':
      case 'yml':
        return yaml();
      default:
        return []; // Plaintext fallback
    }
  };

  // Change language extension dynamically when language prop changes
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: languageConf.reconfigure(getLanguageExtension(language))
      });
    }
  }, [language]);

  // Initializing editor view
  useEffect(() => {
    if (!containerRef.current) return;

    // Custom theme using Visual Notebook colors
    const theme = EditorView.theme({
      '&': {
        color: 'var(--text)',
        backgroundColor: 'transparent',
        height: '100%',
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
      },
      '.cm-content': {
        caretColor: 'var(--cyan)',
        padding: '12px 4px',
        lineHeight: '1.6',
      },
      '.cm-cursor, .cm-dropCursor': {
        borderLeftColor: 'var(--cyan)'
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
        backgroundColor: 'rgba(34, 211, 238, 0.2) !important'
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        color: 'var(--text-dim)',
        borderRight: '1px solid var(--border)',
        opacity: 0.5,
        padding: '0 4px',
      },
      '.cm-gutterElement': {
        padding: '0 8px 0 4px',
        lineHeight: '1.6',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(255, 255, 255, 0.02)'
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        color: 'var(--cyan)',
      },
      '.cm-matchingBracket': {
        backgroundColor: 'rgba(34, 211, 238, 0.15)',
        outline: '1px solid var(--cyan-dim)',
      }
    }, { dark: true });

    // Keybindings: intercept Shift+Enter for Execution
    const customKeys = [];
    if (onExecute) {
      customKeys.push({
        key: 'Shift-Enter',
        run: () => {
          onExecute();
          return true;
        }
      });
    }

    const state = EditorState.create({
      doc: codeRef.current,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),
        highlightSelectionMatches(),
        keymap.of([
          ...customKeys,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab
        ]),
        languageConf.of(getLanguageExtension(language)),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newDoc = update.state.doc.toString();
            codeRef.current = newDoc;
            onChange(newDoc);
          }
        }),
        EditorState.readOnly.of(readOnly)
      ]
    });

    const view = new EditorView({
      state,
      parent: containerRef.current
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [onExecute, readOnly]);

  return (
    <div 
      ref={containerRef} 
      className="h-full w-full overflow-auto" 
      style={{ minHeight: '150px' }}
    />
  );
}
