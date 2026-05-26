from pathlib import Path

from models.page import PageContext


class PageExtractor:
    """
    Sous-agent 2.1 — Extracteur de Pages & Analyse Contextuelle.
    Segmente l'ouvrage source et extrait le texte brut avec logique glissante (N-1, N, N+1).
    """

    def __init__(self, source_path: Path) -> None:
        self.source_path = source_path
        self._pages: list[str] = []

    def load(self) -> None:
        """Charge et segmente le PDF source page par page."""
        import fitz  # PyMuPDF
        doc = fitz.open(self.source_path)
        self._pages = [page.get_text() for page in doc]
        doc.close()

    def extract_context(self, page_number: int) -> PageContext:
        """Retourne le contexte glissant pour la page N avec N-1 et N+1."""
        if not self._pages:
            raise RuntimeError("Appelez load() avant extract_context().")
        return PageContext(
            page_number=page_number,
            text=self._pages[page_number],
            previous_text=self._pages[page_number - 1] if page_number > 0 else "",
            next_text=self._pages[page_number + 1] if page_number < len(self._pages) - 1 else "",
        )

    def page_count(self) -> int:
        return len(self._pages)
