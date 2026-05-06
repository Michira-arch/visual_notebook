import asyncio
import websockets
import json
import os
import subprocess
import threading
import signal

connected_clients = set()

class TerminalSession:
    def __init__(self, websocket):
        self.ws = websocket
        self.process = None
        self.loop = asyncio.get_event_loop()

    def start(self):
        # Start a powershell process
        self.process = subprocess.Popen(
            ["powershell.exe", "-NoProfile"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            bufsize=0,
            text=False, # Read as bytes so we can decode on the fly
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
        )
        
        # Start a thread to read output
        self.thread = threading.Thread(target=self.read_output, daemon=True)
        self.thread.start()

    def read_output(self):
        try:
            while True:
                # Read char by char or chunk by chunk
                chunk = self.process.stdout.read(1024)
                if not chunk:
                    break
                # Send to websocket
                text = chunk.decode('utf-8', errors='replace')
                asyncio.run_coroutine_threadsafe(self.ws.send(json.dumps({"type": "output", "data": text})), self.loop)
        except Exception as e:
            print(f"Error reading output: {e}")
        finally:
            asyncio.run_coroutine_threadsafe(self.ws.send(json.dumps({"type": "exit"})), self.loop)

    def write_input(self, data):
        if self.process and self.process.stdin:
            if data == '\x03': # Ctrl+C
                if os.name == 'nt':
                    self.process.send_signal(signal.CTRL_C_EVENT)
                else:
                    self.process.send_signal(signal.SIGINT)
            else:
                self.process.stdin.write(data.encode('utf-8'))
                self.process.stdin.flush()

    def terminate(self):
        if self.process:
            try:
                self.process.terminate()
            except:
                pass

async def handler(websocket):
    print("New client connected to terminal server")
    connected_clients.add(websocket)
    session = TerminalSession(websocket)
    session.start()
    
    try:
        async for message in websocket:
            data = json.loads(message)
            if data.get("type") == "input":
                session.write_input(data.get("data", ""))
            elif data.get("type") == "agent_execute":
                cmd = data.get("command", "")
                request_id = data.get("id", "none")
                
                # We will run it in a separate process so we can capture and stream it explicitly.
                # It will still show up in the terminal UI because we send the output there.
                async def run_agent_cmd():
                    try:
                        proc = await asyncio.create_subprocess_shell(
                            cmd,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.STDOUT
                        )
                        output = []
                        
                        async def broadcast(msg_type, data):
                            for client in list(connected_clients):
                                try:
                                    await client.send(json.dumps({"type": msg_type, "data": data}))
                                except Exception:
                                    pass

                        # Print header
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
                        await broadcast("output", f"\x1b[32m[Agent Execution Finished]\x1b[0m\r\n")
                        
                        # Send result ONLY to the requesting websocket
                        await websocket.send(json.dumps({"type": "agent_result", "id": request_id, "output": full_output}))
                    except Exception as e:
                        await websocket.send(json.dumps({"type": "agent_result", "id": request_id, "output": f"Error: {e}"}))
                        
                asyncio.create_task(run_agent_cmd())
                
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
    finally:
        connected_clients.remove(websocket)
        session.terminate()

async def main():
    port = 8765
    print(f"Starting terminal WebSocket server on ws://localhost:{port}")
    async with websockets.serve(handler, "localhost", port):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
