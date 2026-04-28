import { NotebookState } from './types';

function mkId() { return Math.random().toString(36).substr(2, 9); }

const DEMO_HTML = `<div class="custom-card"><div class="custom-card-title">WELCOME TO THE NOTEBOOK</div><p>This is your collaborative AI brainstorming canvas. Type commands below to edit this visualization or create new cells.</p></div><div class="pipeline"><div class="pipe-step"><div class="pipe-step-num">STEP 1</div><div class="pipe-step-name">PROMPT</div><div class="pipe-step-desc">Describe your algorithm or data structure</div></div><div class="pipe-step"><div class="pipe-step-num">STEP 2</div><div class="pipe-step-name">GENERATE</div><div class="pipe-step-desc">The AI renders a dynamic blueprint</div></div><div class="pipe-step"><div class="pipe-step-num">STEP 3</div><div class="pipe-step-name">ITERATE</div><div class="pipe-step-desc">Refine the visual through conversation</div></div></div>`;

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  cells: NotebookState['cells'];
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'blank',
    name: 'Blank Notebook',
    description: 'Start fresh with an empty canvas.',
    icon: '📝',
    category: 'General',
    cells: [],
  },
  {
    id: 'system-design',
    name: 'System Architecture',
    description: 'Design microservices, APIs, and distributed systems.',
    icon: '🏗️',
    category: 'Engineering',
    cells: [
      { id: mkId(), type: 'markdown', versions: [], currentVersionIndex: 0, isEditing: false, isLoading: false, markdownContent: `## System Architecture Design\n\n**Goal:** Define the services, data flows, and infrastructure for our system.\n\n**Key dimensions to cover:**\n- Client layer (web/mobile)\n- API Gateway / Auth\n- Core business services\n- Data layer (primary DB, cache, search)\n- Async messaging / queues\n- Observability stack\n\nPrompt the Canvas cells below to generate architecture diagrams.` },
      { id: mkId(), type: 'canvas', versions: [{ prompt: 'Draw a system architecture diagram with API gateway, 3 microservices (Auth, Orders, Notifications), PostgreSQL, Redis cache, and a message queue connecting them. Use layer-stack and pipeline components.', content: DEMO_HTML, timestamp: Date.now() }], currentVersionIndex: 0, isEditing: false, isLoading: false },
    ],
  },
  {
    id: 'ml-pipeline',
    name: 'ML Pipeline Design',
    description: 'Design a machine learning training and inference pipeline.',
    icon: '🧠',
    category: 'ML / AI',
    cells: [
      { id: mkId(), type: 'markdown', versions: [], currentVersionIndex: 0, isEditing: false, isLoading: false, markdownContent: `## ML Pipeline Architecture\n\n**Phases to design:**\n1. Data ingestion & preprocessing\n2. Feature engineering\n3. Model training loop\n4. Evaluation & metrics\n5. Serving / inference API\n6. Monitoring & retraining triggers\n\n**Model details:**\n- _[Fill in: model type, task, input/output shape]_\n\nGenerate visuals for each phase using the canvas cells.` },
      { id: mkId(), type: 'canvas', versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false },
    ],
  },
  {
    id: 'algo-analysis',
    name: 'Algorithm Analysis',
    description: 'Break down and visualize a complex algorithm.',
    icon: '📐',
    category: 'Engineering',
    cells: [
      { id: mkId(), type: 'markdown', versions: [], currentVersionIndex: 0, isEditing: false, isLoading: false, markdownContent: `## Algorithm Analysis\n\n**Algorithm Name:** _[Fill in]_\n\n**Problem Statement:**\n_[Describe the problem being solved]_\n\n**Complexity:**\n- Time: O(?)\n- Space: O(?)\n\n**Approach:** _[Divide & Conquer / DP / Greedy / Graph...]_\n\nUse the canvas cells to visualize the algorithm steps, data structures, and complexity analysis.` },
      { id: mkId(), type: 'code', versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false, codeContent: `# Pseudocode / Reference Implementation\ndef solve(input):\n    # Step 1: ...\n    # Step 2: ...\n    pass`, language: 'python' },
      { id: mkId(), type: 'canvas', versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false },
    ],
  },
  {
    id: 'product-plan',
    name: 'Product Roadmap',
    description: 'Plan features, milestones, and sprint breakdowns.',
    icon: '🎯',
    category: 'Product',
    cells: [
      { id: mkId(), type: 'markdown', versions: [], currentVersionIndex: 0, isEditing: false, isLoading: false, markdownContent: `## Product Roadmap\n\n**Product:** _[Name]_\n\n**Vision:** _[One-line vision statement]_\n\n**Phases:**\n- **Phase 0 — Foundation:** Core infra, auth, data model\n- **Phase 1 — MVP:** Minimum set of features for first users\n- **Phase 2 — Growth:** Viral loops, sharing, collaboration\n- **Phase 3 — Scale:** Performance, enterprise features\n\n**Key Metrics:** DAU, retention, NPS\n\nGenerate visual roadmap timelines and feature priority matrices below.` },
      { id: mkId(), type: 'canvas', versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false },
    ],
  },
  {
    id: 'research-notes',
    name: 'Research Notes',
    description: 'Synthesize papers, ideas, and experiments.',
    icon: '🔬',
    category: 'Research',
    cells: [
      { id: mkId(), type: 'markdown', versions: [], currentVersionIndex: 0, isEditing: false, isLoading: false, markdownContent: `## Research Notes\n\n**Topic:** _[Research area]_\n\n**Key Papers:**\n- _[Paper 1]_\n- _[Paper 2]_\n\n**Core Hypothesis:**\n_[What are you trying to prove or explore?]_\n\n**Open Questions:**\n- _[Question 1]_\n- _[Question 2]_\n\nUse canvas cells to visualize architectures from papers, comparison tables, and experiment designs.` },
      { id: mkId(), type: 'canvas', versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false },
    ],
  },
];
