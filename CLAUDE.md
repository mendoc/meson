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

### 1. Répétition de contenu à la frontière de deux pages
- Le contexte glissant N-1/N/N+1 peut provoquer une duplication du texte en fin/début de page
- Identifier et supprimer les chevauchements lors de l'assemblage ou dans le prompt
- Exemple observé : PDF Systèmes complexes p. 1 et p. 2

### 2. Continuer une traduction interrompue
- Si le quota API ou les crédits sont épuisés en cours de traduction, permettre de reprendre
  depuis la dernière page traduite sans tout recommencer
- S'appuyer sur les pages déjà stockées en base (`translation_pages`)
- Ajouter une route `POST /api/translations/{id}/resume` et un bouton dans l'UI

### 3. Ne pas traduire un document déjà en français
- Détecter la langue source via `fitz` ou `langdetect` avant de lancer la traduction
- Afficher une erreur explicite si le document est déjà en français
- Évite des appels LLM coûteux et inutiles

### 4. Décalage entre numéros de page PDF et pages sources dans l'éditeur
- Les gabarits injectent des pages de structure (couverture, disclaimer, TDM…) avant le contenu,
  créant un décalage entre le numéro affiché dans le visualiseur PDF et l'index stocké en base
- Calculer le décalage exact et l'exposer via l'API
- Dans la modale d'édition, convertir automatiquement le numéro saisi (page PDF → index source)

### 5. Insérer les images lors de la composition
- Les images sont extraites par `ImageExtractor` mais pas encore insérées dans le PDF final
- Remplacer les balises `/* INSERT_IMAGE_HERE */` par de vraies figures Typst
- Gérer le positionnement et le redimensionnement dans les gabarits

### 6. Itérer sur un livre traduit — ajustements avancés
- Modifier le titre et l'auteur d'une traduction existante
- Définir des expressions à ne pas traduire (glossaire d'exclusion)
- Corriger les sauts de page et l'espacement entre sections
- Extension de la recompilation existante (étape 6)

### 7. WebSocket pour la progression en temps réel
- Remplacer le polling `setInterval` par un WebSocket ou Server-Sent Events
- Réduire la charge réseau et améliorer la réactivité de l'UI pendant la traduction

### 8. Panneau de détails d'une traduction
- Bouton "Détails" dans le viewer ou la sidebar
- Afficher : titre, auteur, date, modèle, police, thème, plage de pages, coût estimé
  (tokens entrée/sortie × tarif du modèle, affiché en dollars)

### 9. Utiliser Gemini pour l'inférence titre/auteur
- Remplacer l'appel Claude dans `infer_book_info()` par Gemini Flash (gratuit)
- Réduire les coûts d'inférence pour cette tâche non critique

### 10. Reprendre la lecture à la position exacte
- Mémoriser la position de lecture (page + scroll) par traduction dans `localStorage`
- Restaurer automatiquement à la réouverture d'une traduction

### 11. Réduire la sidebar
- Rendre la sidebar rétractable (icône toggle)
- Libérer de l'espace pour le visualiseur PDF sur les petits écrans

### 12. Affichage en grille dans la sidebar
- Ajouter un mode grille (vignettes) en complément du mode liste
- Toggle liste/grille persisté dans `localStorage`

### 13. Importer une police personnalisée
- Formulaire d'upload de fichier de police (TTF/OTF) dans les paramètres
- Stocker dans `fonts/` et l'exposer automatiquement à Typst

### 14. Interface d'édition de thème
- Éditeur visuel pour modifier les paramètres d'un gabarit (marges, taille de texte, couleurs)
- Générer dynamiquement le fichier `.typ` correspondant

### 15. Afficher la version de l'application sur l'UI
- Lire depuis `pyproject.toml` ou un fichier `VERSION`
- Afficher en bas de la sidebar ou dans le footer du header

### 16. Pipeline de déploiement Cloud Run
- Dockerfile optimisé pour Cloud Run (port 8080, variable `$PORT`)
- GitHub Actions : build, push sur Artifact Registry, déploiement automatique

### 17. Créer un logo
- Design minimaliste cohérent avec l'identité visuelle (stone/indigo)
- Formats SVG + PNG pour usage dans l'UI et la page de garde
