from models.page import PageContext
from services.llm_service import LLMService
from services import translation_cache as cache
from utils.typography import check_technical_terms


class SemanticTranslator:
    """
    Sous-agent 2.3 — Traducteur Sémantique & Technique.
    Délègue la traduction au LLMService et vérifie la préservation des termes techniques.
    Les traductions sont mises en cache pour éviter des appels LLM redondants.
    """

    def __init__(self, llm_service: LLMService) -> None:
        self.llm = llm_service

    def translate(self, context: PageContext) -> str:
        """Traduit la page cible et retourne le code Typst correspondant."""
        cached = cache.get(context.text, self.llm.model)
        if cached is not None:
            print(f"  [CACHE] Page {context.page_number} — résultat en cache.")
            return cached

        typst_code = self.llm.compose(context)
        cache.put(context.text, self.llm.model, typst_code)

        missing = check_technical_terms(context.text, typst_code)
        if missing:
            print(f"[WARN] Page {context.page_number} — termes techniques perdus : {missing}")
        return typst_code
