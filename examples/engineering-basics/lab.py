"""Local data-validation and file roundtrip exercise; standard library only."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory


def validate_record(record):
    if not isinstance(record, dict) or set(record) != {"title", "minutes", "done"}:
        raise ValueError("记录需包含 title、minutes 和 done")
    if not isinstance(record["title"], str) or not record["title"].strip() or len(record["title"]) > 100:
        raise ValueError("标题需为 1 至 100 字符")
    if type(record["minutes"]) is not int or not 1 <= record["minutes"] <= 180:
        raise ValueError("时长需为 1 到 180 的整数")
    if type(record["done"]) is not bool:
        raise ValueError("done 必须是布尔值")
    return {**record, "title": record["title"].strip()}


def completed_minutes(items):
    records = [validate_record(item) for item in items]
    return sum(item["minutes"] for item in records if item["done"])


def roundtrip(items):
    records = [validate_record(item) for item in items]
    with TemporaryDirectory() as folder:
        path = Path(folder) / "lessons.json"
        path.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
        return [validate_record(item) for item in json.loads(path.read_text(encoding="utf-8"))]


if __name__ == "__main__":
    records = roundtrip([{"title": "HTTP", "minutes": 6, "done": True},
                         {"title": "Git", "minutes": 6, "done": False}])
    print("本地课程清单：", records)
    print("完成时长：", completed_minutes(records))
