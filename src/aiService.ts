import { CellData, Reference, CellType } from './types';
import { ModelConfig } from './providers/types';
import { generateText, generateFloodlightPlan, FloodlightItem } from './providers/adapters';

export type { FloodlightItem };
export type FloodlightPlanItem = { type: CellType; content: string };

const VISUAL_SYSTEM_PROMPT = `
You are an expert design engineer acting as the visual rendering engine for a "Visual Notebook".
The notebook is used for brainstorming and planning algorithmic architectures using specialized visual forms.

Your task is to generate visual content for a single cell based on the user's prompt and the notebook context.
You can output ONLY valid, self-contained raw HTML OR a Mermaid JS diagram.
If you output HTML, do NOT use markdown formatting (no \`\`\`html).
If you output a Mermaid diagram, wrap it in \`\`\`mermaid ... \`\`\` tags.

You have access to standard Tailwind CSS classes AND the following deeply integrated custom CSS classes:

// 1. CARDS
<div class="custom-card">
  <div class="custom-card-title">TITLE</div>
  <p>Content goes here.</p>
</div>
// Modifiers: Add 'orange', 'green', 'yellow', or 'red' to the card div.

// 2. FORMULA BOXES
<div class="formula-box">
  R = min(1, MW/150)<br>
  <span class="comment">// This is a comment</span>
</div>

// 3. PIPELINES
<div class="pipeline">
  <div class="pipe-step">
    <div class="pipe-step-num">STEP 1</div>
    <div class="pipe-step-name">LOAD</div>
    <div class="pipe-step-desc">Loading metadata</div>
  </div>
</div>

// 4. LAYER STACKS
<div class="layer-stack">
  <div class="layer">
    <div>
      <div class="layer-name">Input Layer</div>
      <div class="layer-detail">Dimensions: 512</div>
    </div>
  </div>
</div>

// 5. TAGS
<span class="custom-tag tag-cyan">Normal Tag</span>

// 6. DIVIDERS
<div class="custom-divider">
  <div class="custom-divider-line"></div>
  <div class="custom-divider-text">SECTION NAME</div>
  <div class="custom-divider-line"></div>
</div>

// 7. TABLES
<table class="custom-table">
  <tr><th>Key</th><th>Value</th></tr>
  <tr><td>Test</td><td>123</td></tr>
</table>

Create highly polished, structured, and informative visual components based on the user's prompt.
Ensure all components are dark-themed and fit the cyberpunk/technical blueprint aesthetic.
If using mermaid, use simple layouts. The frontend is configured with a dark theme.
`;

const FLOODLIGHT_SYSTEM_PROMPT = `You are an AI architect creating a multi-cell project plan.
Break the task down into 2-5 individual cells to kickstart or modify this project.
For markdown cells, provide the actual explanatory text. Use LaTeX ($ for inline, $$ for block) for any mathematical formulas.
For canvas cells, provide a highly detailed PROMPT that will be used by another AI to generate the HTML/Mermaid diagram.`;

function buildNotebookContext(allCells: CellData[]): string {
  return allCells.map(c => {
    if (c.type === 'markdown') return `Markdown Context: ${c.markdownContent}`;
    if (c.type === 'code') return c.codeContent ? `Code Block (${c.language || 'plaintext'}):\n\`\`\`${c.language}\n${c.codeContent}\n\`\`\`` : '';
    const v = c.versions[c.currentVersionIndex];
    return v ? `Canvas Cell Prompt: ${v.prompt}` : '';
  }).filter(Boolean).join('\n\n');
}

