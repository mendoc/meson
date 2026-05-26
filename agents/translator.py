from models.page import PageContext
from services.llm_service import LLMService
from utils.typography import check_technical_terms


class SemanticTranslator:
    """
    Sous-agent 2.3 — Traducteur Sémantique & Technique.
    Délègue la traduction au LLMService et vérifie la préservation des termes techniques.
    """

    def __init__(self, llm_service: LLMService) -> None:
        self.llm = llm_service

    def translate(self, context: PageContext) -> str:
        """Traduit la page cible et retourne le code Typst correspondant."""
        typst_code = self.llm.compose(context)
        missing = check_technical_terms(context.text, typst_code)
        if missing:
            print(f"[WARN] Page {context.page_number} — termes techniques perdus : {missing}")
        return typst_code
