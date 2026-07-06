import { goTermdWsUrl } from '../serverClient';

export interface ExecuteRequest {
  cellId: string;
  language: string;
  code: string;
  registry: Record<string, any>;
  timeout?: number;
}

export interface ExecuteResponse {
  cellId: string;
  status: 'success' | 'error' | 'timeout' | 'no-compiler';
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number; // in ms
  outputs: Record<string, any>; // parsed variables
}

class ExecutionClient {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, (res: ExecuteResponse) => void>();
  private pendingCompilers: ((compilers: Record<string, string>) => void)[] = [];
  private connecting = false;
  private connectPromise: Promise<void> | null = null;

  private connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.connecting && this.connectPromise) {
      return this.connectPromise;
    }

    this.connecting = true;
    this.connectPromise = new Promise<void>((resolve, reject) => {
      try {
        const url = goTermdWsUrl();
        const ws = new WebSocket(url);
        
        ws.onopen = () => {
          this.ws = ws;
          this.connecting = false;
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'execute_result') {
              const callback = this.pendingRequests.get(data.cellId);
              if (callback) {
                callback(data as ExecuteResponse);
                this.pendingRequests.delete(data.cellId);
              }
            } else if (data.type === 'compilers_result') {
              const list = [...this.pendingCompilers];
              this.pendingCompilers = [];
              list.forEach(cb => cb(data.compilers || {}));
            }
          } catch (err) {
            console.error('Failed to parse WS execution message', err);
          }
        };

        ws.onclose = () => {
          this.ws = null;
          this.connecting = false;
          // Reject any pending requests since connection was lost
          this.rejectAllPending('Connection closed');
        };

        ws.onerror = (err) => {
          this.connecting = false;
          reject(err);
        };
      } catch (err) {
        this.connecting = false;
        reject(err);
      }
    });

    return this.connectPromise;
  }

  private rejectAllPending(reason: string) {
    this.pendingRequests.forEach((resolve, cellId) => {
      resolve({
        cellId,
        status: 'error',
        stdout: '',
        stderr: `Execution failed: ${reason}`,
        exitCode: -1,
        duration: 0,
        outputs: {}
      });
    });
    this.pendingRequests.clear();
    
    const list = [...this.pendingCompilers];
    this.pendingCompilers = [];
    list.forEach(cb => cb({}));
  }

  public async execute(req: ExecuteRequest): Promise<ExecuteResponse> {
    await this.connect();
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket connection not open');
    }

    return new Promise<ExecuteResponse>((resolve) => {
      this.pendingRequests.set(req.cellId, resolve);
      this.ws!.send(JSON.stringify({
        type: 'execute_code',
        cellId: req.cellId,
        language: req.language,
        code: req.code,
        registry: req.registry,
        timeout: req.timeout || 15
      }));
    });
  }

  public async detectCompilers(): Promise<Record<string, string>> {
    await this.connect();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return {};
    }

    return new Promise<Record<string, string>>((resolve) => {
      this.pendingCompilers.push(resolve);
      this.ws!.send(JSON.stringify({
        type: 'detect_compilers'
      }));
    });
  }
}

export const executionClient = new ExecutionClient();
export default executionClient;
