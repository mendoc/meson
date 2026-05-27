import os
from pathlib import Path

LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
LLM_MODEL: str = "claude-opus-4-7"

OUTPUT_DIR: Path = Path("output")
TYPST_TEMPLATE: Path = Path("template.typ")
IMAGES_DIR: Path = OUTPUT_DIR / "images"

FONTS: dict[str, tuple[str, ...]] = {
    "eb_garamond": ("EB Garamond",  "Linux Libertine", "DejaVu Serif"),
    "sabon":       ("Sabon",        "Linux Libertine", "DejaVu Serif"),
    "crimson_pro": ("Crimson Pro",  "Linux Libertine", "DejaVu Serif"),
    "lora":        ("Lora",         "Linux Libertine", "DejaVu Serif"),
    "minion_pro":  ("Minion Pro",   "Linux Libertine", "DejaVu Serif"),
}
DEFAULT_FONT: str = "crimson_pro"

THEMES: dict[str, dict] = {
    "standard": {
        "file": "gabarit_standard",
        "fn":   "gabarit-standard",
        "label": "Standard — Roman littéraire A5",
    },
    "oreilly": {
        "file": "gabarit_oreilly",
        "fn":   "gabarit-oreilly",
        "label": "O'Reilly — Technique avec en-têtes courants",
    },
}
DEFAULT_THEME: str = "standard"