export async function generateVisualCell(
  prompt: string,
  history: { prompt: string; content: string }[],
  allCells: CellData[],
  references: Reference[],
  modelConfig: ModelConfig,
): Promise<string> {
  const notebookContext = buildNotebookContext(allCells);
  const refsContext = references.map(r => `Reference [${r.name}]:\n${r.content}`).join('\n\n');
  const historyStr = history.map(h => `User: ${h.prompt}\nAssistant: ${h.content}`).join('\n\n');

  let userPrompt = `Notebook Context:\n${notebookContext}\n\nProject References:\n${refsContext}\n\n`;
  userPrompt += history.length > 0
    ? `History:\n${historyStr}\n\nNew request for cell: ${prompt}`
    : `User request for new cell: ${prompt}`;

  const result = await generateText({
    ...modelConfig,
    systemPrompt: VISUAL_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.4,
  });

  let clean = result;
  if (!clean.includes('```mermaid')) {
    clean = clean.replace(/^```(html)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return clean.trim();
}

export async function runFloodlightPlan(
  prompt: string,
  allCells: CellData[],
  references: Reference[],
  modelConfig: ModelConfig,
): Promise<FloodlightPlanItem[]> {
  const notebookContext = buildNotebookContext(allCells);
  const refsContext = references.map(r => `Reference [${r.name}]:\n${r.content}`).join('\n\n');

  const items = await generateFloodlightPlan({
    ...modelConfig,
    systemPrompt: FLOODLIGHT_SYSTEM_PROMPT,
    userPrompt: `User Request: ${prompt}\n\nCurrent Notebook State:\n${notebookContext}\n\nProject References:\n${refsContext}`,
    temperature: 0.6,
  });

  return items as FloodlightPlanItem[];
}

// ─── PRISM Code Analysis ────────────────────────────────────────────────────

export interface CodeAnalysisResult {
  summary: string;
  detected_language: string;
  natural_language: string;
  math: string;
  mermaid: string;
  insights: string;
  complexity_summary: {
    time: string;
    space: string;
    dominant_operation: string;
  };
}

const PRISM_SYSTEM_PROMPT = `You are PRISM, an elite code intelligence engine. You produce precise, thorough, publication-quality code analysis.
Analyze the provided code and return ONLY a valid JSON object with no markdown backticks, no preamble, no trailing text.
The JSON must have exactly these keys:

"summary": One clear sentence describing what this codebase does.

"detected_language": The programming language detected.

"natural_language": A comprehensive markdown explanation structured with:
- ## Overview (what the whole codebase does, its purpose and architecture)
- ## Key Components (each major class/module/namespace, with responsibilities)
- ## Functions & Methods (for each function: its purpose, parameters with types, return value, side effects, and how it connects to other parts)
- ## Data Flow (how data moves through the system, entry points to outputs)
- ## Design Patterns (any patterns observed: Observer, Strategy, Builder, etc.)
Use **bold** for function/class names. Use \`code\` for variable names.

"math": A markdown string with mathematical representation. Structure:
- ## Formal Signatures (write each function as f: X → Y with domain/codomain)
- ## deeper analysis follows.
Use LaTeX for all mathematical notation, wrapped in $ for inline and $$ for block equations.

"mermaid": A valid Mermaid diagram string (just the raw mermaid code, no backticks). Choose the best diagram type:
- Use classDiagram for OOP/class-heavy code
- Use flowchart TD for procedural/functional code  
- Use sequenceDiagram for async/event-driven code
- Use graph TD for data pipeline/graph structures
Include ALL major functions, classes, and relationships. Label edges with interaction types. Use descriptive node labels. Keep it clean and avoid syntax issues.

"insights": A markdown string with deep code insights. Structure:
- ## Content here
- ## More content here
- ## And so on

"complexity_summary": An object with: { "time": "O(...)", "space": "O(...)", "dominant_operation": "..." }

CRITICAL: You must escape all newlines within string values as \\n. Do not use literal newlines inside strings or the JSON will be invalid.
Return ONLY the JSON. No backticks. No explanation.`;

export async function generateCodeAnalysis(
  code: string,
  language: string,
  modelConfig: ModelConfig,
): Promise<CodeAnalysisResult> {
  const langLabel = language === 'auto' ? 'the provided' : language;

  const userPrompt = `Analyze this ${langLabel} code:\n\n\`\`\`\n${code}\n\`\`\`\n\nReturn ONLY the JSON object as specified. No backticks wrapping the response.`;

  const raw = await generateText({
    ...modelConfig,
    systemPrompt: PRISM_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.3,
  });

  // Strip any accidental backticks or markdown wrappers
  let cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Try to fix unescaped control characters within string literals
  try {
    cleaned = cleaned.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
      return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    });
  } catch (e) { /* ignore regex errors if any */ }

  try {
    return JSON.parse(cleaned) as CodeAnalysisResult;
  } catch (e) {
    // Try to extract JSON from the response if wrapped in text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as CodeAnalysisResult;
    }
    throw new Error('Failed to parse analysis response. The model returned invalid JSON.');
  }
}

