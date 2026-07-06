export interface LanguageDetectionResult {
  language: string;
  confidence: number; // 0 to 100
  alternatives: Array<{ language: string; confidence: number }>;
  method: 'shebang' | 'heuristic' | 'ai' | 'user';
}

const LANGUAGES = [
  'plaintext', 'python', 'javascript', 'typescript', 'rust', 'go',
  'java', 'c', 'cpp', 'sql', 'bash', 'json', 'yaml', 'html', 'css', 'markdown'
];

// Token patterns and keywords with weights
interface TokenRule {
  pattern: RegExp;
  weight: number;
}

const RULES: Record<string, TokenRule[]> = {
  python: [
    { pattern: /\bdef\s+\w+\s*\(/, weight: 3 },
    { pattern: /\bimport\s+[\w, ]+/, weight: 2 },
    { pattern: /\bfrom\s+\w+\s+import\b/, weight: 3 },
    { pattern: /\belif\b/, weight: 3 },
    { pattern: /\bself\./, weight: 3 },
    { pattern: /\bclass\s+\w+:/, weight: 3 },
    { pattern: /\bclass\s+\w+\([\w, ]+\):/, weight: 3 },
    { pattern: /\bprint\s*\(/, weight: 1 },
    { pattern: /\blambda\b/, weight: 2 },
    { pattern: /__init__/, weight: 3 },
    { pattern: /#.*/, weight: 1 },
    { pattern: /\bNone\b/, weight: 2 },
    { pattern: /\bTrue\b/, weight: 1 },
    { pattern: /\bFalse\b/, weight: 1 },
  ],
  javascript: [
    { pattern: /\bconst\s+\w+\s*=/, weight: 3 },
    { pattern: /\blet\s+\w+\s*=/, weight: 3 },
    { pattern: /=>/, weight: 3 },
    { pattern: /\bconsole\.log\s*\(/, weight: 3 },
    { pattern: /\bfunction\s+\w+\s*\(/, weight: 2 },
    { pattern: /\bfunction\s*\(/, weight: 2 },
    { pattern: /\brequire\s*\(/, weight: 2 },
    { pattern: /\bexport\s+const\b/, weight: 2 },
    { pattern: /\bimport\s+.*from\s+['"].*['"]/, weight: 2 },
    { pattern: /\basync\s+/, weight: 2 },
    { pattern: /\bawait\s+/, weight: 2 },
    { pattern: /\bundefined\b/, weight: 1 },
    { pattern: /\bnull\b/, weight: 0.5 },
  ],
  typescript: [
    { pattern: /\binterface\s+\w+/, weight: 3 },
    { pattern: /\btype\s+\w+\s*=/, weight: 3 },
    { pattern: /:\s*(string|number|boolean|any|void|unknown|never)\b/, weight: 3 },
    { pattern: /\bas\s+\w+/, weight: 2 },
    { pattern: /\benum\s+\w+/, weight: 3 },
    { pattern: /\breadonly\b/, weight: 2 },
    { pattern: /\bprivate\s+/, weight: 2 },
    { pattern: /\bpublic\s+/, weight: 2 },
    { pattern: /\bprotected\s+/, weight: 2 },
    { pattern: /<[A-Z]\w*>/, weight: 2 },
  ],
  rust: [
    { pattern: /\bfn\s+\w+\s*\(/, weight: 3 },
    { pattern: /\blet\s+mut\b/, weight: 3 },
    { pattern: /\bimpl\s+\w+/, weight: 3 },
    { pattern: /\bpub\s+fn\b/, weight: 3 },
    { pattern: /->\s*\w+/, weight: 2 },
    { pattern: /&\w+/, weight: 1 },
    { pattern: /::/, weight: 2 },
    { pattern: /\.unwrap\s*\(/, weight: 3 },
    { pattern: /\bmatch\s+/, weight: 3 },
    { pattern: /\buse\s+[\w:]+/, weight: 2 },
    { pattern: /\bmod\s+\w+/, weight: 3 },
    { pattern: /\bstruct\s+\w+/, weight: 2 },
    { pattern: /\bprintln!\s*\(/, weight: 3 },
  ],
  go: [
    { pattern: /\bfunc\s+\w+\s*\(/, weight: 3 },
    { pattern: /\bpackage\s+\w+/, weight: 3 },
    { pattern: /:=/, weight: 3 },
    { pattern: /\bgo\s+func\b/, weight: 3 },
    { pattern: /\bfmt\./, weight: 3 },
    { pattern: /\bdefer\s+/, weight: 3 },
    { pattern: /\bchan\s+\w+/, weight: 3 },
    { pattern: /\bselect\s+\{/, weight: 2 },
    { pattern: /\binterface\s*\{/, weight: 2 },
    { pattern: /\bstruct\s*\{/, weight: 2 },
  ],
  java: [
    { pattern: /\bpublic\s+class\s+\w+/, weight: 3 },
    { pattern: /\bpublic\s+static\s+void\s+main\b/, weight: 3 },
    { pattern: /\bSystem\.out\.print/, weight: 3 },
    { pattern: /\bString\[\]\s+args\b/, weight: 2 },
    { pattern: /@Override/, weight: 2 },
    { pattern: /\bprivate\s+final\b/, weight: 2 },
    { pattern: /\bimport\s+java\./, weight: 2 },
  ],
  c: [
    { pattern: /#include\s+<\w+\.h>/, weight: 3 },
    { pattern: /\bint\s+main\s*\(/, weight: 3 },
    { pattern: /\bprintf\s*\(/, weight: 2 },
    { pattern: /\bmalloc\s*\(/, weight: 2 },
    { pattern: /\bsizeof\s*\(/, weight: 1 },
    { pattern: /\bfree\s*\(/, weight: 1 },
    { pattern: /\bNULL\b/, weight: 2 },
  ],
  cpp: [
    { pattern: /#include\s+<iostream>/, weight: 3 },
    { pattern: /\bstd::cout\b/, weight: 3 },
    { pattern: /\bstd::endl\b/, weight: 3 },
    { pattern: /\busing\s+namespace\s+std\b/, weight: 3 },
    { pattern: /<<\s*std::/, weight: 3 },
    { pattern: /cout\s*<</, weight: 3 },
    { pattern: /\btemplate\s*</, weight: 2 },
    { pattern: /\bclass\s+\w+/, weight: 1 },
    { pattern: /\bvirtual\b/, weight: 2 },
  ],
  sql: [
    { pattern: /\bSELECT\b/i, weight: 3 },
    { pattern: /\bFROM\b/i, weight: 3 },
    { pattern: /\bWHERE\b/i, weight: 3 },
    { pattern: /\bINSERT\s+INTO\b/i, weight: 3 },
    { pattern: /\bCREATE\s+TABLE\b/i, weight: 3 },
    { pattern: /\bJOIN\b/i, weight: 2 },
    { pattern: /\bGROUP\s+BY\b/i, weight: 2 },
    { pattern: /\bORDER\s+BY\b/i, weight: 2 },
    { pattern: /\bUPDATE\s+\w+\s+SET\b/i, weight: 3 },
  ],
  bash: [
    { pattern: /\becho\s+/, weight: 2 },
    { pattern: /\bif\s+\[/, weight: 3 },
    { pattern: /\bfi\b/, weight: 3 },
    { pattern: /\bdone\b/, weight: 3 },
    { pattern: /\besac\b/, weight: 3 },
    { pattern: /\bexport\s+\w+=/, weight: 2 },
    { pattern: /\bsource\s+/, weight: 2 },
    { pattern: /local\s+\w+=/, weight: 2 },
  ],
  json: [
    { pattern: /^\s*\{\s*"\w+"/, weight: 3 },
    { pattern: /:\s*\[/, weight: 1 },
    { pattern: /"\w+"\s*:\s*"/, weight: 2 },
    { pattern: /"\w+"\s*:\s*\d+/, weight: 2 },
    { pattern: /"\w+"\s*:\s*(true|false|null)/, weight: 2 },
  ],
  yaml: [
    { pattern: /^---/, weight: 3 },
    { pattern: /^\s*-\s+\w+/, weight: 2 },
    { pattern: /^\s*\w+\s*:\s*[^\s]/, weight: 2 },
    { pattern: /^\s*\w+\s*:\s*$/, weight: 2 },
  ],
  html: [
    { pattern: /<!DOCTYPE\s+html/i, weight: 3 },
    { pattern: /<html/i, weight: 3 },
    { pattern: /<\/html>/i, weight: 3 },
    { pattern: /<div/i, weight: 2 },
    { pattern: /<span/i, weight: 1 },
    { pattern: /class=["'][\w\s-]+["']/i, weight: 2 },
    { pattern: /id=["'][\w-]+["']/i, weight: 1 },
    { pattern: /<script/i, weight: 2 },
    { pattern: /<style/i, weight: 2 },
  ],
  css: [
    { pattern: /@media\b/, weight: 3 },
    { pattern: /@keyframes\b/, weight: 3 },
    { pattern: /:root\s*\{/, weight: 3 },
    { pattern: /[\.#\w-]+\s*\{\s*[\w-]+\s*:/, weight: 3 },
    { pattern: /margin|padding|color|background|display|flex|grid/i, weight: 1 },
  ],
  markdown: [
    { pattern: /^#\s+.+/, weight: 2 },
    { pattern: /^##\s+.+/, weight: 2 },
    { pattern: /\[.+\]\(https?:\/\/.+\)/, weight: 3 },
    { pattern: /^\s*-\s+.+/, weight: 1 },
    { pattern: /^\s*\d+\.\s+.+/, weight: 1 },
    { pattern: /^\s*>\s+.+/, weight: 2 },
    { pattern: /`[^`\n]+`/, weight: 1 },
    { pattern: /```[\s\S]*?```/, weight: 3 },
  ],
};

// Check shebang lines first
const SHEBANGS: Record<string, string> = {
  '#!/usr/bin/env python': 'python',
  '#!/usr/bin/python': 'python',
  '#!/usr/bin/env node': 'javascript',
  '#!/usr/bin/node': 'javascript',
  '#!/bin/bash': 'bash',
  '#!/bin/sh': 'bash',
  '#!/usr/bin/env bash': 'bash',
};

export function detectLanguage(code: string): LanguageDetectionResult {
  const trimmed = code.trim();
  if (!trimmed) {
    return { language: 'plaintext', confidence: 100, alternatives: [], method: 'heuristic' };
  }

  // 1. Check Shebang
  const firstLine = trimmed.split('\n')[0].trim();
  for (const [sb, lang] of Object.entries(SHEBANGS)) {
    if (firstLine.startsWith(sb)) {
      return {
        language: lang,
        confidence: 100,
        alternatives: [],
        method: 'shebang'
      };
    }
  }

  // 2. JSON check
  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.endsWith(trimmed.startsWith('{') ? '}' : ']')) {
    try {
      JSON.parse(trimmed);
      return {
        language: 'json',
        confidence: 100,
        alternatives: [],
        method: 'heuristic'
      };
    } catch {
      // Continue to heuristics
    }
  }

  // 3. Compute heuristic scores
  const scores: Record<string, number> = {};
  for (const lang of LANGUAGES) {
    if (lang === 'plaintext' || lang === 'json') continue;
    scores[lang] = 0;
  }

  // Run rules
  for (const [lang, rules] of Object.entries(RULES)) {
    for (const rule of rules) {
      const globalRegex = new RegExp(rule.pattern.source, rule.pattern.flags + 'g');
      const matches = trimmed.match(globalRegex);
      if (matches) {
        scores[lang] += matches.length * rule.weight;
      }
    }
  }

  // Disambiguation / Tuning
  if (scores.typescript > 0) {
    scores.typescript += scores.javascript * 0.7;
  }

  if (scores.cpp > 0) {
    scores.cpp += scores.c * 0.7;
  }

  if (scores.markdown > 3 && trimmed.includes('```')) {
    scores.markdown += 5;
  }

  // Sort candidates
  const candidates = Object.entries(scores)
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);

  if (candidates.length === 0) {
    return {
      language: 'plaintext',
      confidence: 100,
      alternatives: [],
      method: 'heuristic'
    };
  }

  const [topLang, topScore] = candidates[0];
  const secondScore = candidates[1]?.[1] || 0;
  
  let confidence = Math.min(
    100,
    Math.round((topScore / (topScore + secondScore + 0.1)) * 100)
  );

  if (topScore > 10 && confidence < 90) {
    confidence = Math.min(95, confidence + 10);
  }

  const alternatives = candidates.slice(1, 4).map(([lang, s]) => ({
    language: lang,
    confidence: Math.round((s / (topScore + s + 0.1)) * 100)
  }));

  return {
    language: topLang,
    confidence,
    alternatives,
    method: 'heuristic'
  };
}

export async function detectLanguageWithAI(
  code: string,
  aiServiceCall: (prompt: string) => Promise<string>
): Promise<LanguageDetectionResult> {
  try {
    const prompt = `Analyze this code snippet and determine its primary programming language.
Select EXACTLY one of: ${LANGUAGES.join(', ')}.
Output ONLY the language name, lowercase, with no other text, comments, markdown tags, or punctuation.

Code:
\`\`\`
${code.slice(0, 1000)}
\`\`\``;

    const result = await aiServiceCall(prompt);
    const cleaned = result.trim().toLowerCase();
    
    if (LANGUAGES.includes(cleaned)) {
      return {
        language: cleaned,
        confidence: 90,
        alternatives: [],
        method: 'ai'
      };
    }
  } catch (err) {
    console.error('AI language detection failed', err);
  }

  return detectLanguage(code);
}
