from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class PageContext:
    page_number: int
    text: str
    previous_text: str = ""
    next_text: str = ""


@dataclass
class IllustrationRef:
    ref_id: str
    source_page: int
    file_path: Path
    caption: str = ""


@dataclass
class TranslatedPage:
    page_number: int
    typst_code: str
    illustrations: list[IllustrationRef] = field(default_factory=list)
