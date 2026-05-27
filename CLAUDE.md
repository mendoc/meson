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

### 1. Paramétrer le LLM via l'interface (modèle, clé API)
- Formulaire dans les settings web pour saisir `ANTHROPIC_API_KEY` et choisir le modèle
- Persistance en base (table `settings`) ou fichier `.env` local
- Affichage d'un indicateur de validité de la clé

### 2. Supprimer des traductions
- Bouton de suppression dans la sidebar (avec confirmation)
- Route `DELETE /api/translations/{id}` : supprime entrée DB + fichiers output associés
- Mise à jour de la liste en temps réel

### 3. Choisir la plage de pages à traduire
- Champs `page_debut` / `page_fin` dans le formulaire de nouvelle traduction
- Valeurs par défaut : première et dernière page du PDF
- Passer la plage à `PageExtractor` et n'itérer que sur ce sous-ensemble

### 4. Ajouter un prompt personnalisé
- Zone de texte optionnelle dans le formulaire : instructions supplémentaires pour la traduction
- Injectée dans `SYSTEM_PROMPT` ou comme message utilisateur supplémentaire dans `LLMService.compose()`
- Persistée en base avec la traduction

### 5. Traduction asynchrone — consultation en cours de génération
- Exposer les pages déjà traduites via `GET /api/translations/{id}/pages`
- Stocker chaque `TranslatedPage` en base ou fichier intermédiaire au fil de la traduction
- Afficher un PDF partiel (pages déjà compilées) pendant que les suivantes arrivent

### 6. Itérer sur un livre traduit
- Permettre de relancer la compilation Typst avec de nouveaux paramètres (police, thème) sans re-traduire
- Permettre de corriger le texte d'une page spécifique et recompiler
- S'appuyer sur le cache existant pour ne rappeler le LLM que sur les pages modifiées

### 7. Sauvegarder les derniers paramètres de traduction
- Lire depuis `localStorage` (côté client) les derniers choix de police, thème, prompt
- Pré-remplir le formulaire au chargement

### 8. Enregistrer les paramètres ayant servi à une traduction
- La DB stocke déjà `police` et `theme` — ajouter `model`, `prompt_custom`, `page_debut`, `page_fin`
- Afficher ces infos dans le panneau de détail d'une traduction

### 9. Auteur et titrage automatique
- Lire les métadonnées PDF (`fitz.open(pdf).metadata`) pour pré-remplir titre et auteur
- Route `POST /api/inspect` qui reçoit le fichier et renvoie `{titre, auteur}`
- Remplissage automatique des champs dès le dépôt du PDF

### 10. Générer une page de garde
- Ajouter un bloc Typst de page de garde (titre, auteur, logo Méson, date) dans les gabarits
- Option activable par l'utilisateur

### 11. Table des matières
- Extraire les titres de chapitres depuis l'OCR ou les signets PDF
- Générer un bloc `outline()` Typst en début de document

### 13. Décalage entre numéros de page PDF et pages sources dans l'éditeur
- Les gabarits (O'Reilly, Standard) injectent des pages de structure (couverture, disclaimer,
  page de garde…) avant le contenu traduit, créant un décalage entre le numéro affiché dans
  le visualiseur PDF et l'index stocké en base
- Trouver le décalage exact (ex : compter les pages de gabarit avant le contenu) et l'exposer
  via l'API (`GET /api/translations/{id}` ou route dédiée)
- Dans la modale d'édition, afficher un avertissement ou convertir automatiquement le numéro
  saisi (page PDF → index source)

### 12. Créer un logo
- Design minimaliste cohérent avec l'identité visuelle (stone/indigo)
- Formats SVG + PNG pour usage dans l'UI et la page de garde
