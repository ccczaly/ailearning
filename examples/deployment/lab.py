"""Deployment planning fixtures. No containers, cloud, or live DB changes."""
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory


def backup_demo():
    with TemporaryDirectory() as folder:
        source = sqlite3.connect(Path(folder) / "source.db")
        restored = sqlite3.connect(Path(folder) / "restored.db")
        try:
            source.execute("CREATE TABLE lessons(id INTEGER PRIMARY KEY,title TEXT NOT NULL)")
            source.execute("INSERT INTO lessons(title) VALUES(?)", ("RAG",))
            source.commit()
            source.backup(restored)
            rows = restored.execute("SELECT id,title FROM lessons ORDER BY id").fetchall()
            return {"rows": rows, "restored_count": len(rows), "mode": "temporary_sqlite"}
        finally:
            source.close()
            restored.close()


def migration_demo():
    database = sqlite3.connect(":memory:")
    try:
        database.execute("CREATE TABLE lessons(id INTEGER PRIMARY KEY,title TEXT NOT NULL)")
        database.execute("INSERT INTO lessons(title) VALUES(?)", ("RAG",))
        database.execute("ALTER TABLE lessons ADD COLUMN minutes INTEGER NOT NULL DEFAULT 6")
        return database.execute("SELECT id,title,minutes FROM lessons").fetchall()
    finally:
        database.close()


def readiness(database_ok):
    if type(database_ok) is not bool:
        raise ValueError("模拟依赖状态必须为布尔值")
    return {"status": "ready" if database_ok else "not_ready", "accept_traffic": database_ok, "mode": "fixture"}


def release_gate(tests_ok, ready, backup_verified):
    if any(type(value) is not bool for value in (tests_ok, ready, backup_verified)):
        raise ValueError("发布条件必须为布尔值")
    return "allow" if tests_ok and ready and backup_verified else "stop"


if __name__ == "__main__":
    print("部署规划演示；不连接 MySQL，不构建或发布容器。")
    print(backup_demo())
    print(migration_demo())
    print(readiness(True))
    print(release_gate(True, True, True))
