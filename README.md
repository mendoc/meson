# Méson — Agent de traduction éditoriale automatisée

Méson est un pipeline de traduction de livres anglais vers le français. Il produit des PDFs typographiquement corrects, composés en Typst, à partir d'un PDF source.

> **Avertissement** : les traductions produites sont non officielles et destinées à un usage d'apprentissage personnel. Elles ne remplacent pas une traduction validée par l'auteur ou l'éditeur.

---

## Fonctionnement

```
PDF anglais → OCR (PyMuPDF) → Traduction LLM (Claude) → Typst → PDF français
```

Chaque page est traduite avec une fenêtre de contexte glissant (page N-1, N, N+1) pour assurer la cohérence des phrases en bord de page. Le LLM génère directement du code Typst respectant les règles du Code Typographique de l'Imprimerie Nationale (guillemets français, espaces insécables, majuscules accentuées, etc.).

---

## Prérequis

- Docker et Docker Compose
- Une clé API Anthropic

---

## Installation

```bash
git clone <repo>
cd meson

# Créer le fichier d'environnement
echo "LLM_API_KEY=sk-ant-..." > .env

# Construire l'image
docker compose build
```

### Polices (optionnel)

Le projet supporte trois polices. Téléchargez celles que vous souhaitez depuis Google Fonts et placez-les dans `fonts/` :

| Slug | Police | Dossier cible |
|---|---|---|
| `crimson_pro` | [Crimson Pro](https://fonts.google.com/specimen/Crimson+Pro) | `fonts/crimson_pro/` |
| `lora` | [Lora](https://fonts.google.com/specimen/Lora) | `fonts/lora/` |
| `eb_garamond` | [EB Garamond](https://fonts.google.com/specimen/EB+Garamond) | `fonts/eb_garamond/` |

Sans polices installées, Typst utilise DejaVu Serif comme fallback.

---

## Utilisation

### Interface web

```bash
docker compose up web
```

Ouvrir [http://localhost:8000](http://localhost:8000) — uploader un PDF, renseigner le titre, l'auteur et la police, puis lancer la traduction. L'historique des sessions est conservé.

### Ligne de commande

```bash
docker compose run --rm meson python main.py \
  "input/mon-livre.pdf" \
  "Titre français" \
  "Prénom Nom" \
  crimson_pro          # optionnel, défaut : crimson_pro
```

Polices disponibles : `eb_garamond`, `crimson_pro`, `lora`.

Le PDF est généré dans `output/`.

---

## Structure

```
meson/
├── main.py                  # Point d'entrée CLI
├── config.py                # Clé API, modèle LLM, polices disponibles
├── template.typ             # Gabarit Typst (format A5, marges éditoriales)
├── agents/
│   ├── page_extractor.py    # Extraction de texte via PyMuPDF (fenêtre glissante)
│   ├── image_extractor.py   # Extraction des illustrations
│   ├── translator.py        # Orchestration traduction + vérification termes
│   └── typst_composer.py    # Assemblage .typ et compilation PDF
├── services/
│   └── llm_service.py       # Appel API Anthropic + sanitisation de la sortie
├── models/
│   └── page.py              # Modèles de données (PageContext, TranslatedPage)
├── utils/
│   └── typography.py        # Règles typographiques françaises, garde-fous
├── web/
│   ├── app.py               # API FastAPI (upload, pipeline en arrière-plan)
│   ├── db.py                # Persistance SQLite des sessions
│   └── templates/           # Interface Tailwind CSS
├── fonts/                   # Polices TTF (non versionnées, à télécharger)
├── input/                   # PDFs sources (non versionnés)
└── output/                  # PDFs traduits (non versionnés)
```

---

## Configuration

Toutes les variables sont dans `config.py` et peuvent être surchargées via `.env` :

| Variable | Défaut | Description |
|---|---|---|
| `LLM_API_KEY` | — | Clé API Anthropic (obligatoire) |
| `LLM_MODEL` | `claude-opus-4-7` | Modèle LLM |
| `DEFAULT_FONT` | `crimson_pro` | Police par défaut |

---

## Choix techniques

- **Typst** plutôt que LaTeX : syntaxe moderne, compilation rapide, gestion native des polices variables.
- **Claude Opus** : seul modèle capable de générer du code Typst valide tout en traduisant avec la nuance requise pour l'édition.
- **Fenêtre glissante N-1/N/N+1** : évite les phrases tronquées aux changements de page sans doubler les coûts d'API.
- **Génération directe en Typst** : le LLM ne traduit pas puis met en forme — il fait les deux en une passe, ce qui préserve la structure sémantique (titres, listes, citations, notes).
