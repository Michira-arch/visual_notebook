import { executionClient, ExecuteResponse } from './executionClient';
import { ExecutionResult } from '../types';

export interface RichOutput {
  type: 'text' | 'html' | 'image' | 'table' | 'error';
  data: string;
}

// Maps our local languages to Piston API language identifiers
const PISTON_LANG_MAP: Record<string, { language: string; version: string }> = {
  python: { language: 'python', version: '3.10.0' },
  javascript: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
  rust: { language: 'rust', version: '1.68.2' },
  go: { language: 'go', version: '1.16.2' },
  java: { language: 'java', version: '15.0.2' },
  c: { language: 'c', version: '10.2.0' },
  cpp: { language: 'cpp', version: '10.2.0' },
  sql: { language: 'sqlite3', version: '3.36.0' },
  bash: { language: 'bash', version: '5.0.0' },
  json: { language: 'javascript', version: '18.15.0' }, // Run as JS
  yaml: { language: 'python', version: '3.10.0' }, // Run python yaml parser
};

/**
 * Main execution orchestrator
 */
export async function executeCellCode(
  cellId: string,
  language: string,
  code: string,
  registry: Record<string, any>
): Promise<ExecutionResult> {
  const start = Date.now();
  const lang = language.toLowerCase();

  // ─── Tier 1: Browser-Native JavaScript/TypeScript ───
  if (lang === 'javascript' || lang === 'js') {
    return runBrowserJS(code, registry);
  }

  // ─── Tier 2: Local Execution via Go termd ───
  try {
    const res = await executionClient.execute({
      cellId,
      language,
      code,
      registry,
      timeout: 15
    });

    if (res.status === 'no-compiler') {
      // Fallback to Tier 3: Remote Piston API
      return await runRemotePiston(cellId, language, code, registry);
    }

    return {
      status: res.status,
      tier: 'local',
      stdout: res.stdout,
      stderr: res.stderr,
      exitCode: res.exitCode,
      duration: res.duration,
      outputs: res.outputs || {}
    };
  } catch (err) {
    console.warn('Local execution failed, trying remote fallback...', err);
    return await runRemotePiston(cellId, language, code, registry);
  }
}

/**
 * Tier 1: Execute JS directly in the browser safely with captured console
 */
function runBrowserJS(code: string, registry: Record<string, any>): ExecutionResult {
  const start = Date.now();
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const outputs: Record<string, any> = {};

  // Custom console simulation to capture logs
  const customConsole = {
    log: (...args: any[]) => {
      stdoutLines.push(args.map(argToString).join(' '));
    },
    error: (...args: any[]) => {
      stderrLines.push(args.map(argToString).join(' '));
    },
    warn: (...args: any[]) => {
      stdoutLines.push('[WARN] ' + args.map(argToString).join(' '));
    },
    info: (...args: any[]) => {
      stdoutLines.push('[INFO] ' + args.map(argToString).join(' '));
    }
  };

  const vnb = {
    set: (name: string, value: any) => {
      outputs[name] = value;
    },
    get: (name: string) => {
      return registry[name];
    },
    list: () => {
      return Object.keys(registry);
    }
  };

  try {
    // Create execution scope
    const fn = new Function('console', 'vnb', `
      try {
        ${code}
      } catch (err) {
        throw err;
      }
    `);

    fn(customConsole, vnb);

    return {
      status: 'success',
      tier: 'browser',
      stdout: stdoutLines.join('\n'),
      stderr: stderrLines.join('\n'),
      exitCode: 0,
      duration: Date.now() - start,
      outputs
    };
  } catch (err: any) {
    return {
      status: 'error',
      tier: 'browser',
      stdout: stdoutLines.join('\n'),
      stderr: err.stack || err.message || String(err),
      exitCode: 1,
      duration: Date.now() - start,
      outputs
    };
  }
}

function argToString(arg: any): string {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

/**
 * Tier 3: Execute remotely using the free Piston API
 */
async function runRemotePiston(
  cellId: string,
  language: string,
  code: string,
  registry: Record<string, any>
): Promise<ExecutionResult> {
  const start = Date.now();
  const mapped = PISTON_LANG_MAP[language.toLowerCase()];

  if (!mapped) {
    return {
      status: 'no-compiler',
      tier: 'remote',
      stdout: '',
      stderr: `No local compiler found and remote execution is not supported for language: ${language}`,
      exitCode: -1,
      duration: Date.now() - start,
      outputs: {}
    };
  }

  // Prepend registry injections if needed for Python/JS remote runs
  let finalCode = code;
  const langLower = language.toLowerCase();
  if (langLower === 'python' || langLower === 'py') {
    const regJSON = JSON.stringify(registry);
    finalCode = `
import json as _json, sys as _sys
class vnb:
    _registry = _json.loads('''${regJSON}''')
    @staticmethod
    def get(name):
        return vnb._registry.get(name)
    @staticmethod
    def set(name, value):
        print(f"__VNB_SET__:{_json.dumps({'name': name, 'value': value})}")
    @staticmethod
    def list():
        return list(vnb._registry.keys())

# User Code:
${code}
`;
  } else if (langLower === 'javascript' || langLower === 'js') {
    const regJSON = JSON.stringify(registry);
    finalCode = `
const __vnb_registry__ = JSON.parse('${regJSON}');
const vnb = {
  get(name) { return __vnb_registry__[name]; },
  set(name, value) { 
    console.log("__VNB_SET__:" + JSON.stringify({ name, value }));
  },
  list() { return Object.keys(__vnb_registry__); }
};

// User Code:
${code}
`;
  }

  try {
    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        language: mapped.language,
        version: mapped.version,
        files: [
          {
            name: 'main',
            content: finalCode
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Piston API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const runResult = data.run || {};
    
    // Parse stdout for __VNB_SET__ markers
    const rawStdout = runResult.stdout || '';
    const cleanLines: string[] = [];
    const outputs: Record<string, any> = {};

    rawStdout.split('\n').forEach((line: string) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('__VNB_SET__:')) {
        try {
          const jsonStr = trimmed.substring('__VNB_SET__:'.length);
          const update = JSON.parse(jsonStr);
          if (update && update.name) {
            outputs[update.name] = update.value;
          }
        } catch {}
      } else {
        cleanLines.push(line);
      }
    });

    return {
      status: runResult.code === 0 ? 'success' : 'error',
      tier: 'remote',
      stdout: cleanLines.join('\n'),
      stderr: runResult.stderr || '',
      exitCode: runResult.code !== undefined ? runResult.code : -1,
      duration: Date.now() - start,
      outputs
    };
  } catch (err: any) {
    return {
      status: 'error',
      tier: 'remote',
      stdout: '',
      stderr: `Remote execution failed: ${err.message || String(err)}`,
      exitCode: -1,
      duration: Date.now() - start,
      outputs: {}
    };
  }
}
