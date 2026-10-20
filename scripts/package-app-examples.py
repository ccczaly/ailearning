"""Build a deterministic, credential-free download from the explicit example files."""
from pathlib import Path
import io
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
files = ["README.md", "client.py", "steps.py", "app.py", "index.html", "tests.py"]
buffer = io.BytesIO()
with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        item = zipfile.ZipInfo(f"llm-app-dev/{name}", (2026, 1, 1, 0, 0, 0))
        item.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(item, (root / "examples/llm-app-dev" / name).read_bytes())
destination = root / "public/examples/llm-app-dev.zip"
if "--check" in sys.argv:
    if destination.read_bytes() != buffer.getvalue():
        raise SystemExit("Example download differs from source; regenerate it.")
    print("Python example download matches all six source files.")
else:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(buffer.getvalue())
