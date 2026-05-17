import asyncio
import websockets
import json
import os
import secrets
import subprocess
import threading
import signal
import sqlite3
import re
from aiohttp import web

# ---------------------------------------------------------------------------
# Load .env file
# ---------------------------------------------------------------------------
def _load_env():
    if os.path.exists('.env'):
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ[k.strip()] = v.strip().strip('"\'')
_load_env()

# ---------------------------------------------------------------------------
# Secret token — set APP_SECRET_TOKEN in .env to fix it across restarts.
# If absent, a random one is generated each run and printed to the console.
# ---------------------------------------------------------------------------
TOKEN: str = os.environ.get("APP_SECRET_TOKEN", "")
if not TOKEN:
    TOKEN = secrets.token_hex(32)
    print(f"\n{'='*60}")
    print(f"  APP_SECRET_TOKEN not set — generated for this session:")
    print(f"  {TOKEN}")
    print(f"  Add it to your .env to make it permanent.")
    print(f"{'='*60}\n")

# ---------------------------------------------------------------------------
# Command denylist for agent_execute — block obviously destructive patterns
# ---------------------------------------------------------------------------
_BLOCKED = re.compile(
    r"""(
        rm\s+-[rf]{1,3}\s+/          # rm -rf /
      | del\s+/[fqs]                  # del /f /q /s
      | format\s+[a-z]:               # format c:
      | rd\s+/s\s+/q                  # rd /s /q
      | rmdir\s+/s                    # rmdir /s
      | reg\s+delete                  # reg delete
      | shutdown\s+/                  # shutdown /r /s
      | :\(\)\{.*\}                   # fork bomb
      | curl.*\|\s*(ba)?sh            # curl | bash
      | wget.*\|\s*(ba)?sh            # wget | bash
    )""",
    re.IGNORECASE | re.VERBOSE,
)

