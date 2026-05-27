import re
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

from web.db import (create, delete, delete_pages, get, get_setting, init_db,
                    insert_page, list_all, list_pages, set_setting, update, update_page)

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


def _parse_page_range(s: str, total: int) -> list[int]:
    """Parse "1-3, 5, 8-9" → [1, 2, 3, 5, 8, 9] (1-based, clampé sur total)."""
    pages: set[int] = set()
    for part in s.split(','):
        part = part.strip()
        m = re.fullmatch(r'(\d+)-(\d+)', part)
        if m:
            a, b = int(m[1]), int(m[2])
            pages.update(range(min(a, b), max(a, b) + 1))
        elif re.fullmatch(r'\d+', part):
            pages.add(int(part))
    return sorted(p for p in pages if 1 <= p <= total)


@app.post("/api/inspect")
async def api_inspect(file: UploadFile):
    import fitz
    content = await file.read()
    doc = fitz.open(stream=content, filetype="pdf")
    count = doc.page_count
    doc.close()
    return {"page_count": count}


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
    page_range: str = Form(""),
    prompt_custom: str = Form(""),
):
    dest = UPLOADS_DIR / file.filename
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    model_used = get_setting("model", "") or config.LLM_MODEL
    tid = create(titre, auteur, file.filename, police, theme, page_range or None, prompt_custom.strip() or None, model_used)
    background_tasks.add_task(_run_pipeline, tid, dest, titre, auteur, police, theme, page_range, prompt_custom.strip())
    return {"id": tid}


@app.delete("/api/translations/{tid}")
async def api_delete(tid: int):
    t = delete(tid)
    if not t:
        raise HTTPException(404)
    delete_pages(tid)
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
    for ext in (".pdf", ".typ"):
        p = OUTPUT_DIR / f"{tid}__partial{ext}"
        if p.exists():
            p.unlink()
    return {"ok": True}


@app.get("/api/translations/{tid}/pages")
async def api_pages(tid: int):
    if not get(tid):
        raise HTTPException(404)
    return list_pages(tid)


@app.put("/api/translations/{tid}/pages/{page_number}")
async def api_update_page(tid: int, page_number: int, body: dict = Body(...)):
    if not get(tid):
        raise HTTPException(404)
    typst_code = body.get("typst_code", "")
    if not update_page(tid, page_number, typst_code):
        raise HTTPException(404, detail="Page introuvable.")
    return {"ok": True}


@app.post("/api/translations/{tid}/recompile")
async def api_recompile(tid: int, background_tasks: BackgroundTasks, body: dict = Body(default={})):
    t = get(tid)
    if not t:
        raise HTTPException(404)
    pages = list_pages(tid)
    if not pages:
        raise HTTPException(400, detail="Aucune page stockée pour cette traduction.")
    police_slug = body.get("police", t["police"])
    theme_slug  = body.get("theme",  t["theme"])
    update(tid, status="recompiling", police=police_slug, theme=theme_slug)
    background_tasks.add_task(_recompile_pipeline, tid, t["titre"], t["auteur"],
                               police_slug, theme_slug, pages)
    return {"ok": True}


@app.get("/api/output/{tid}/partial")
async def api_output_partial(tid: int):
    pdf = OUTPUT_DIR / f"{tid}__partial.pdf"
    if not pdf.exists():
        raise HTTPException(404)
    return FileResponse(pdf, media_type="application/pdf", content_disposition_type="inline")


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


def _recompile_pipeline(tid: int, titre: str, auteur: str,
                        police_slug: str, theme_slug: str,
                        pages_data: list[dict]) -> None:
    try:
        import config
        from agents.typst_composer import TypstComposer
        from models.page import TranslatedPage

        composer = TypstComposer(ROOT / "template.typ", OUTPUT_DIR)
        police = config.FONTS.get(police_slug, config.FONTS[config.DEFAULT_FONT])
        theme  = config.THEMES.get(theme_slug,  config.THEMES[config.DEFAULT_THEME])
        pages  = [TranslatedPage(page_number=p["page_number"], typst_code=p["typst_code"])
                  for p in pages_data]
        pdf = composer.assemble(pages, titre=titre, auteur=auteur,
                                police=police, theme=theme, tid=tid)
        import fitz as _fitz
        with _fitz.open(str(pdf)) as _doc:
            output_pages = _doc.page_count
        update(tid, status="done", output_name=pdf.name, page_count=output_pages)
    except Exception as exc:
        update(tid, status="error", error=str(exc))


_PARTIAL_EVERY = 5  # compile un PDF partiel toutes les N pages


def _run_pipeline(tid: int, source_pdf: Path, titre: str, auteur: str,
                  police_slug: str = "crimson_pro", theme_slug: str = "standard",
                  page_range: str = "", prompt_custom: str = "") -> None:
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
        llm = LLMService(api_key=api_key, model=model, prompt_custom=prompt_custom)
        extractor = PageExtractor(source_pdf)
        img_extractor = ImageExtractor(images_dir)
        translator = SemanticTranslator(llm)
        composer = TypstComposer(ROOT / "template.typ", OUTPUT_DIR)

        extractor.load()
        total = extractor.page_count()

        # Résoudre la plage : chaîne vide = toutes les pages
        selected = _parse_page_range(page_range, total) if page_range.strip() else list(range(1, total + 1))
        if not selected:
            selected = list(range(1, total + 1))
        range_size = len(selected)

        update(tid, page_count=total)

        police = config.FONTS.get(police_slug, config.FONTS[config.DEFAULT_FONT])
        theme  = config.THEMES.get(theme_slug, config.THEMES[config.DEFAULT_THEME])

        pages: list[TranslatedPage] = []
        for i, p in enumerate(selected):
            n = p - 1  # 0-based index
            ctx = extractor.extract_context(n)
            illustrations = img_extractor.extract(source_pdf, n)
            typst_code = translator.translate(ctx)
            page = TranslatedPage(page_number=n, typst_code=typst_code, illustrations=illustrations)
            pages.append(page)
            insert_page(tid, page_number=n, typst_code=typst_code)

            # Compiler le partiel AVANT la mise à jour du statut
            # pour qu'il soit déjà disponible quand le frontend poll
            if i == 0 or (i + 1) % _PARTIAL_EVERY == 0:
                try:
                    composer.assemble(pages, titre=titre, auteur=auteur,
                                      police=police, theme=theme, tid=tid, partial=True)
                except Exception:
                    pass  # échec partiel non bloquant

            update(tid, status=f"processing:{i + 1}/{range_size}")

        pdf = composer.assemble(pages, titre=titre, auteur=auteur, police=police, theme=theme, tid=tid)
        import fitz as _fitz
        with _fitz.open(str(pdf)) as _doc:
            output_pages = _doc.page_count
        update(tid, status="done", output_name=pdf.name, page_count=output_pages)

    except Exception as exc:
        update(tid, status="error", error=str(exc))
