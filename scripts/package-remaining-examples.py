"""Deterministic downloads; explicitly allowlist files, excluding secrets and generated state."""
from pathlib import Path
import io
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
modules = ["engineering-basics", "rag", "agents", "mcp", "multimodal", "app-engineering", "deployment"]
for module in modules:
    files = ["README.md", "lab.py", "tests.py"]
    if module == "deployment":
        files += ["service.py", "Dockerfile", ".dockerignore"]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in files:
            item = zipfile.ZipInfo(f"{module}/{name}", (2026, 1, 1, 0, 0, 0))
            item.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(item, (root / "examples" / module / name).read_bytes())
    destination = root / "public/examples" / f"{module}.zip"
    if "--check" in sys.argv:
        if destination.read_bytes() != buffer.getvalue():
            raise SystemExit(f"Download differs from source: {module}")
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(buffer.getvalue())
print("Seven example downloads match source." if "--check" in sys.argv else "Packaged seven example downloads.")
