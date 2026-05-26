import uuid
from pathlib import Path

from models.page import IllustrationRef


class ImageExtractor:
    """
    Sous-agent 2.2 — Extracteur d'Illustrations.
    Détecte et sauvegarde les éléments visuels. Les textes anglais dans les images
    sont conservés tels quels (aucun post-traitement graphique).
    """

    def __init__(self, output_dir: Path) -> None:
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def extract(self, source_path: Path, page_number: int) -> list[IllustrationRef]:
        """Extrait toutes les images d'une page et retourne leurs références."""
        import fitz  # PyMuPDF
        doc = fitz.open(source_path)
        page = doc[page_number]
        refs: list[IllustrationRef] = []

        for img_index, img in enumerate(page.get_images(full=True)):
            xref = img[0]
            base_image = doc.extract_image(xref)
            ext = base_image["ext"]
            ref_id = f"img_p{page_number}_{img_index}_{uuid.uuid4().hex[:6]}"
            file_path = self.output_dir / f"{ref_id}.{ext}"
            file_path.write_bytes(base_image["image"])
            refs.append(IllustrationRef(
                ref_id=ref_id,
                source_page=page_number,
                file_path=file_path,
            ))

        doc.close()
        return refs
