import hashlib
import json
from pathlib import Path

from services.llm_service import SYSTEM_PROMPT

_CACHE_DIR = Path(__file__).parent.parent / "cache" / "translations"

# Le hash du prompt est intégré à la clé : tout changement de prompt
# invalide automatiquement les entrées en cache sans action manuelle.
_PROMPT_HASH = hashlib.md5(SYSTEM_PROMPT.encode()).hexdigest()[:8]


def _key(text: str, model: str) -> str:
    return hashlib.sha256(f"{_PROMPT_HASH}:{model}:{text}".encode()).hexdigest()


def get(text: str, model: str) -> str | None:
    path = _CACHE_DIR / f"{_key(text, model)}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))["typst_code"]
    return None


def put(text: str, model: str, typst_code: str) -> None:
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = _CACHE_DIR / f"{_key(text, model)}.json"
    path.write_text(json.dumps({
        "model": model,
        "prompt_hash": _PROMPT_HASH,
        "preview": text[:120].replace("\n", " "),
        "typst_code": typst_code,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


def invalidate(text: str, model: str) -> bool:
    path = _CACHE_DIR / f"{_key(text, model)}.json"
    if path.exists():
        path.unlink()
        return True
    return False


def clear(model: str | None = None) -> int:
    if not _CACHE_DIR.exists():
        return 0
    removed = 0
    for f in _CACHE_DIR.glob("*.json"):
        if model is not None:
            try:
                entry = json.loads(f.read_text(encoding="utf-8"))
                if entry.get("model") != model:
                    continue
            except Exception:
                pass
        f.unlink()
        removed += 1
    return removed


def stats() -> dict:
    if not _CACHE_DIR.exists():
        return {"entries": 0, "size_kb": 0}
    files = list(_CACHE_DIR.glob("*.json"))
    size = sum(f.stat().st_size for f in files)
    return {"entries": len(files), "size_kb": round(size / 1024, 1)}
