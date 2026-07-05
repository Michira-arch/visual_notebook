/**
 * serverClient.ts
 * ---------------
 * Centralised helpers for talking to the local Python backend.
 * All WebSocket connections and HTTP calls go through here so the
 * secret token is always injected in one place.
 */

const TOKEN: string = (typeof process !== 'undefined' && process.env.APP_SECRET_TOKEN) || '';

/** ws://localhost:8765?token=<TOKEN> */
export function wsUrl(): string {
  return `ws://localhost:8765?token=${encodeURIComponent(TOKEN)}`;
}

/** ws://localhost:8767?token=<TOKEN> — Go PTY terminal (experimental) */
export function goTermdWsUrl(): string {
  return `ws://localhost:8767?token=${encodeURIComponent(TOKEN)}`;
}

/** Fetch against the HTTP API (localhost:8766) with the token header. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers as HeadersInit);
  headers.set('X-App-Token', TOKEN);
  return fetch(`http://localhost:8766${path}`, { ...init, headers });
}
