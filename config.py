import os
from pathlib import Path

LLM_API_KEY: str = os.getenv("LLM_API_KEY", "")
LLM_MODEL: str = "claude-opus-4-7"

OUTPUT_DIR: Path = Path("output")
TYPST_TEMPLATE: Path = Path("template.typ")
IMAGES_DIR: Path = OUTPUT_DIR / "images"
