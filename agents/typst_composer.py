import subprocess
from pathlib import Path

from models.page import TranslatedPage


class TypstComposer:
    """
    Sous-agent 2.4 — Rédacteur / Compositeur Typst.
    Assemble les pages traduites dans le gabarit et compile le PDF final via Typst CLI.
    """

    def __init__(self, template_path: Path, output_dir: Path) -> None:
        self.template_path = template_path
        self.output_dir = output_dir

    def assemble(self, pages: list[TranslatedPage], titre: str, auteur: str,
                 police: tuple[str, ...] = ("Crimson Pro", "Linux Libertine", "DejaVu Serif")) -> Path:
        """Génère le fichier .typ final encapsulé dans le gabarit, puis compile."""
        body = "\n\n".join(p.typst_code for p in pages)
        slug = "".join(c if c.isalnum() or c == "_" else "_" for c in titre.lower())[:40]
        typ_file = self.output_dir / f"{slug}.typ"

        font_typst = "(" + ", ".join(f'"{f}"' for f in police) + ")"
        header = (
            f'#import "/template.typ": projet-meson\n'
            f'#show: projet-meson.with(titre: "{titre}", auteur: "{auteur}", police: {font_typst})\n\n'
        )
        typ_file.write_text(header + body, encoding="utf-8")
        return self._compile(typ_file)

    def _compile(self, typ_file: Path) -> Path:
        """Lance `typst compile` avec --root et --font-path vers les polices du projet."""
        pdf_file = typ_file.with_suffix(".pdf")
        root = self.template_path.parent          # /app

        cmd = ["typst", "compile", f"--root={root}"]
        fonts_root = root / "fonts"
        if fonts_root.exists():
            cmd += [f"--font-path={fonts_root}"]
        cmd += [str(typ_file), str(pdf_file)]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Échec de la compilation Typst :\n{result.stderr}")
        return pdf_file
