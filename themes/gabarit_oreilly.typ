#let gabarit-oreilly(
  titre: "Titre de l'Ouvrage Original",
  auteur: "Nom de l'Auteur",
  police: ("Crimson Pro", "Linux Libertine", "DejaVu Serif"),
  couverture: false,
  toc: false,
  body
) = {
  // 1. GÉOMÉTRIE DE LA PAGE
  set page(
    paper: "a5",
    margin: (
      inside: 2.2cm,
      outside: 2.6cm,
      top: 2.5cm,
      bottom: 2.8cm,
    ),
    header: context {
      let page-num = counter(page).get().first()
      if page-num <= 1 { return }
      set text(font: ("Lora", "Arial", "DejaVu Sans"), size: 8.5pt, fill: rgb("#4a5568"))
      if calc.even(page-num) {
        grid(
          columns: (1fr, 1fr),
          align(left)[#page-num],
          align(right)[#titre]
        )
      } else {
        grid(
          columns: (1fr, 1fr),
          align(left)[#auteur],
          align(right)[#page-num]
        )
      }
    },
    footer: none,
  )

  // 2. CORPS DE TEXTE
  set text(
    font: police,
    size: 10.5pt,
    lang: "fr",
  )

  set par(
    justify: true,
    leading: 0.68em,
    first-line-indent: 1.5em,
  )

  set block(breakable: true)

  // Pas d'alinéa après un titre
  show heading: it => {
    set par(first-line-indent: 0pt)
    it
    v(0.5em)
  }

  // 3. STYLES DE TITRES
  show heading.where(level: 1): it => block(width: 100%, below: 2em)[
    #set text(font: ("Lora", "DejaVu Serif"), weight: "bold", fill: rgb("#1a202c"))
    #smallcaps(it.body)
    #v(0.2em)
    #line(length: 100%, stroke: 1.5pt + rgb("#1a202c"))
  ]

  show heading.where(level: 2): it => block(below: 1em, above: 1.8em)[
    #set text(font: ("Lora", "DejaVu Serif"), size: 13pt, weight: "bold", fill: rgb("#2d3748"))
    #it.body
  ]

  // 4. CODE INLINE
  show raw.where(block: false): it => box(
    fill: rgb("#edf2f7"),
    inset: (x: 3pt, y: 0pt),
    radius: 2pt,
    baseline: 0%,
    outset: (y: 2pt),
  )[#set text(font: ("Courier New", "DejaVu Sans Mono"), size: 9pt); #it]

  set list(marker: ([•],), body-indent: 0.6em)

  // 5. PAGE DE GARDE (optionnelle)
  if couverture {
    page(header: none, numbering: none)[
      #set par(first-line-indent: 0pt)
      #align(center + horizon)[
        #text(font: police, size: 28pt, weight: "bold")[#titre]
        #v(1.5em)
        #text(font: ("Lora", "DejaVu Serif"), size: 14pt, style: "italic")[#auteur]
      ]
      #place(bottom + center, dy: -2.5em)[
        #text(size: 8pt, fill: rgb("#a0aec0"))[Méson · #datetime.today().display("[year]")]
      ]
    ]
  }

  // 6. PAGE D'AVERTISSEMENT
  page(header: none)[
    #set text(font: ("Arial", "DejaVu Sans"), size: 9.5pt)
    #set par(first-line-indent: 0pt, justify: false)
    #align(center + horizon)[
      #block(
        width: 85%,
        stroke: 0.5pt + rgb("#cbd5e1"),
        inset: 2.5em,
        radius: 6pt,
        fill: rgb("#f7fafc"),
      )[
        #text(weight: "bold", size: 11pt, fill: rgb("#c53030"))[AVERTISSEMENT DE TRADUCTION]
        #v(1.2em)
        Cet ouvrage est une traduction de courtoisie automatisée produite par le système
        d'ingénierie éditoriale *Méson*.
        #v(0.8em)
        Il s'agit d'une version *non officielle*. Le texte n'a pas été révisé, validé ou
        approuvé par l'auteur original, ni par la maison d'édition détentrice des droits.
        #v(0.8em)
        Destiné exclusivement à un usage d'apprentissage personnel et d'accès au savoir.
      ]
    ]
    // Reset à 0 ici : Typst incrémente à la coupure de page, donc la 1ère page du corps = 1.
    #counter(page).update(0)
  ]

  if toc {
    page(header: none, numbering: none)[
      #set par(first-line-indent: 0pt)
      #text(font: ("Lora", "DejaVu Serif"), size: 16pt, weight: "bold", fill: rgb("#1a202c"))[Table des matières]
      #v(1.5em)
      #outline(title: none, indent: 1em, depth: 3)
    ]
  }

  body
}
