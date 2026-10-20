"""Local teaching server; no accounts or persistent storage. Bind to loopback only."""
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from client import ModelError, stream_text

ROOT = Path(__file__).resolve().parent
SYSTEM = {"role": "system", "content": "你是初学者的学习助手。简短解释 AI 概念，给一个例子。资料不足时说明，不编造来源。"}


def messages_for(data):
    if not isinstance(data, dict) or set(data) != {"message", "history"}:
        raise ValueError("请求需要 message 和 history。")
    message = data["message"]
    history = data["history"]
    if not isinstance(message, str) or not message.strip() or len(message) > 1000:
        raise ValueError("问题需为 1 至 1000 个字符。")
    if not isinstance(history, list) or len(history) > 4 or len(history) % 2:
        raise ValueError("历史最多保留两轮完整问答。")
    for index, item in enumerate(history):
        if not isinstance(item, dict) or set(item) != {"role", "content"}:
            raise ValueError("历史格式不正确。")
        if item["role"] != ("user" if index % 2 == 0 else "assistant"):
            raise ValueError("历史必须按用户、助手顺序成对出现。")
        if not isinstance(item["content"], str) or not item["content"].strip() or len(item["content"]) > 12000:
            raise ValueError("历史内容无效或过长。")
    return [SYSTEM, *history, {"role": "user", "content": message.strip()}]


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/":
            self.send_error(404)
            return
        body = (ROOT / "index.html").read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def event(self, kind, data):
        self.wfile.write(f"event: {kind}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode("utf-8"))
        self.wfile.flush()

    def do_POST(self):
        if self.path != "/chat":
            self.send_error(404)
            return
        # Browsers may submit only from the local page served by this process.
        origin = self.headers.get("Origin")
        if origin and origin != "http://127.0.0.1:8765":
            self.send_error(403)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 200000 or self.headers.get_content_type() != "application/json":
                raise ValueError("请求格式或大小无效。")
            messages = messages_for(json.loads(self.rfile.read(length)))
        except (ValueError, TypeError, UnicodeDecodeError) as error:
            self.send_error(400, "Invalid request")
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        try:
            with closing(stream_text(messages)) as stream:
                for part in stream:
                    self.event("delta", {"text": part})
            self.event("done", {})
        except ModelError as error:
            try:
                self.event("error", {"message": str(error)})
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        finally:
            self.close_connection = True


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8765), Handler)
    print("本地学习助手：http://127.0.0.1:8765；默认模拟模式，Ctrl+C 停止。")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