def _is_command_blocked(cmd: str) -> bool:
    return bool(_BLOCKED.search(cmd))

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
def init_db():
    conn = sqlite3.connect('notebooks.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS notebooks
                 (id TEXT PRIMARY KEY, name TEXT, updated_at INTEGER, data TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS researches
                 (id TEXT PRIMARY KEY, title TEXT, author TEXT, updated_at INTEGER, data TEXT)''')
    conn.commit()
    conn.close()

init_db()

connected_clients: set = set()

# ---------------------------------------------------------------------------
# Port cleanup — kill stale processes from a previous run (Windows)
# ---------------------------------------------------------------------------
def kill_port(port: int):
    """Terminate any process currently listening on *port* (Windows-safe)."""
    try:
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True, text=True
        )
        for line in result.stdout.splitlines():
            if f':{port}' in line and 'LISTENING' in line:
                parts = line.strip().split()
                pid = int(parts[-1])
                if pid > 0:
                    subprocess.run(['taskkill', '/F', '/PID', str(pid)],
                                   capture_output=True)
                    print(f"[startup] Killed stale process PID {pid} on port {port}")
    except Exception as e:
        print(f"[startup] Could not release port {port}: {e}")

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def _check_token(tok: str) -> bool:
    """Constant-time comparison to prevent timing attacks."""
    return secrets.compare_digest(tok, TOKEN)

def _ws_token_ok(websocket) -> bool:
    """Extract ?token=... from the WebSocket request path."""
    path = getattr(websocket, 'path', '') or getattr(getattr(websocket, 'request', None), 'path', '') or ''
    match = re.search(r'[?&]token=([^&]+)', path)
    if not match:
        return False
    return _check_token(match.group(1))

def _origin_ok(websocket) -> bool:
    """Only allow connections from localhost origins (or no origin header)."""
    origin = websocket.request_headers.get("Origin", "")
    if not origin:
        return True  # Non-browser clients (node, python scripts) have no Origin
    return "localhost" in origin or "127.0.0.1" in origin

# ---------------------------------------------------------------------------
# Terminal session — uses a PowerShell subprocess with proper signal handling
# ---------------------------------------------------------------------------
class TerminalSession:
    def __init__(self, websocket):
        self.ws = websocket
        self.process = None
        self.loop = asyncio.get_event_loop()
        self._dead = False

    def start(self):
        # Do NOT use CREATE_NEW_PROCESS_GROUP — it prevents Ctrl+C propagation.
        # Instead, run powershell in a normal process group so GenerateConsoleCtrlEvent works.
        self.process = subprocess.Popen(
            ["powershell.exe", "-NoProfile", "-NoLogo"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=0,
            text=False,
        )
        self.thread = threading.Thread(target=self.read_output, daemon=True)
        self.thread.start()

    def read_output(self):
        try:
            while not self._dead:
                chunk = self.process.stdout.read(1024)
                if not chunk:
                    break
                text = chunk.decode('utf-8', errors='replace')
                try:
                    asyncio.run_coroutine_threadsafe(
                        self.ws.send(json.dumps({"type": "output", "data": text})),
                        self.loop
                    )
                except Exception:
                    break
        except Exception as e:
            if not self._dead:
                print(f"Error reading output: {e}")
        finally:
            if not self._dead:
                try:
                    asyncio.run_coroutine_threadsafe(
                        self.ws.send(json.dumps({"type": "exit"})),
                        self.loop
                    )
                except Exception:
                    pass

    def write_input(self, data):
        if self._dead or not self.process or not self.process.stdin:
            return
        try:
            if data == '\x03':  # Ctrl+C
                # Send a 'taskkill' of the foreground process tree.
                # Since we can't use CTRL_C_EVENT reliably with piped stdin,
                # we write the Ctrl+C character directly to PowerShell's stdin.
                # PowerShell will interpret it as a cancel of the current pipeline.
                self.process.stdin.write(b'\x03')
                self.process.stdin.flush()
            else:
                self.process.stdin.write(data.encode('utf-8'))
                self.process.stdin.flush()
        except (BrokenPipeError, OSError):
            self._dead = True

    def terminate(self):
        self._dead = True
        if self.process:
            try:
                # Kill the entire process tree so child processes don't linger
                if os.name == 'nt':
                    subprocess.run(
                        ['taskkill', '/F', '/T', '/PID', str(self.process.pid)],
                        capture_output=True
                    )
                else:
                    self.process.terminate()
            except Exception:
                pass
            try:
                self.process.stdin.close()
            except Exception:
                pass

# ---------------------------------------------------------------------------
# Connection types — separate terminals from lightweight WS clients
# ---------------------------------------------------------------------------
# Not every connection needs a terminal (e.g. AgentChat opening a WS just
# to send a whatsapp message). We only spawn a terminal when the client
# sends its first "input" message.

class ClientConnection:
    """Tracks a single WS client, optionally with a terminal session."""
    def __init__(self, websocket):
        self.ws = websocket
        self.terminal: TerminalSession | None = None

    def ensure_terminal(self):
        if not self.terminal:
            self.terminal = TerminalSession(self.ws)
            self.terminal.start()
        return self.terminal

    def terminate(self):
        if self.terminal:
            self.terminal.terminate()

# ---------------------------------------------------------------------------
# WebSocket handler
# ---------------------------------------------------------------------------
async def handler(websocket):
    # 1. Origin check
    if not _origin_ok(websocket):
        print(f"Rejected connection: bad origin {websocket.request_headers.get('Origin')}")
        await websocket.close(1008, "Forbidden: bad origin")
        return

    # 2. Token check
    if not _ws_token_ok(websocket):
        print("Rejected connection: invalid or missing token")
        await websocket.close(1008, "Forbidden: invalid token")
        return

    client = ClientConnection(websocket)
    connected_clients.add(websocket)

    try:
        async for message in websocket:
            data = json.loads(message)
            msg_type = data.get("type", "")

            if msg_type == "input":
                # Lazy-init: only spawn a terminal when a terminal tab actually sends input
                term = client.ensure_terminal()
                term.write_input(data.get("data", ""))

            elif msg_type == "agent_execute":
                cmd = data.get("command", "")
                request_id = data.get("id", "none")

                if _is_command_blocked(cmd):
                    await websocket.send(json.dumps({
                        "type": "agent_result",
                        "id": request_id,
                        "output": f"[BLOCKED] Command matched the security denylist and was not executed."
                    }))
                    continue

                async def run_agent_cmd():
                    try:
                        proc = await asyncio.create_subprocess_shell(
                            cmd,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.STDOUT
                        )
                        output = []

                        async def broadcast(btype, bdata):
                            for c in list(connected_clients):
                                try:
                                    await c.send(json.dumps({"type": btype, "data": bdata}))
                                except Exception:
                                    pass

                        await broadcast("output", f"\r\n\x1b[33m[Agent Executing]: {cmd}\x1b[0m\r\n")

                        while True:
                            line = await proc.stdout.readline()
                            if not line:
                                break
                            text = line.decode('utf-8', errors='replace')
                            output.append(text)
                            await broadcast("output", text.replace('\n', '\r\n'))

                        await proc.wait()
                        full_output = "".join(output)
                        await broadcast("output", "\x1b[32m[Agent Execution Finished]\x1b[0m\r\n")

                        await websocket.send(json.dumps({
                            "type": "agent_result",
                            "id": request_id,
                            "output": full_output
                        }))
                    except Exception as e:
                        await websocket.send(json.dumps({
                            "type": "agent_result",
                            "id": request_id,
                            "output": f"Error: {e}"
                        }))

                asyncio.create_task(run_agent_cmd())

            elif msg_type.startswith("whatsapp_") or msg_type in ["request_whatsapp_status", "send_whatsapp_message"]:
                # Relay to ALL other connected clients
                for c in list(connected_clients):
                    if c != websocket:
                        try:
                            await c.send(message)
                        except Exception:
                            pass

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        client.terminate()

# ---------------------------------------------------------------------------
# HTTP API
# ---------------------------------------------------------------------------
async def main():
    port = 8765
    print(f"Starting terminal WebSocket server on ws://localhost:{port}")

    app = web.Application()

    ALLOWED_ORIGIN = "http://localhost:3000"

    def add_cors_headers(response):
        response.headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGIN
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-App-Token'
        return response

    def _http_token_ok(request: web.Request) -> bool:
        return _check_token(request.headers.get("X-App-Token", ""))

    def _unauthorized():
        return web.Response(status=401, text="Unauthorized")

    async def options_handler(request):
        return add_cors_headers(web.Response(status=200))

    async def get_notebooks_meta(request):
        if not _http_token_ok(request):
            return _unauthorized()
        conn = sqlite3.connect('notebooks.db')
        c = conn.cursor()
        c.execute("SELECT id, name, updated_at FROM notebooks ORDER BY updated_at DESC")
        rows = c.fetchall()
        conn.close()
        meta_list = [{"id": r[0], "name": r[1], "updatedAt": r[2]} for r in rows]
        return add_cors_headers(web.json_response(meta_list))

    async def get_notebook(request):
        if not _http_token_ok(request):
            return _unauthorized()
        nb_id = request.match_info['id']
        conn = sqlite3.connect('notebooks.db')
        c = conn.cursor()
        c.execute("SELECT data FROM notebooks WHERE id=?", (nb_id,))
        row = c.fetchone()
        conn.close()
        if row:
            return add_cors_headers(web.json_response(json.loads(row[0])))
        return add_cors_headers(web.Response(status=404, text="Notebook not found"))

    async def save_notebook(request):
        if not _http_token_ok(request):
            return _unauthorized()
        data = await request.json()
        nb_id = data.get('id')
        name = data.get('name', 'Untitled')
        updated_at = data.get('updatedAt', 0)
        conn = sqlite3.connect('notebooks.db')
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO notebooks (id, name, updated_at, data) VALUES (?, ?, ?, ?)",
                  (nb_id, name, updated_at, json.dumps(data)))
        conn.commit()
        conn.close()
        return add_cors_headers(web.json_response({"status": "ok"}))

    async def delete_notebook_handler(request):
        if not _http_token_ok(request):
            return _unauthorized()
        nb_id = request.match_info['id']
        conn = sqlite3.connect('notebooks.db')
        c = conn.cursor()
        c.execute("DELETE FROM notebooks WHERE id=?", (nb_id,))
        conn.commit()
        conn.close()
        return add_cors_headers(web.json_response({"status": "ok"}))

    async def get_researches_meta(request):
        if not _http_token_ok(request):
            return _unauthorized()
        conn = sqlite3.connect('notebooks.db')
        c = conn.cursor()
        c.execute("SELECT id, title, author, updated_at FROM researches ORDER BY updated_at DESC")
        rows = c.fetchall()
        conn.close()
        meta_list = [{"id": r[0], "title": r[1], "author": r[2], "updatedAt": r[3]} for r in rows]
        return add_cors_headers(web.json_response(meta_list))

    async def get_research(request):
        if not _http_token_ok(request):
            return _unauthorized()
        r_id = request.match_info['id']
        conn = sqlite3.connect('notebooks.db')
        c = conn.cursor()
        c.execute("SELECT data FROM researches WHERE id=?", (r_id,))
        row = c.fetchone()
        conn.close()
        if row:
            return add_cors_headers(web.json_response(json.loads(row[0])))
        return add_cors_headers(web.Response(status=404, text="Research not found"))

    async def save_research(request):
        if not _http_token_ok(request):
            return _unauthorized()
        data = await request.json()
        r_id = data.get('id')
        title = data.get('title', 'Untitled')
        author = data.get('author', 'Unknown')
        updated_at = data.get('updatedAt', 0)
        conn = sqlite3.connect('notebooks.db')
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO researches (id, title, author, updated_at, data) VALUES (?, ?, ?, ?, ?)",
                  (r_id, title, author, updated_at, json.dumps(data)))
        conn.commit()
        conn.close()
        return add_cors_headers(web.json_response({"status": "ok"}))

    async def delete_research_handler(request):
        if not _http_token_ok(request):
            return _unauthorized()
        r_id = request.match_info['id']
        conn = sqlite3.connect('notebooks.db')
        c = conn.cursor()
        c.execute("DELETE FROM researches WHERE id=?", (r_id,))
        conn.commit()
        conn.close()
        return add_cors_headers(web.json_response({"status": "ok"}))

    app.router.add_options('/api/notebooks', options_handler)
    app.router.add_options('/api/notebooks/{id}', options_handler)
    app.router.add_get('/api/notebooks', get_notebooks_meta)
    app.router.add_get('/api/notebooks/{id}', get_notebook)
    app.router.add_post('/api/notebooks', save_notebook)
    app.router.add_delete('/api/notebooks/{id}', delete_notebook_handler)

    app.router.add_options('/api/researches', options_handler)
    app.router.add_options('/api/researches/{id}', options_handler)
    app.router.add_get('/api/researches', get_researches_meta)
    app.router.add_get('/api/researches/{id}', get_research)
    app.router.add_post('/api/researches', save_research)
    app.router.add_delete('/api/researches/{id}', delete_research_handler)

    # Free ports from any previous run before binding
    kill_port(8766)
    kill_port(8765)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', 8766)
    await site.start()
    print(f"Starting API HTTP server on http://localhost:8766")

    async with websockets.serve(handler, "localhost", port):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
