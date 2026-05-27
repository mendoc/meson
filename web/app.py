import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from fastapi import BackgroundTasks, Body, FastAPI, Form, HTTPException, UploadFile
from fastapi.requests import Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from web.db import create, delete, get, get_setting, init_db, list_all, set_setting, update

HERE = Path(__file__).parent
app = FastAPI(title="Méson")
app.mount("/static", StaticFiles(directory=HERE / "static"), name="static")
templates = Jinja2Templates(directory=HERE / "templates")

UPLOADS_DIR = ROOT / "input"
OUTPUT_DIR = ROOT / "output"


@app.on_event("startup")
def startup() -> None:
    init_db()
    UPLOADS_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)
    # Les tâches en cours au moment du redémarrage ne reprendront jamais —
    # on les marque explicitement en erreur pour éviter les zombies infinis.
    from web.db import _conn
    with _conn() as db:
        db.execute(
            "UPDATE translations SET status = 'error', error = ? "
            "WHERE status IN ('pending', 'processing')",
            ("Interrompue lors du redémarrage du serveur.",)
        )


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


AVAILABLE_MODELS = [
    {"id": "claude-opus-4-7",           "label": "Claude Opus 4.7 — Le plus puissant"},
    {"id": "claude-sonnet-4-6",         "label": "Claude Sonnet 4.6 — Rapide et capable"},
    {"id": "claude-haiku-4-5-20251001", "label": "Claude Haiku 4.5 — Le plus économique"},
]


@app.get("/api/settings")
async def api_settings_get():
    import config
    api_key = get_setting("api_key", "") or ""
    model   = get_setting("model", config.LLM_MODEL) or config.LLM_MODEL
    masked  = (api_key[:12] + "…" + api_key[-4:]) if len(api_key) > 16 else ("*" * len(api_key) if api_key else "")
    return {"has_api_key": bool(api_key), "api_key_hint": masked, "model": model, "models": AVAILABLE_MODELS}


@app.put("/api/settings")
async def api_settings_put(body: dict = Body(...)):
    api_key = body.get("api_key", "").strip()
    model   = body.get("model", "").strip()
    if api_key:
        set_setting("api_key", api_key)
    if model:
        set_setting("model", model)
    return {"ok": True}


@app.delete("/api/settings/api_key")
async def api_settings_delete_key():
    set_setting("api_key", "")
    return {"ok": True}


@app.post("/api/settings/verify")
async def api_settings_verify():
    import config
    import anthropic
    api_key = get_setting("api_key", "") or config.LLM_API_KEY
    if not api_key:
        return {"valid": False, "error": "Aucune clé API configurée."}
    try:
        client = anthropic.Anthropic(api_key=api_key)
        client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1,
            messages=[{"role": "user", "content": "Hi"}],
        )
        return {"valid": True, "error": None}
    except anthropic.AuthenticationError:
        return {"valid": False, "error": "Clé API invalide ou révoquée."}
    except Exception as exc:
        return {"valid": False, "error": str(exc)}


@app.get("/api/cache")
async def api_cache_stats():
    from services import translation_cache as cache
    return cache.stats()


@app.delete("/api/cache")
async def api_cache_clear(model: str | None = None):
    from services import translation_cache as cache
    n = cache.clear(model=model)
    return {"deleted": n}


@app.get("/api/translations")
async def api_list():
    return list_all()


@app.get("/api/translations/{tid}")
async def api_get(tid: int):
    t = get(tid)
    if not t:
        raise HTTPException(404)
    return t


@app.post("/api/translate")
async def api_translate(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    titre: str = Form(...),
    auteur: str = Form(...),
    police: str = Form("crimson_pro"),
    theme: str = Form("standard"),
):
    dest = UPLOADS_DIR / file.filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    tid = create(titre, auteur, file.filename, police, theme)
    background_tasks.add_task(_run_pipeline, tid, dest, titre, auteur, police, theme)
    return {"id": tid}


@app.delete("/api/translations/{tid}")
async def api_delete(tid: int):
    t = delete(tid)
    if not t:
        raise HTTPException(404)
    for name in (t.get("output_name"), t.get("source_name")):
        if not name:
            continue
        for folder in (OUTPUT_DIR, UPLOADS_DIR):
            f = folder / name
            if f.exists():
                f.unlink()
        typ = (OUTPUT_DIR / name).with_suffix(".typ")
        if typ.exists():
            typ.unlink()
    return {"ok": True}


@app.get("/api/output/{tid}")
async def api_output(tid: int):
    t = get(tid)
    if not t or not t["output_name"]:
        raise HTTPException(404)
    pdf = OUTPUT_DIR / t["output_name"]
    if not pdf.exists():
        raise HTTPException(404)
    return FileResponse(pdf, media_type="application/pdf",
                        filename=pdf.name, content_disposition_type="inline")


def _run_pipeline(tid: int, source_pdf: Path, titre: str, auteur: str,
                  police_slug: str = "crimson_pro", theme_slug: str = "standard") -> None:
    try:
        import config
        from agents.image_extractor import ImageExtractor
        from agents.page_extractor import PageExtractor
        from agents.translator import SemanticTranslator
        from agents.typst_composer import TypstComposer
        from models.page import TranslatedPage
        from services.llm_service import LLMService

        images_dir = OUTPUT_DIR / "images"
        images_dir.mkdir(exist_ok=True)

        update(tid, status="processing")

        api_key = get_setting("api_key", "") or config.LLM_API_KEY
        model   = get_setting("model", config.LLM_MODEL) or config.LLM_MODEL
        llm = LLMService(api_key=api_key, model=model)
        extractor = PageExtractor(source_pdf)
        img_extractor = ImageExtractor(images_dir)
        translator = SemanticTranslator(llm)
        composer = TypstComposer(ROOT / "template.typ", OUTPUT_DIR)

        extractor.load()
        total = extractor.page_count()
        update(tid, page_count=total)

        pages: list[TranslatedPage] = []
        for n in range(total):
            ctx = extractor.extract_context(n)
            illustrations = img_extractor.extract(source_pdf, n)
            typst_code = translator.translate(ctx)
            pages.append(TranslatedPage(page_number=n, typst_code=typst_code, illustrations=illustrations))
            update(tid, status=f"processing:{n + 1}/{total}")

        police = config.FONTS.get(police_slug, config.FONTS[config.DEFAULT_FONT])
        theme  = config.THEMES.get(theme_slug, config.THEMES[config.DEFAULT_THEME])
        pdf = composer.assemble(pages, titre=titre, auteur=auteur, police=police, theme=theme, tid=tid)
        update(tid, status="done", output_name=pdf.name)

    except Exception as exc:
        update(tid, status="error", error=str(exc))
