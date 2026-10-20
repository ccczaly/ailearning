"""Execute all offline module tests, entry points and every authored Python snippet."""
from pathlib import Path
import ast
import json
import os
import re
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
modules = ["engineering-basics", "rag", "agents", "mcp", "multimodal", "app-engineering", "deployment"]
environment = {**os.environ, "PYTHONUTF8": "1"}
count = 0


def run(args, cwd):
    result = subprocess.run([sys.executable, "-X", "utf8", *args], cwd=cwd, env=environment,
                            text=True, encoding="utf-8", capture_output=True, timeout=20)
    if result.returncode:
        raise SystemExit(f"Failed {cwd.name}: {args[:2]}\n{result.stdout}\n{result.stderr}")


for module in modules:
    directory = root / "examples" / module
    run(["-m", "unittest", "discover", "-s", ".", "-p", "tests.py"], directory)
    run(["lab.py"], directory)
    course = json.loads((root / "content" / f"{module}.json").read_text(encoding="utf-8"))
    for chapter in course["chapters"]:
        for lesson in chapter["lessons"]:
            snippets = re.findall(r"```python\n(.*?)```", lesson["body"], re.S)
            if not snippets:
                raise SystemExit(f"Missing snippet: {lesson['title']}")
            for snippet in snippets:
                ast.parse(snippet, filename=lesson["key"])
                run(["-c", snippet], directory)
                count += 1
    print(f"Verified {module}: offline tests, entry point and lesson snippets.")
print(f"All {count} authored Python snippets executed successfully; no paid model calls.")
