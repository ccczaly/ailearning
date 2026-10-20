"""Read-only MCP 2025-11-25 stdio subset for teaching, not a complete SDK."""
import json
from pathlib import Path
import subprocess
import sys

VERSION = "2025-11-25"
URI = "course://rag/introduction"
TEXT = "RAG 先检索可访问的资料，再依据资料组织回答。"


class RpcError(Exception):
    def __init__(self, code, message):
        self.code, self.message = code, message


class Server:
    def __init__(self):
        self.negotiated = False
        self.ready = False

    def result_for(self, method, params):
        if not isinstance(params, dict):
            raise RpcError(-32602, "Invalid params")
        if method == "initialize":
            if not isinstance(params.get("protocolVersion"), str) or not isinstance(params.get("capabilities"), dict) or not isinstance(params.get("clientInfo"), dict):
                raise RpcError(-32602, "Invalid initialize params")
            self.negotiated = True
            return {"protocolVersion": VERSION, "serverInfo": {"name": "course-demo", "version": "1.0"},
                    "capabilities": {"tools": {}, "resources": {}, "prompts": {}}}
        if method == "ping":
            return {}
        if not self.ready:
            raise RpcError(-32000, "Initialize this version before capability requests")
        if method == "tools/list":
            return {"tools": [{"name": "course_summary", "description": "读取公开 RAG 课程简介", "inputSchema": {
                "type": "object", "properties": {"code": {"type": "string", "enum": ["rag"]}},
                "required": ["code"], "additionalProperties": False}}]}
        if method == "tools/call":
            if params.get("name") != "course_summary":
                raise RpcError(-32602, "Unknown tool")
            args = params.get("arguments")
            if not isinstance(args, dict) or set(args) != {"code"} or not isinstance(args["code"], str):
                raise RpcError(-32602, "Invalid tool arguments")
            if args["code"] != "rag":
                return {"isError": True, "content": [{"type": "text", "text": "公开课程不存在"}]}
            return {"content": [{"type": "text", "text": TEXT}], "isError": False}
        if method == "resources/list":
            return {"resources": [{"uri": URI, "name": "RAG 入门", "mimeType": "text/plain"}]}
        if method == "resources/read":
            if params.get("uri") != URI:
                raise RpcError(-32602, "Resource unavailable")
            return {"contents": [{"uri": URI, "mimeType": "text/plain", "text": TEXT}]}
        if method == "prompts/list":
            return {"prompts": [{"name": "review", "description": "生成复习提问模板", "arguments": [
                {"name": "topic", "description": "要复习的主题", "required": True}]}]}
        if method == "prompts/get":
            args = params.get("arguments")
            if params.get("name") != "review" or not isinstance(args, dict) or set(args) != {"topic"}:
                raise RpcError(-32602, "Invalid prompt")
            topic = args["topic"]
            if not isinstance(topic, str) or not topic.strip() or len(topic) > 100:
                raise RpcError(-32602, "Invalid topic")
            return {"messages": [{"role": "user", "content": {"type": "text", "text": f"请围绕主题提出一道复习问题：{topic}"}}]}
        raise RpcError(-32601, "Method not found")

    def handle(self, message):
        if not isinstance(message, dict) or message.get("jsonrpc") != "2.0" or not isinstance(message.get("method"), str):
            return {"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Invalid Request"}}
        identity = message.get("id")
        if "id" not in message:
            if message["method"] == "notifications/initialized" and self.negotiated:
                self.ready = True
            return None
        if type(identity) not in (int, str) and identity is not None:
            return {"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Invalid Request id"}}
        try:
            result = self.result_for(message["method"], message.get("params", {}))
            return {"jsonrpc": "2.0", "id": identity, "result": result}
        except RpcError as error:
            return {"jsonrpc": "2.0", "id": identity, "error": {"code": error.code, "message": error.message}}


def serve():
    # The protocol is UTF-8 even when a Windows terminal defaults to another encoding.
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    server = Server()
    for line in sys.stdin:
        try:
            response = server.handle(json.loads(line))
        except ValueError:
            response = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}
        if response is not None:
            print(json.dumps(response, ensure_ascii=False), flush=True)


def demo_exchange(extra=None):
    messages = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": VERSION, "capabilities": {}, "clientInfo": {"name": "demo-client", "version": "1.0"}}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
    ]
    messages.extend(extra if extra is not None else [
        {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "course_summary", "arguments": {"code": "rag"}}}])
    with subprocess.Popen([sys.executable, "-X", "utf8", str(Path(__file__).resolve()), "serve"], stdin=subprocess.PIPE,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8") as process:
        try:
            stdout, stderr = process.communicate("".join(json.dumps(message, ensure_ascii=False) + "\n" for message in messages), timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate()
            raise RuntimeError("本地服务未及时关闭") from None
        if process.returncode:
            raise RuntimeError("本地协议服务运行失败")
    return [json.loads(line) for line in stdout.splitlines()]


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        serve()
    else:
        print("MCP 2025-11-25 只读 stdio 子集；未调用模型与远程服务。")
        for response in demo_exchange():
            print(json.dumps(response, ensure_ascii=False))
