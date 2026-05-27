import re
import time

from models.page import PageContext

SYSTEM_PROMPT = """\
RÔLE & CONTEXTE
Tu es le sous-agent "Rédacteur Compositeur" du projet Méson. Ton rôle est de traduire
une page de livre de l'anglais vers le français et de générer directement son code
source au format Typst, en respectant les standards de l'édition littéraire et
technique française.

DONNÉES D'ENTRÉE
Tu vas recevoir trois blocs de texte issus d'une analyse OCR :
- CONTEXTE_PRÉCÉDENT (Page N-1) : Pour comprendre le fil de la pensée. Ne pas traduire.
- TEXTE_CIBLE (Page N) : La page à traduire et à mettre en page.
- CONTEXTE_SUIVANT (Page N+1) : Pour anticiper les fins de phrases. Ne pas traduire.

1. DIRECTIVES DE TRADUCTION (PROJET MÉSON)
- Traduction fluide : Privilégie une adaptation contextuelle et élégante en français
  plutôt qu'une traduction littérale.
- Préservation technique : Maintiens STRICTEMENT la terminologie technique originale en
  anglais (ex: "design pattern", "thread", "features").
- Fidélité : Ne résume pas, n'ajoute pas de commentaires personnels. Conserve le sens
  exact de la page cible.

2. DIRECTIVES MICRO-TYPOGRAPHIQUES (FRANÇAIS)
Applique les règles du Code Typographique de l'Imprimerie Nationale :
- Espace fine insécable (U+202F) avant : !, ?, ; — insère le caractère Unicode directement.
- Espace forte insécable (U+00A0, soit ~ en Typst) avant : et à l'intérieur de « ».
- Lie les nombres et leurs unités avec ~ (ex: "180~kg", "XXe~siècle").
- Accentue obligatoirement les majuscules (À, É, È, Ç, Œ).
- N'utilise JAMAIS #sym.nbsp ni #sym.space ni aucune référence au module sym pour les
  espaces typographiques. Insère les caractères Unicode directement dans le texte.

3. DIRECTIVES DE FORMATAGE EN CODE TYPST
Génère un code Typst pur et standardisé. Applique les structures suivantes selon la
nature du texte :
- Paragraphes : N'insère pas de ligne vide entre les paragraphes ordinaires. Laisse
  Typst gérer l'alinéa automatiquement.
- Premier paragraphe : Si le texte cible est un début de chapitre ou suit immédiatement
  un titre, applique '#set par(first-line-indent: 0pt)' pour ce paragraphe spécifique.
- Dialogues : Utilise les guillemets français (« ») pour ouvrir/fermer le bloc de
  dialogue, et des tirets cadratins (—) pour les changements de locuteur.
- Citations longues (> 3 lignes) : Structure-les avec le bloc Typst
  '#block(inset: (left: 1.5em, right: 1.5em))[#set text(size: 0.9em); ...]' sans guillemets.
- Notes de bas de page : Si l'OCR détecte une note de bas de page, traduis-la et
  intègre-la via la fonction native '#footnote[...]'.
- Emplacement des Illustrations : Si le texte cible fait référence à une image
  extraite, insère une balise de commentaire Typst claire : '/* INSERT_IMAGE_HERE */'.

FORMAT DE SORTIE STRICT
Génère UNIQUEMENT le code Typst correspondant à la traduction de TEXTE_CIBLE. Ne
commence pas ta réponse par des salutations, n'inclus aucun texte explicatif avant ou
après le code. Renvoie directement le bloc de code Typst.\
"""


def _strip_code_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r'^```(?:typst)?\n', '', text)
    text = re.sub(r'\n```$', '', text)
    return _sanitize_typst(text.strip())


def _sanitize_typst(text: str) -> str:
    # Remplace les variantes #sym.nbsp par les caractères Unicode corrects
    text = text.replace('#sym.nbsp.narrow', ' ')
    text = text.replace('#sym.space.nobreak.narrow', ' ')
    text = text.replace('#sym.space.nobreak', ' ')
    text = re.sub(r'#sym\.nbsp\b', ' ', text)
    return text


class LLMService:
    """Pilote la génération de la couche Composition via appel LLM."""

    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            import anthropic
            self._client = anthropic.Anthropic(api_key=self.api_key)
        return self._client

    def compose(self, context: PageContext) -> str:
        """Envoie le contexte glissant au LLM et retourne le code Typst généré."""
        import anthropic
        client = self._get_client()
        delays = [5, 15, 30, 60]
        for attempt, delay in enumerate(delays + [None]):
            try:
                response = client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": self._build_user_message(context)}],
                )
                return _strip_code_fences(response.content[0].text)
            except anthropic.InternalServerError as exc:
                if delay is None:
                    raise
                print(f"  [RETRY] Page {context.page_number} — API surchargée ({exc.status_code}), "
                      f"nouvelle tentative dans {delay}s (essai {attempt + 1}/{len(delays)})…")
                time.sleep(delay)
            except anthropic.RateLimitError as exc:
                if delay is None:
                    raise
                wait = delay * 2
                print(f"  [RETRY] Page {context.page_number} — Rate limit, "
                      f"pause {wait}s (essai {attempt + 1}/{len(delays)})…")
                time.sleep(wait)

    def _build_user_message(self, context: PageContext) -> str:
        return (
            f"CONTEXTE_PRÉCÉDENT (Page {context.page_number - 1}) :\n"
            f"{context.previous_text}\n\n"
            f"TEXTE_CIBLE (Page {context.page_number}) :\n"
            f"{context.text}\n\n"
            f"CONTEXTE_SUIVANT (Page {context.page_number + 1}) :\n"
            f"{context.next_text}"
        )
