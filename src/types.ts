export type CellType = 'canvas' | 'markdown' | 'code' | 'sandbox';

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
  // code cells
  codeContent?: string;
  language?: string;
  isCollapsed?: boolean;
  // sandbox cells (live HTML/CSS/JS)
  sandboxHtml?: string;
  sandboxCss?: string;
  sandboxJs?: string;
  sandboxAutoRun?: boolean;
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
