# Wada schemes: notes

## Files
- `wada.mjs`: the scoring pass. It tries every role assignment of every 3- and 4-colour combination (228 of 348) against the owner's verdicts and keeps the best one per combination. Output: `candidates.json` (103 assignable), `shortlist.json` (40 kept for variety, at most 4 per bar-hue bucket and 5 on plain Black).
- `curate.mjs`: the hand-curated finalists. Each role names a Wada colour of one combination, and every OKLCH adjustment is written out. It writes `schemes.js`.
- `schemes.js`: `export const WADA` (12 schemes, lab token format, with a comment per scheme).
- `sheet.png`: the 12 finalists in context, at lua 36.5 s, los 45 s and petrunko 28 s (swatch preset).
- `mock/`: a copy of the lab that loads `cands.js` and `../schemes.js` into SCHEMES. It contains `shoot.mjs` (Playwright, `node shoot.mjs out=DIR names=a,b shots=lua:36.5`). The lab files themselves were not touched.

## Approach
1. **Score.** For each combination, try every (paper, bars, accent) triple. Ink is the remaining colour if it is ≥ 0.62 L away from the paper; otherwise a near-black or near-white tinted toward the bars is made.
   - **Hard rules:** the paper is an extreme (light ≥ .85, dark ≤ .29), or a Kraft-like mid-tone (.6–.8) that keeps some colour and has darker bars. No saturated orange or green papers. The accent must be visible.
   - **Soft rules:** bars carry more chroma than the paper. The paper sits in the bars' hue family or is near-neutral. The bar/paper lightness step is .38–.6 (light) or .32–.62 (dark), with a penalty above that because a bigger step looked harsh. The accent is ≥ .12 L from the bars and warm by preference. Penalties for a cyan accent on brown, a fluorescent pink on blue/violet, olive bars on a light paper, and heavy chroma cuts to the paper (they lose Wada's character).
2. **Look.** Rendered all 40 at lua 36.5, then tightened the rules after looking (round 2 in the code comments).
3. **Curate by hand.** For the finalists I sometimes overrode the scorer's choice with a better reading of the same combination, e.g. Brick uses no. 325's own Deep Slate Green as its ink. Adjustments stay small: mostly the paper's L/C, and an accent lifted in L so it parts from the bars.

## What held up when I looked
- **Bars more colourful than the paper: held strongly.** Every Wada light colour used as a paper had to be quietened: Ivory Buff .069 → .026, Sulpher Yellow .055 → .02, Naples Yellow .091 → .03. At C .035 the light papers still read as *tinted* (yellow, mint, ice blue), so the cap became .02, or .03 for warm hues 40–95°. Dune's .031 is about the limit, and only for warm papers.
- **Accent parted from the bars in lightness: held.** Where Wada's accent sat at the bars' lightness (Jasper Red on Benzol Green, both L ≈ .62), it disappeared at phone scale until it was lifted by ~.12–.15 L.
- **Dark near-neutral papers with a hint of the bars' hue: held.** Wada's Black tinted by C .014 toward the bars, and Dull Violet Black / Deep Indigo / Deep Slate Green quietened to C .025–.04, all look like rooms rather than voids.
- **Mid-tone papers: mixed.** Ecru (no. 279, 249) works as a Kraft sibling once its chroma stays ≥ .045 (Denim raised to .052). Wada's mid greens and teals (Sea Green, Benzol Green, Artemesia Green) and mid lilacs (Grayish Lavender, Light Mauve) all read as coloured card, so the scorer now rejects mid green/teal papers. Light bars on a mid paper glared (Yellow on Cerulean Blue, no. 240).
- **Olive bars on cream: still the weakest look.** The scorer kept proposing them because Wada has many olive/citron/cream combinations, so it now penalises them. The same goes for Citrine as an accent on red (the first Brick); it read as khaki.
- **Pale tinted papers in the bars' own hue** (Nile Blue under Antwerp Blue, Turquoise Green under Green) looked weaker than an ivory under the same bars. This matches the owner's "a little more colour in the paper at the bars' hue looked worse".
- **Plain Black + two colours** is Wada's commonest dark pattern and scored highest at first, but most of those combinations look generic (the Black scheme already exists). I kept two, Magenta and Viridian, and tinted their paper.

## Failed or dropped
- Saffron (no. 151): Prussian with a yellow-orange accent. Fine, but too close to Prussian, and Sulpher Yellow quietened reads greenish-grey.
- Pomegranate (no. 271): a cool magenta accent on teal bars. Christmas-ish, and cool on cool.
- Lyons (no. 126): Deep Lyons Blue is almost exactly Hokusai's bar colour.
- Olive-family candidates (no. 320, 310, 203, 319) and the mid-tone green papers (no. 247, 312, 219).

## Weak points still in the finalists
- **Gilt:** its accent (Eugenia Red) is *darker* than the gold bars. It reads, but less clearly than the others. It is also Kintsugi's relative (coloured ink, gold).
- **Viridian and Indigo Teal** are both cool dark green/teal schemes; one may be enough.
- **Magenta and Old Rose** are both rose-on-dark. Old Rose is the softer and more elegant of the two.
- **Light schemes' night:** the scorer makes a dark at the bars' hue. Only Brick has a Wada night: Gilt's paper and Naples Yellow ink from the same combination no. 325, so Brick → Gilt is a natural drop pair.
