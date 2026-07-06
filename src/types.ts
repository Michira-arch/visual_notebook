export type CellType = 'canvas' | 'markdown' | 'code' | 'sandbox';
export type CellMode = 'command' | 'edit';

export interface Reference {
  id: string;
  name: string;
  content: string;
}

export interface CellVersion {
  prompt: string;
  content: string;
  timestamp: number;
}

export interface CellData {
  id: string;
  type: CellType;
  // canvas cells
  versions: CellVersion[];
  currentVersionIndex: number;
  isEditing: boolean;
  isLoading: boolean;
  // markdown cells
  markdownContent?: string;
  // auto-markup tracking
  markupHash?: string;
  // code cells
  codeContent?: string;
  language?: string;
  isCollapsed?: boolean;
  // language auto-inference & overrides
  detectedLanguage?: string;
  languageOverride?: string;
  detectedConfidence?: number;
  // execution results
  isExecuting?: boolean;
  executionResult?: ExecutionResult;
  sandboxId?: string;
  // sandbox cells (live HTML/CSS/JS)
  sandboxHtml?: string;
  sandboxCss?: string;
  sandboxJs?: string;
  sandboxAutoRun?: boolean;
  // jupyter-style metadata
  executionCount?: number;
  lastRunTimestamp?: number;
}

export interface CellSandbox {
  id: string;
  name: string;
  color: string;
}

export interface ExecutionResult {
  status: 'success' | 'error' | 'timeout' | 'no-compiler';
  tier: 'browser' | 'local' | 'remote';
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number; // ms
  outputs: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
  parsedAction?: {
    tool: string;
    args: any;
    status: 'pending' | 'accepted' | 'rejected';
  };
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface NotebookState {
  id: string;
  name: string;
  cells: CellData[];
  references: Reference[];
  conversations?: Conversation[];
  activeConversationId?: string;
  sandboxes?: CellSandbox[];
  focusedSandboxId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ResearchArticle {
  id: string;
  title: string;
  author: string;
  content: string; // Markdown + LaTeX
  tags: string[];
  createdAt: number;
  updatedAt: number;
  sourceUrl?: string;
  abstract?: string;
}

export interface CommandAction {
  id: string;
  label: string;
  shortcut?: string;
  category: 'cell' | 'notebook' | 'navigation' | 'view';
  action: () => void;
}
