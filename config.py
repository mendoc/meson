import os
from pathlib import Path

LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
LLM_MODEL: str = "claude-opus-4-7"

OUTPUT_DIR: Path = Path("output")
TYPST_TEMPLATE: Path = Path("template.typ")
IMAGES_DIR: Path = OUTPUT_DIR / "images"

FONTS: dict[str, tuple[str, ...]] = {
    "eb_garamond": ("EB Garamond",  "Linux Libertine", "DejaVu Serif"),
    "crimson_pro":  ("Crimson Pro",  "Linux Libertine", "DejaVu Serif"),
    "lora":         ("Lora",         "Linux Libertine", "DejaVu Serif"),
}
DEFAULT_FONT: str = "crimson_pro"
