import re

THIN_NBSP = " "  # espace fine insécable
NBSP = " "       # espace insécable
EM_DASH = "—"    # tiret cadratin

# Termes techniques à ne jamais traduire (critère de recette §6)
TECHNICAL_TERMS: set[str] = {
    "thread", "feature", "features", "design pattern", "design patterns",
    "prompt engineering", "pipeline", "token", "tokens", "embedding", "embeddings",
    "fine-tuning", "benchmark", "overhead", "payload", "callback", "runtime",
    "framework", "backend", "frontend", "middleware", "refactoring", "debugging",
}


def insert_french_spaces(text: str) -> str:
    """Insère les espaces insécables conformément au Code Typographique de l'Imprimerie Nationale."""
    text = re.sub(r" ([!?;])", f"{THIN_NBSP}\\1", text)
    text = re.sub(r" (:)", f"{NBSP}\\1", text)
    return text


def check_technical_terms(source_text: str, translated_text: str) -> list[str]:
    """
    Retourne les termes techniques présents dans le texte SOURCE qui ont disparu
    de la traduction. Filtre les faux positifs sur les livres non techniques.
    """
    lowered_src  = source_text.lower()
    lowered_trad = translated_text.lower()
    return [
        term for term in TECHNICAL_TERMS
        if term in lowered_src and term not in lowered_trad
    ]


def validate_major_accents(text: str) -> list[str]:
    """Signale les majuscules non accentuées suspectes (E, A, C sans accent)."""
    pattern = re.compile(r"\b[EAC]\b")
    return pattern.findall(text)
