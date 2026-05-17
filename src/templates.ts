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
  {
    id: 'interactive-sim',
    name: 'Interactive Simulation',
    description: 'Build animated simulations with live HTML/CSS/JS sandbox cells.',
    icon: '⚡',
    category: 'Engineering',
    cells: [
      { id: mkId(), type: 'markdown', versions: [], currentVersionIndex: 0, isEditing: false, isLoading: false, markdownContent: `## Interactive Simulation\n\n**Use Sandbox cells** to build live, interactive simulations directly in your notebook.\n\nEach sandbox has:\n- **HTML** tab for structure\n- **CSS** tab for styling & animations\n- **JS** tab for logic & interactivity\n- **Live preview** with a built-in console\n\nGreat for:\n- Physics simulations\n- Machine blueprints & animated schematics\n- Data visualizations\n- Interactive prototypes\n- CSS animation experiments` },
      { id: mkId(), type: 'sandbox', versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false,
        sandboxHtml: `<canvas id="sim" width="600" height="300"></canvas>\n<div class="controls">\n  <button id="startBtn">▶ Start</button>\n  <button id="resetBtn">↺ Reset</button>\n  <span id="status">Ready</span>\n</div>`,
        sandboxCss: `body { display:flex; flex-direction:column; align-items:center; padding:1rem; background:#0f172a; }\ncanvas { border:1px solid #1e293b; border-radius:8px; background:#020617; }\n.controls { margin-top:1rem; display:flex; gap:0.75rem; align-items:center; }\nbutton { padding:0.4rem 1rem; border:1px solid #22d3ee; background:transparent; color:#22d3ee; border-radius:6px; cursor:pointer; font-size:0.8rem; transition:all 0.2s; }\nbutton:hover { background:rgba(34,211,238,0.15); }\n#status { font-family:monospace; font-size:0.75rem; color:#64748b; }`,
        sandboxJs: `const canvas = document.getElementById('sim');\nconst ctx = canvas.getContext('2d');\nlet running = false, balls = [];\n\nfunction addBall() {\n  balls.push({ x: Math.random()*560+20, y: 20, vx: (Math.random()-0.5)*3, vy: 0, r: 6+Math.random()*8, color: \`hsl(\${Math.random()*360},70%,60%)\` });\n}\n\nfunction step() {\n  ctx.clearRect(0,0,600,300);\n  balls.forEach(b => {\n    b.vy += 0.15; b.x += b.vx; b.y += b.vy;\n    if(b.y+b.r > 300) { b.y = 300-b.r; b.vy *= -0.7; }\n    if(b.x-b.r < 0 || b.x+b.r > 600) b.vx *= -1;\n    ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2);\n    ctx.fillStyle = b.color; ctx.fill();\n    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.stroke();\n  });\n  if(running) requestAnimationFrame(step);\n}\n\ndocument.getElementById('startBtn').onclick = () => {\n  running = !running;\n  document.getElementById('startBtn').textContent = running ? '⏸ Pause' : '▶ Start';\n  document.getElementById('status').textContent = running ? 'Simulating...' : 'Paused';\n  if(running) { for(let i=0;i<5;i++) addBall(); step(); }\n};\ndocument.getElementById('resetBtn').onclick = () => { balls = []; running = false; ctx.clearRect(0,0,600,300); document.getElementById('startBtn').textContent = '▶ Start'; document.getElementById('status').textContent = 'Ready'; };`,
        sandboxAutoRun: true,
      },
    ],
  },
  {
    id: 'blueprint-designer',
    name: 'Blueprint Designer',
    description: 'Design machine blueprints and schematics with live CSS & SVG.',
    icon: '📐',
    category: 'Engineering',
    cells: [
      { id: mkId(), type: 'markdown', versions: [], currentVersionIndex: 0, isEditing: false, isLoading: false, markdownContent: `## Blueprint Designer\n\nUse the **Sandbox cell** below to design machine blueprints, schematics, and animated component diagrams using HTML/SVG/CSS.\n\n**Tips:**\n- Use SVG for precise technical drawings\n- CSS animations to show moving parts\n- JS for interactive component inspection\n- Combine with Canvas cells for AI-generated diagrams` },
      { id: mkId(), type: 'sandbox', versions: [], currentVersionIndex: -1, isEditing: false, isLoading: false,
        sandboxHtml: `<div class="blueprint">\n  <h2>GEAR ASSEMBLY</h2>\n  <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">\n    <g class="gear gear-1" transform="translate(150,150)">\n      <circle r="50" fill="none" stroke="#22d3ee" stroke-width="1.5"/>\n      <circle r="15" fill="none" stroke="#22d3ee" stroke-width="1"/>\n      <circle r="3" fill="#22d3ee"/>\n      ${Array.from({length:12},(_,i)=>`<line x1="0" y1="-42" x2="0" y2="-55" stroke="#22d3ee" stroke-width="8" stroke-linecap="round" transform="rotate(${i*30})"/>`).join('')}\n    </g>\n    <g class="gear gear-2" transform="translate(260,150)">\n      <circle r="35" fill="none" stroke="#a855f7" stroke-width="1.5"/>\n      <circle r="10" fill="none" stroke="#a855f7" stroke-width="1"/>\n      <circle r="3" fill="#a855f7"/>\n      ${Array.from({length:9},(_,i)=>`<line x1="0" y1="-28" x2="0" y2="-40" stroke="#a855f7" stroke-width="7" stroke-linecap="round" transform="rotate(${i*40})"/>`).join('')}\n    </g>\n    <line x1="150" y1="210" x2="150" y2="280" stroke="#22d3ee" stroke-width="2" stroke-dasharray="4,4"/>\n    <text x="150" y="295" text-anchor="middle" fill="#64748b" font-size="10" font-family="monospace">DRIVE SHAFT</text>\n  </svg>\n  <div class="label">REV 1.0 · SCALE 1:4</div>\n</div>`,
        sandboxCss: `.blueprint { text-align:center; padding:2rem; background:#020617; font-family:monospace; }\nh2 { color:#22d3ee; font-size:0.9rem; letter-spacing:4px; margin-bottom:1rem; opacity:0.8; }\nsvg { width:100%; max-width:400px; }\n.gear-1 { animation: spin 6s linear infinite; transform-origin: 150px 150px; }\n.gear-2 { animation: spin 4.5s linear infinite reverse; transform-origin: 260px 150px; }\n@keyframes spin { to { transform: rotate(360deg); } }\n/* fix transform-origin for SVG groups */\n.gear-1 { animation: spin1 6s linear infinite; }\n.gear-2 { animation: spin2 4.5s linear infinite; }\n@keyframes spin1 { from { transform: translate(150px,150px) rotate(0); } to { transform: translate(150px,150px) rotate(360deg); } }\n@keyframes spin2 { from { transform: translate(260px,150px) rotate(0); } to { transform: translate(260px,150px) rotate(-360deg); } }\n.label { color:#64748b; font-size:0.65rem; letter-spacing:3px; margin-top:1rem; }`,
        sandboxJs: `console.log('Blueprint loaded — Gear Assembly Rev 1.0');`,
        sandboxAutoRun: true,
      },
    ],
  },
];
