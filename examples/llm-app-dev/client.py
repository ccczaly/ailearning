"""Python 3.11+, standard library only. Mock by default; opt in with LLM_LIVE=1."""
from dataclasses import dataclass
import json
import os
import socket
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class ModelError(Exception):
    pass


@dataclass
class Result:
    text: str
    finish_reason: str
    usage: dict


def _mock():
    return os.environ.get("LLM_LIVE") != "1"


def _request(messages, stream=False, json_mode=False):
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not key:
        raise ModelError("请在当前终端设置 DEEPSEEK_API_KEY。")
    payload = {
        "model": os.environ.get("DEEPSEEK_MODEL", "deepseek-flash"),
        "messages": messages,
        "max_tokens": 512,
        "thinking": {"type": "disabled"},
        "stream": stream,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    return Request(
        "https://api.deepseek.com/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )


def _network_error(error):
    if isinstance(error, HTTPError):
        status = error.code
        error.close()
        return ModelError({401: "模型凭据无效，请检查 Key。", 402: "模型账户余额不足。",
                           429: "请求过于频繁，请稍后主动重试。"}.get(status, f"模型服务请求失败（HTTP {status}）。"))
    return ModelError("模型连接失败或等待超时，请检查网络后主动重试。")


def _mock_text(messages):
    question = messages[-1]["content"]
    return f"【本地模拟，未调用模型】你问：{question}\n这是用于检查页面与请求流程的演示回答，不是模型生成的知识解释。"


def complete(messages, json_mode=False):
    if _mock():
        text = json.dumps({"question": "上下文窗口限制什么？", "options": ["本次可处理的信息量", "屏幕宽度", "Python 变量名"], "answer": 0}, ensure_ascii=False) if json_mode else _mock_text(messages)
        return Result(text, "stop", {})
    request = _request(messages, json_mode=json_mode)
    try:
        with urlopen(request, timeout=30) as response:
            data = json.load(response)
        choice = data["choices"][0]
        text = choice["message"]["content"]
        if choice["finish_reason"] != "stop" or not isinstance(text, str) or not text.strip():
            raise ModelError("回答为空或未完整生成，请调整问题后重试。")
        return Result(text, choice["finish_reason"], data.get("usage") or {})
    except (HTTPError, URLError, TimeoutError, socket.timeout, OSError) as error:
        raise _network_error(error) from None
    except (ValueError, KeyError, IndexError, TypeError) as error:
        raise ModelError("模型响应格式异常。") from None


def _events(lines):
    """Parse SSE data fields, including multi-line events and comment keep-alives."""
    data = []
    for raw in lines:
        line = raw.decode("utf-8").rstrip("\r\n")
        if not line:
            if data:
                yield "\n".join(data)
                data.clear()
        elif line.startswith("data:"):
            value = line[5:]
            data.append(value[1:] if value.startswith(" ") else value)
    if data:
        yield "\n".join(data)


def _stream_parts(lines):
    finish = None
    has_text = False
    for event in _events(lines):
        if event == "[DONE]":
            if finish != "stop" or not has_text:
                raise ModelError("回答为空或生成被截断。")
            return
        data = json.loads(event)
        if data.get("error"):
            raise ModelError("模型流式响应失败。")
        choices = data.get("choices") or []
        if not choices:
            continue
        choice = choices[0]
        finish = choice.get("finish_reason") or finish
        part = choice.get("delta", {}).get("content")
        if part is not None:
            if not isinstance(part, str):
                raise ModelError("模型流式响应格式异常。")
            has_text = has_text or bool(part.strip())
            if part:
                yield part
    raise ModelError("连接在回答完成之前关闭。")


def stream_text(messages):
    if _mock():
        text = _mock_text(messages)
        for index in range(0, len(text), 4):
            time.sleep(0.06)
            yield text[index:index + 4]
        return
    request = _request(messages, stream=True)
    try:
        with urlopen(request, timeout=30) as response:
            yield from _stream_parts(response)
    except ModelError:
        raise
    except (HTTPError, URLError, TimeoutError, socket.timeout, OSError) as error:
        raise _network_error(error) from None
    except (ValueError, KeyError, IndexError, TypeError, AttributeError):
        raise ModelError("模型流式响应格式异常。") from None


def parse_quiz(raw):
    try:
        quiz = json.loads(raw)
        if not isinstance(quiz, dict) or set(quiz) != {"question", "options", "answer"}:
            raise ValueError()
        if not isinstance(quiz["question"], str) or not quiz["question"].strip():
            raise ValueError()
        options = quiz["options"]
        if not isinstance(options, list) or len(options) != 3 or any(not isinstance(o, str) or not o.strip() for o in options):
            raise ValueError()
        if len(set(o.strip() for o in options)) != 3 or type(quiz["answer"]) is not int or not 0 <= quiz["answer"] < 3:
            raise ValueError()
        return quiz
    except (ValueError, KeyError, TypeError):
        raise ModelError("题目必须包含题干、三个不同的选项，以及 0 到 2 的整数答案索引。") from None
