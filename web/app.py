import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from fastapi import BackgroundTasks, FastAPI, Form, HTTPException, UploadFile
from fastapi.requests import Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from web.db import create, get, init_db, list_all, update

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


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


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


@app.get("/api/output/{tid}")
async def api_output(tid: int):
    t = get(tid)
    if not t or not t["output_name"]:
        raise HTTPException(404)
    pdf = OUTPUT_DIR / t["output_name"]
    if not pdf.exists():
        raise HTTPException(404)
    return FileResponse(pdf, media_type="application/pdf", filename=pdf.name)


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

        llm = LLMService(api_key=config.LLM_API_KEY, model=config.LLM_MODEL)
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
        pdf = composer.assemble(pages, titre=titre, auteur=auteur, police=police, theme=theme)
        update(tid, status="done", output_name=pdf.name)

    except Exception as exc:
        update(tid, status="error", error=str(exc))
