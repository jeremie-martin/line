# Round 30 drafts: 16 themes (r30)

Made with the COLOUR-TOOLS workflow: OKLab k-means on each artwork (museum backdrop removed, the top 3 % chroma clustered separately: `swatches/`), the hot note set first with culori at pigment chroma, ink (≥ 12:1), a neutral pencil (1.9:1) and bars placed with Leonardo (with a correction loop, because on dark papers Leonardo's ratios overshoot by about a third), all numbers measured with culori (`measure.txt`). The sampled photographs are greyer than the works; each hot note is the work's vivid-tail hue raised to pigment chroma. Stills at 18 s and 44.65 s: `overview.jpg`.

Distance = √(ΔE_paper² + ΔE_bars² + ΔE_accent²), OKLab Euclidean, against the 87 in set 2026-11-09-themes.

| # | Theme | Ground | Look | Source | Hot note | Accent C | Paper C | Ink | Nearest existing (d) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Blue and White Porcelain | light | fork, sun, drop off | Arita-ware apothecary bottle, 1670/80, AIC 104489 | cobalt (#284ab2) | 0.17 | 0.006 | 14:1 | Buff and Lapis (0.125) |
| 2 | Cobalt and Chartreuse | dark | bars, sun, drop off | Kandinsky, Houses at Murnau, 1909, AIC 129849 | chartreuse (Kandinsky's yellow-green) (#bbd14a) | 0.159 | 0.025 | 14:1 | Ultramarine, brighter bars (0.174) |
| 3 | Rose Enamel and Malachite | light | bars, sun, drop switch | Ruby-back famille-rose dish, Yongzheng, AIC 221163 | malachite green; switch to a ruby-black partner (#00915f) | 0.131 | 0.009 | 13.9:1 | Viridian and Sienna (0.211) |
| 4 | Turquoise and Lustre | dark | fork, sun, drop off | Ilkhanid eight-point star tile with a phoenix, late 13th c., AIC 92287 | turquoise glaze (#3cc5be) | 0.115 | 0.02 | 14.1:1 | Cerulean and Bronze (0.234) |
| 5 | Lily White and Leaf Green | dark | bars, sun, drop off | Tiffany, Lilies (Corey Memorial Window), 1892–95, AIC 192781 | leaf green (#63b650) | 0.161 | 0.025 | 14.1:1 | Blue and Rose (0.237) |
| 6 | Kingfisher and Cinnabar | dark | bars, sun, drop off | Ming cloisonné bowl with mandarin ducks, 16th c., AIC 32643 | cinnabar (#dc593f) | 0.17 | 0.011 | 15:1 | Madder and Olive (0.189) |
| 7 | Grey Blue and Madder | light | bars, title, drop night | Koloman Moser, Woman's Head with Roses (stencil), 1899, AIC 59846 | madder rose; title (#aa2e4a) | 0.16 | 0.028 | 12:1 | Silver and Rust, middle bars (0.183) |
| 8 | Khaki and Mauve | light | fork, sun, drop off | Wiener Werkstätte, panel (dress or furnishing fabric), 1903/05, AIC 153010 | mauve (#a258ae) | 0.149 | 0.005 | 14:1 | Violet and Petrol (0.139) |
| 9 | Olive and Krishna Blue | light | bars, sun, drop switch | Krishna Fluting for the Gopis, late 18th/early 19th c., AIC 131815 | Krishna blue; switch to an olive-black partner (#2575bd) | 0.135 | 0.02 | 14:1 | Buff and Lapis, tuned (0.165) |
| 10 | Coptic Purple and Leaf Green | light | bars, none, drop night | Coptic roundel fragment, 7th c., AIC 1833 | leaf green (#529e41) | 0.149 | 0.019 | 14:1 | Viridian and Sienna (0.152) |
| 11 | Pink and Prussian Blue | light | bars, none, drop night | Hiroshige, Hamamatsu (Tokaido), c. 1837/42, AIC 4371 | Prussian blue (#2751b8) | 0.17 | 0.015 | 14:1 | Ochre and Ultramarine (0.143) |
| 12 | Gilt and Lapis | dark | bars, title, drop off | Reliquary casket, Limoges champlevé enamel, c. 1200, AIC 46253 | lapis blue; title (#4885df) | 0.151 | 0.016 | 14.1:1 | Violet and Peach (0.159) |
| 13 | Teal and Fuchsia | light | bars, sun, drop off | Ikat wall hanging of five panels, 1850/75, AIC 185616 | fuchsia (#ae2c77) | 0.18 | 0.022 | 14:1 | Emerald and Cerise (0.156) |
| 14 | Ochre and Magenta | dark | bars, sun, drop off | Ikat woman's robe, 1840/60, AIC 185619 | magenta (#ca549d) | 0.17 | 0.015 | 14:1 | Madder and Olive (0.148) |
| 15 | Ink Black and Kingfisher | light | bars, sun, drop night | Ming cloisonné bowl (black wire, turquoise enamel), AIC 32643 | kingfisher blue (#1c7eab) | 0.109 | 0.004 | 15:1 | Buff and Lapis, Wada 345 (0.169) |
| 16 | Iris Green and Violet | dark | bars, none, drop off | Hiroshige, Irises at Horikiri, 1857, AIC 34100 | iris violet (#bb8aef) | 0.15 | 0.025 | 14.1:1 | Madder and Olive, Wada 277 (0.168) |

## Caveats
- **Hot notes below .15**, because sRGB cannot do more in cyan at these lightnesses (max ≈ .11 at L .6, .13 at L .75): Ink Black and Kingfisher .109, Turquoise and Lustre .115, Rose Enamel's malachite .131, Krishna blue .135. They sit near the gamut edge. Pushing them further would make them screen colours.
- **Nearest distances under .15:** Blue and White Porcelain to Buff and Lapis (.125); Khaki and Mauve to Violet and Petrol (.139); Pink and Prussian Blue to Ochre and Ultramarine (.143); Ochre and Magenta to Madder and Olive (.148). By eye all four look distinct: the paper differs, or the bars differ in role. Among the drafts, the closest pairs are Grey Blue and Madder / Teal and Fuchsia (.131).
- Ingredients repeat across drafts in different roles: turquoise (accent of 4, bars of 6 and 13, accent of 15); leaf green (accents of 5 and 10); cobalt or blue accents (1, 9, 11, 12).
- Dark papers are inked from the start (`line: ink`). Night replaces the sun with a white disc (Ink Black and Kingfisher at 44.65 s); that is the renderer's behaviour.
- I picked the drop partners' colours by eye, at 44.65 s only. I have not checked whether the main look reads stronger than its partner across the whole song.
- The Horikiri print's irises have faded to salmon, and the Coptic purple samples brown (h 19). There the hue was chosen from what the pigment was, not from the photograph.

Files: `draft.json` (deliverable), `spec.json` (OKLCH inputs), `gen.mjs` (Leonardo + culori), `measure.txt`, `jobs.json`, `stills/`, `images/` and `swatches/` (sources and their clusters), `gaps.mjs` (which combinations are still unused), `check.mjs` (validates options and labels).
