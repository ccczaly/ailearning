"""Local teaching probes. The readiness dependency is simulated, not a real DB."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os


class Probe(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in {"/live", "/ready"}:
            self.send_error(404)
            return
        ready = self.path == "/live" or os.environ.get("DEMO_DATABASE_OK", "1") == "1"
        body = json.dumps({"status": "UP" if ready else "DOWN", "mode": "simulated_dependency"}).encode()
        self.send_response(200 if ready else 503)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    host = os.environ.get("APP_HOST", "127.0.0.1")
    if host not in {"127.0.0.1", "0.0.0.0"}:
        raise ValueError("不支持的教学绑定地址")
    port = int(os.environ.get("APP_PORT", "8765"))
    if not 1 <= port <= 65535:
        raise ValueError("端口无效")
    server = ThreadingHTTPServer((host, port), Probe)
    print(f"教学探针 http://{host}:{port}/live 与 /ready；非生产服务器。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
