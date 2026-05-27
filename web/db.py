import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "translations.db"


def init_db() -> None:
    with _conn() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS translations (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                titre        TEXT    NOT NULL,
                auteur       TEXT    NOT NULL,
                source_name  TEXT    NOT NULL,
                output_name  TEXT,
                status       TEXT    NOT NULL DEFAULT 'pending',
                page_count   INTEGER,
                created_at   TEXT    NOT NULL,
                error        TEXT,
                police       TEXT    NOT NULL DEFAULT 'crimson_pro',
                theme        TEXT    NOT NULL DEFAULT 'standard'
            )
        """)
        try:
            db.execute("ALTER TABLE translations ADD COLUMN police TEXT NOT NULL DEFAULT 'crimson_pro'")
        except Exception:
            pass
        try:
            db.execute("ALTER TABLE translations ADD COLUMN theme TEXT NOT NULL DEFAULT 'standard'")
        except Exception:
            pass
        try:
            db.execute("ALTER TABLE translations ADD COLUMN page_range TEXT")
        except Exception:
            pass
        try:
            db.execute("ALTER TABLE translations ADD COLUMN prompt_custom TEXT")
        except Exception:
            pass
        db.execute("""
            CREATE TABLE IF NOT EXISTS translation_pages (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                translation_id INTEGER NOT NULL,
                page_number    INTEGER NOT NULL,
                typst_code     TEXT    NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)


@contextmanager
def _conn():
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.row_factory = sqlite3.Row
    try:
        yield db
        db.commit()
    finally:
        db.close()


def create(titre: str, auteur: str, source_name: str,
           police: str = "crimson_pro", theme: str = "standard",
           page_range: str | None = None,
           prompt_custom: str | None = None) -> int:
    with _conn() as db:
        cur = db.execute(
            "INSERT INTO translations (titre, auteur, source_name, police, theme, page_range, prompt_custom, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (titre, auteur, source_name, police, theme, page_range, prompt_custom or None, datetime.now().isoformat(timespec="seconds")),
        )
        return cur.lastrowid


def update(tid: int, **fields) -> None:
    cols = ", ".join(f"{k} = ?" for k in fields)
    with _conn() as db:
        db.execute(f"UPDATE translations SET {cols} WHERE id = ?", (*fields.values(), tid))


def get(tid: int) -> dict | None:
    with _conn() as db:
        row = db.execute("SELECT * FROM translations WHERE id = ?", (tid,)).fetchone()
        return dict(row) if row else None


def list_all() -> list[dict]:
    with _conn() as db:
        rows = db.execute(
            "SELECT * FROM translations ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def delete(tid: int) -> dict | None:
    """Supprime l'entrée et retourne ses champs (pour que l'appelant puisse nettoyer les fichiers)."""
    with _conn() as db:
        row = db.execute("SELECT * FROM translations WHERE id = ?", (tid,)).fetchone()
        if not row:
            return None
        data = dict(row)
        db.execute("DELETE FROM translations WHERE id = ?", (tid,))
        return data


def insert_page(tid: int, page_number: int, typst_code: str) -> None:
    with _conn() as db:
        db.execute(
            "INSERT INTO translation_pages (translation_id, page_number, typst_code) VALUES (?, ?, ?)",
            (tid, page_number, typst_code),
        )


def list_pages(tid: int) -> list[dict]:
    with _conn() as db:
        rows = db.execute(
            "SELECT page_number, typst_code FROM translation_pages WHERE translation_id = ? ORDER BY page_number",
            (tid,),
        ).fetchall()
        return [dict(r) for r in rows]


def update_page(tid: int, page_number: int, typst_code: str) -> bool:
    with _conn() as db:
        cur = db.execute(
            "UPDATE translation_pages SET typst_code = ? WHERE translation_id = ? AND page_number = ?",
            (typst_code, tid, page_number),
        )
        return cur.rowcount > 0


def delete_pages(tid: int) -> None:
    with _conn() as db:
        db.execute("DELETE FROM translation_pages WHERE translation_id = ?", (tid,))


def get_setting(key: str, default: str | None = None) -> str | None:
    with _conn() as db:
        row = db.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    with _conn() as db:
        db.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )
