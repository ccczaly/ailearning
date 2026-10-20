"""Deterministic application-quality fixtures; not a semantic model evaluator."""
import hashlib
import json


def pass_rate(results):
    if not isinstance(results, list) or any(type(item) is not bool for item in results):
        raise ValueError("评测结论需为布尔值列表")
    return {"total": len(results), "passed": sum(results),
            "rate": sum(results)/len(results) if results else None}


def authorized(actor, owner):
    return isinstance(actor, str) and bool(actor) and actor == owner


def cache_key(actor, prompt_version, document_version, question):
    values = (actor, prompt_version, document_version, question)
    if any(not isinstance(value, str) or not value.strip() for value in values):
        raise ValueError("缓存范围与版本不可为空")
    # Full production scope also includes model/config and every relevant policy dimension.
    payload = {"actor": actor, "prompt": prompt_version, "document": document_version,
               "question": question.strip(), "model": "offline-fixture-v1"}
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


def safe_event(request_id, stage, status, duration_ms):
    if not all(isinstance(value, str) and value for value in (request_id, stage, status)):
        raise ValueError("事件字段无效")
    if type(duration_ms) not in (int, float) or not 0 <= duration_ms < float("inf"):
        raise ValueError("耗时无效")
    return {"request_id": request_id, "stage": stage, "status": status, "duration_ms": duration_ms}


def report():
    return {"mode": "offline_rule_checks", "evaluations": pass_rate([True, True, False]),
            "owner_allowed": authorized("alice", "alice"), "other_denied": not authorized("bob", "alice"),
            "cache_key": cache_key("alice", "p1", "d1", "解释 RAG"),
            "event": safe_event("r1", "fixture", "ok", 0)}


if __name__ == "__main__":
    print(json.dumps(report(), ensure_ascii=False, indent=2))