const CHAT_SYSTEM_PROMPT = `You are an AI assistant integrated directly into the user's Visual Notebook.
You can see their current notebook state (cells) and their reference files.
Use this context to answer questions, brainstorm, or provide feedback.
You also have the ability to perform actions in the notebook.
If you wish to perform an action, you must output a special XML tag <action> containing a JSON object.
The frontend will intercept this and ask the user for permission before executing. But write out the reasoning first before asking to create a cell; do not just output the action tag.

Available actions:
1. "create_cell": {"tool": "create_cell", "args": {"type": "markdown" | "code" | "canvas", "content": "markdown content, code content, or canvas prompt"}}
2. "run_floodlight": {"tool": "run_floodlight", "args": {"prompt": "floodlight prompt"}}
3. "take_screenshot": {"tool": "take_screenshot", "args": {}}
4. "sandbox_execute": {"tool": "sandbox_execute", "args": {"language": "javascript" | "mermaid", "code": "code here"}} - Executes code in a background sandbox and returns the result/errors to you. Use this to verify syntax or logic before outputting to the user.
5. "run_terminal_command": {"tool": "run_terminal_command", "args": {"command": "npm run build"}} - Runs a terminal command on the user's OS and returns the output to you. NOTE: The user MUST explicitly approve this command before it executes. Use this sparingly and cautiously to ship code or run scripts.
6. "send_whatsapp_message": {"tool": "send_whatsapp_message", "args": {"number": "exact_id_here", "message": "message body"}} - Send a message to a connected WhatsApp number. VERY IMPORTANT: You MUST use the exact ID provided in the incoming message, including any suffix like '@lid' or '@s.whatsapp.net'. Do not strip the suffix. Write your entire response in the action tag, because any content outside the action tag will not be seen by the user.

Example:
Print 'Hello World':
<action>
{"tool": "create_cell", "args": {"type": "markdown", "content": "# Hello World"}}
</action>

Only output ONE action per response. Always explain what you are going to do before the action tag. You do not need to output an action in each response, only when necessary or asked to.

When providing mathematical explanations or formulas, ALWAYS use LaTeX notation wrapped in $ for inline math and $$ for block math (e.g., $E=mc^2$ or $$\sum_{i=0}^n i$$).`;

export async function generateChatResponse(
  messages: { role: 'user' | 'assistant'; content: string }[],
  allCells: CellData[],
  references: Reference[],
  modelConfig: ModelConfig,
  images?: string[],
): Promise<string> {
  const notebookContext = buildNotebookContext(allCells);
  const refsContext = references.map(r => `Reference [${r.name}]:\n${r.content}`).join('\n\n');

  let systemPrompt = CHAT_SYSTEM_PROMPT;
  
  const formattedHistory = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
  
  let userPrompt = `Current Notebook State:\n${notebookContext}\n\nProject References:\n${refsContext}\n\nChat History:\n${formattedHistory}`;

  const result = await generateText({
    ...modelConfig,
    systemPrompt,
    userPrompt,
    temperature: 0.5,
    images,
  });

  return result;
}
