#let projet-meson(
  titre: "Titre de l'Ouvrage Original",
  auteur: "Nom de l'Auteur",
  police: ("Crimson Pro", "Linux Libertine", "DejaVu Serif"),
  body
) = {
  // 1. Configuration de la page (Format Roman / Standard Édition)
  set page(
    paper: "a5",
    margin: (
      inside: 2.5cm,   // Petit fond pour la reliure
      outside: 3cm,    // Grand fond pour la prise en main (pouces)
      top: 2.5cm,      // Chef
      bottom: 3.5cm,   // Pied (assise visuelle)
    ),
    numbering: "1",
    number-align: center + bottom,
  )

  // 2. Configuration du texte et du "Gris Typographique"
  set text(
    font: police,
    size: 11pt,
    lang: "fr",
  )

  set par(
    justify: true,
    leading: 0.75em,
    first-line-indent: 1.25em,
  )

  // 3. Contrôle veuves/orphelines (via block breakable: false sur les courts blocs)
  set block(breakable: true)

  // 4. Page d'avertissement légale obligatoire (Spécification Méson)
  page(numbering: none)[
    #set text(font: ("EB Garamond", "Linux Libertine", "DejaVu Serif"), size: 10pt)
    #set par(first-line-indent: 0pt)
    #align(center + horizon)[
      #block(width: 92%, stroke: 0.5pt + luma(120), inset: 2em, radius: 4pt)[
        *AVERTISSEMENT DE TRADUCTION*
        #v(1em)
        Cet ouvrage est une traduction automatique réalisée par l'agent de recherche et
        d'édition _Méson_.

        Il s'agit d'une traduction *non officielle* qui n'a pas été validée, revue ou
        approuvée par l'auteur d'origine ni par sa maison d'édition.

        Cette version est produite exclusivement dans un but d'accès à l'apprentissage
        et au savoir, pour des zones linguistiques ne disposant pas encore d'une
        traduction francophone officielle.
      ]
    ]
  ]

  counter(page).update(1)
  body
}

// Initialisation par le script principal
#show: projet-meson.with(titre: "Titre Ouvrage Target", auteur: "Auteur Target", police: ("Crimson Pro", "Linux Libertine", "DejaVu Serif"))
