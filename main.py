import sys
from pathlib import Path

from config import LLM_API_KEY, LLM_MODEL, OUTPUT_DIR, IMAGES_DIR, TYPST_TEMPLATE, FONTS, DEFAULT_FONT
from agents.page_extractor import PageExtractor
from agents.image_extractor import ImageExtractor
from agents.translator import SemanticTranslator
from agents.typst_composer import TypstComposer
from models.page import TranslatedPage
from services.llm_service import LLMService


def run(source_pdf: Path, titre: str, auteur: str, police_slug: str = DEFAULT_FONT) -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    IMAGES_DIR.mkdir(exist_ok=True)

    police = FONTS.get(police_slug, FONTS[DEFAULT_FONT])

    llm = LLMService(api_key=LLM_API_KEY, model=LLM_MODEL)
    page_extractor = PageExtractor(source_pdf)
    image_extractor = ImageExtractor(IMAGES_DIR)
    translator = SemanticTranslator(llm)
    composer = TypstComposer(TYPST_TEMPLATE, OUTPUT_DIR)

    print(f"Chargement de {source_pdf}…")
    page_extractor.load()
    total = page_extractor.page_count()
    print(f"{total} pages détectées.")

    translated_pages: list[TranslatedPage] = []

    for n in range(total):
        print(f"[{n + 1}/{total}] Traduction de la page {n}…")
        context = page_extractor.extract_context(n)
        illustrations = image_extractor.extract(source_pdf, n)
        typst_code = translator.translate(context)
        translated_pages.append(TranslatedPage(
            page_number=n,
            typst_code=typst_code,
            illustrations=illustrations,
        ))

    print("Assemblage et compilation Typst…")
    output_pdf = composer.assemble(translated_pages, titre=titre, auteur=auteur, police=police)
    print(f"PDF généré : {output_pdf}")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage : python main.py <source.pdf> <titre> <auteur> [police]")
        print(f"Polices disponibles : {', '.join(FONTS)}")
        sys.exit(1)
    police_slug = sys.argv[4] if len(sys.argv) > 4 else DEFAULT_FONT
    run(Path(sys.argv[1]), titre=sys.argv[2], auteur=sys.argv[3], police_slug=police_slug)
