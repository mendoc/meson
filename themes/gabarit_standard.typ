#let gabarit-standard(
  titre: "Titre de l'Ouvrage Original",
  auteur: "Nom de l'Auteur",
  police: ("Crimson Pro", "Linux Libertine", "DejaVu Serif"),
  couverture: false,
  toc: false,
  body
) = {
  set page(
    paper: "a5",
    margin: (
      inside: 2.5cm,
      outside: 3cm,
      top: 2.5cm,
      bottom: 3.5cm,
    ),
    numbering: "1",
    number-align: center + bottom,
  )

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

  set block(breakable: true)

  if couverture {
    page(numbering: none)[
      #set par(first-line-indent: 0pt)
      #align(center + horizon)[
        #text(font: police, size: 28pt, weight: "bold")[#titre]
        #v(1.5em)
        #text(font: police, size: 14pt, style: "italic")[#auteur]
      ]
      #place(bottom + center, dy: -2.5em)[
        #text(size: 8pt, fill: luma(180))[Méson · #datetime.today().display("[year]")]
      ]
    ]
  }

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
    // Reset à 0 ici : Typst incrémente à la coupure de page, donc la 1ère page du corps = 1.
    #counter(page).update(0)
  ]

  if toc {
    page(numbering: none)[
      #set par(first-line-indent: 0pt)
      #text(font: police, size: 16pt, weight: "bold")[Table des matières]
      #v(1.5em)
      #outline(title: none, indent: 1em, depth: 3)
    ]
  }

  body
}
