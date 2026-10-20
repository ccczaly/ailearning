"""Bounded deterministic agent fixture. No model calls or external side effects."""
import copy
import json


def dispatch(name, arguments):
    if name != "add_minutes":
        raise ValueError("未知工具")
    if not isinstance(arguments, dict) or set(arguments) != {"values"}:
        raise ValueError("工具需要 values 参数且不接受其他字段")
    values = arguments["values"]
    if not isinstance(values, list) or not 1 <= len(values) <= 10:
        raise ValueError("需 1 到 10 个整数")
    if any(type(value) is not int or not 0 <= value <= 180 for value in values):
        raise ValueError("每个时长需为 0 到 180 的整数")
    return {"total_minutes": sum(values)}


def run_plan(plan, max_steps=4):
    if not isinstance(plan, list) or type(max_steps) is not int or not 1 <= max_steps <= 20:
        raise ValueError("计划或预算无效")
    trace = []
    for index, action in enumerate(plan):
        if index >= max_steps:
            return {"status": "budget_exhausted", "trace": trace}
        try:
            if not isinstance(action, dict) or set(action) != {"name", "arguments"}:
                raise ValueError("动作格式无效")
            result = dispatch(action["name"], action["arguments"])
        except ValueError as error:
            trace.append({"step": index + 1, "name": action.get("name") if isinstance(action, dict) else None, "result": str(error)})
            return {"status": "failed", "trace": trace}
        trace.append({"step": index + 1, "name": action["name"], "result": result})
    return {"status": "completed", "trace": trace}


class Ledger:
    """Process-local demo only; production idempotency needs durable transactions."""
    def __init__(self):
        self.records = {}

    def create(self, key, payload):
        if not isinstance(key, str) or not key or not isinstance(payload, dict):
            raise ValueError("操作标识和数据无效")
        canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        if key in self.records:
            old, result = self.records[key]
            if old != canonical:
                raise ValueError("同一操作标识的内容发生冲突")
            return copy.deepcopy(result)
        result = {"id": len(self.records) + 1, "payload": copy.deepcopy(payload), "mode": "memory_only"}
        self.records[key] = (canonical, result)
        return copy.deepcopy(result)


class Proposal:
    def __init__(self, content):
        self._content = copy.deepcopy(content)
        self.state = "proposed"

    @property
    def content(self):
        return copy.deepcopy(self._content)

    def approve(self):
        if self.state != "proposed":
            raise ValueError("只能确认待审阅草案")
        self.state = "approved"

    def execute(self):
        if self.state != "approved":
            raise ValueError("草案未批准或已执行")
        self.state = "executed"
        return {"state": self.state, "content": self.content, "mode": "memory_only"}


if __name__ == "__main__":
    print("确定性计划替身，未调用模型或外部服务。")
    print(run_plan([{"name": "add_minutes", "arguments": {"values": [6, 8]}}]))
    proposal = Proposal({"title": "复习 RAG"})
    print("待确认：", proposal.content, proposal.state)
