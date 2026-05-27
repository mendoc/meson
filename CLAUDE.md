# Méson — Guide pour Claude Code

## Présentation du projet

Méson est un pipeline d'ingénierie éditoriale automatisée : il traduit des ouvrages
techniques anglophones en PDF français professionnels via l'API Anthropic (Claude) et
le moteur typographique Typst.

## Stack technique

- **LLM** : Anthropic API (`claude-opus-4-7` par défaut), via `services/llm_service.py`
- **OCR/parsing** : PyMuPDF (`fitz`), fenêtre glissante N-1/N/N+1
- **Typographie** : Typst CLI 0.13.1 — `--root`, `--font-path fonts/` (récursif)
- **Web** : FastAPI + Jinja2 + Uvicorn, SQLite (`translations.db`)
- **Frontend** : Tailwind CSS CDN, `darkMode: 'class'`, JS vanilla
- **Cache** : fichiers JSON dans `cache/translations/`, clé = SHA-256(prompt_hash + model + texte)
- **Docker** : `docker-compose.yml` — services `web` (port 8000) et `meson` (CLI)

## Architecture

```
agents/
  page_extractor.py     # Extraction OCR avec contexte glissant
  image_extractor.py    # Extraction d'images par page
  translator.py         # Traduction via LLM + cache
  typst_composer.py     # Assemblage et compilation Typst
models/
  page.py               # PageContext, TranslatedPage
services/
  llm_service.py        # Client Anthropic + retry (InternalServerError, RateLimitError)
  translation_cache.py  # Cache fichier JSON
themes/
  gabarit_standard.typ  # Roman littéraire A5
  gabarit_oreilly.typ   # Technique avec en-têtes courants
web/
  app.py                # Routes FastAPI
  db.py                 # SQLite (translations, police, theme)
  static/app.js         # UI + dark mode toggle
  templates/index.html  # Interface Tailwind dark-mode ready
config.py               # FONTS, THEMES, clés, chemins
main.py                 # Entrée CLI
```

## Règles importantes

- **Jamais de commit ou push sans validation explicite de l'utilisateur.**
- Typst 0.13 : pas de `locate()` (utiliser `context {}`), pas de `#sym.nbsp` (insérer U+202F / U+00A0 directement), pas de `orphan-mention`.
- Le cache est invalidé automatiquement si le system prompt change (hash MD5 intégré dans la clé).
- `counter(page).update(0)` doit être placé **à l'intérieur** du bloc disclaimer (pas après), sinon le reset arrive après l'évaluation de l'en-tête.

## Roadmap priorisée

Les items sont classés par ordre décroissant d'importance.

### 12. Créer un logo
- Design minimaliste cohérent avec l'identité visuelle (stone/indigo)
- Formats SVG + PNG pour usage dans l'UI et la page de garde

### 13. Décalage entre numéros de page PDF et pages sources dans l'éditeur
- Les gabarits (O'Reilly, Standard) injectent des pages de structure (couverture, disclaimer,
  page de garde…) avant le contenu traduit, créant un décalage entre le numéro affiché dans
  le visualiseur PDF et l'index stocké en base
- Trouver le décalage exact (ex : compter les pages de gabarit avant le contenu) et l'exposer
  via l'API (`GET /api/translations/{id}` ou route dédiée)
- Dans la modale d'édition, afficher un avertissement ou convertir automatiquement le numéro
  saisi (page PDF → index source)
