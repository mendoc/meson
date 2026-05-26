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


def check_technical_terms(translated_text: str) -> list[str]:
    """
    Retourne les termes techniques du texte source qui n'apparaissent pas dans la traduction.
    Utilisé comme garde-fou après la génération LLM (critère de recette §6.2).
    """
    lowered = translated_text.lower()
    return [term for term in TECHNICAL_TERMS if term not in lowered]


def validate_major_accents(text: str) -> list[str]:
    """Signale les majuscules non accentuées suspectes (E, A, C sans accent)."""
    pattern = re.compile(r"\b[EAC]\b")
    return pattern.findall(text)
