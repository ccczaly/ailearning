"""Offline lexical RAG teaching pipeline, not a trained embedding model."""
import math

DOCUMENTS = [
    {"id": "exam", "source": "course-guide@1", "text": "测验三题至少答对两题通过。", "roles": {"student", "staff"}},
    {"id": "history", "source": "course-guide@1", "text": "之后测验未通过，不清除已有通过状态。", "roles": {"student", "staff"}},
    {"id": "internal", "source": "internal-guide@1", "text": "测验内部评价资料仅供教研人员查看。", "roles": {"staff"}},
]


def _terms(text):
    text = "".join(text.lower().split())
    return {text[i:i + 2] for i in range(len(text) - 1)} if len(text) > 1 else set(text)


def search(question, role, limit=2):
    if role not in {"student", "staff"} or type(limit) is not int or not 1 <= limit <= 10:
        raise ValueError("无效的角色或数量")
    if not isinstance(question, str) or not question.strip():
        raise ValueError("问题不能为空")
    query = _terms(question)
    scored = []
    for doc in DOCUMENTS:
        if role not in doc["roles"]:
            continue
        score = len(query & _terms(doc["text"]))
        if score:
            scored.append((score, doc["id"], doc))
    return [{k: v for k, v in doc.items() if k != "roles"}
            for _, _, doc in sorted(scored, key=lambda x: (-x[0], x[1]))[:limit]]


def grounded_answer(hits):
    if not hits:
        return "未找到可访问的依据，请补充资料。"
    return "\n".join(f"{item['text']} [{item['source']}#{item['id']}]" for item in hits)


def cosine(a, b):
    if not a or len(a) != len(b) or any(type(x) not in (int, float) or not math.isfinite(x) for x in [*a, *b]):
        raise ValueError("向量需非空、同维且数值有限")
    norm = math.sqrt(sum(x*x for x in a)) * math.sqrt(sum(x*x for x in b))
    return sum(x*y for x, y in zip(a, b)) / norm if norm else 0.0


def rrf(rankings, offset=60):
    if type(offset) is not int or offset < 1:
        raise ValueError("offset 必须为正整数")
    scores = {}
    for ranking in rankings:
        seen = set()
        for rank, key in enumerate(ranking, 1):
            if key not in seen:
                scores[key] = scores.get(key, 0) + 1 / (offset + rank)
                seen.add(key)
    return sorted(scores.items(), key=lambda item: (-item[1], item[0]))


def recall_at_k(expected, ranked, k):
    if type(k) is not int or k < 1:
        raise ValueError("k 必须为正整数")
    expected = set(expected)
    return len(expected & set(ranked[:k])) / len(expected) if expected else 0.0


if __name__ == "__main__":
    print("教学词面检索，未调用 embedding 或大模型。")
    print(grounded_answer(search("测验通过", role="student")))
    print(grounded_answer(search("证书价格", role="student")))
