// Round 7 palettes (agents/palettes-r7): hand-tuned, each from a named source. Token format as lab.js SCHEMES.
// L* figures (paper / ink / bars / accent) are given so lightness can be checked at a glance; every ink sits ≥ 63 L* from its paper.
export const PALETTES = {
  // LIGHT
  // Cahier Seyès (French school exercise book): blue-black Quink ink, pale ruled-blue bars, the red margin as accent.
  // Character: schoolroom-crisp and friendly; coloured ink that still reads (98 / 24 / 73 / 49).
  cahier: {paper: '#fbfaf4', ink: '#1d357a', pencil: '#c3cbe0', mass: '#9fb3db', accent: '#d8343a', nightPaper: '#14244f', nightInk: '#fbfaf4'},
  // Toile de Jouy (one-colour copperplate on cotton): cream, oxblood line, faded-madder bars, the loudest bar in full oxblood.
  // Character: a single-ink print, elegant and quiet; accent darker than the bars, not brighter (95 / 23 / 70 / 31).
  toile: {paper: '#f4efe5', ink: '#6a1520', pencil: '#d9c4bb', mass: '#cfa59c', accent: '#8f1b28', sun: '#c9585a', nightPaper: '#2a0a10', nightInk: '#f4efe5'},
  // Eric Ravilious (chalk downs, 1930s watercolour and wood engraving): chalky paper, green-black line, sage bars, one ochre.
  // Character: English pastoral, cool and gentle (94 / 20 / 49 / 77).
  ravilious: {paper: '#f0eee2', ink: '#24342c', pencil: '#bfc3b2', mass: '#5f7a65', accent: '#eeb52f', nightPaper: '#18241e', nightInk: '#f0eee2'},
  // Lavender (a refined Mauve, after the owner's "slightly too pink"): grey lilac paper, aubergine line, dusk-violet bars, apricot.
  // Character: Plum's daytime side without the pink (94 / 15 / 43 / 72).
  lavender: {paper: '#eeecf1', ink: '#28213a', pencil: '#c2bdcb', mass: '#6c6185', accent: '#f0a04f', nightPaper: '#1c1025', nightInk: '#f5e9fb'},
  // Kraft (screenprint on brown kraft paper, gig posters): mid-tone paper, black line, umber bars, the loudest bar in white ink.
  // Character: graphic, tactile, the first mid-tone paper; the accent is pure lightness (75 / 7 / 26 / 98).
  kraft: {paper: '#d2b48e', ink: '#1a140e', pencil: '#a2845f', mass: '#4a3a2a', accent: '#fffaf0', sun: '#f7f1e3', nightPaper: '#1a140e', nightInk: '#e6d2b4'},
  // Blade Runner 2049, the Las Vegas sequence (Deakins' orange haze): orange air, black line, burnt bars, a white-hot bar.
  // Character: the boldest light scheme, Dune turned up to full heat (73 / 8 / 35 / 95).
  vegas: {paper: '#e9a866', ink: '#2a1206', pencil: '#bd7b40', mass: '#8a3a10', accent: '#fff0d4', sun: '#fbe2b8', nightPaper: '#2a1206', nightInk: '#e9a866'},

  // DARK
  // Cyanotype (Anna Atkins' blueprint photograms): Prussian-blue paper, the line in paper white, pale-blue bars, one yellow.
  // Character: a mid-dark, luminous blue rather than night; cool and clear (32 / 95 / 57 / 83).
  cyanotype: {paper: '#1f4a86', ink: '#f4f1e6', pencil: '#5576a6', mass: '#6a8bbd', accent: '#ffc83d', nightPaper: '#122e57', nightInk: '#f4f1e6'},
  // Kintsugi (Japanese gold repair on black urushi lacquer): the ridden line becomes gold; lacquer-red bars; the loudest in gold.
  // Character: precious and dramatic; coloured ink that reads by lightness (6 / 78 / 35 / 84). Suggested sun: lacquer red.
  kintsugi: {paper: '#141210', ink: '#e2bb5f', pencil: '#433d34', mass: '#8e3427', accent: '#f2cc6e', sun: '#c43a2c', nightPaper: '#141210', nightInk: '#e2bb5f'},
  // Rothko, the Seagram murals (maroon on maroon): deep maroon paper, a peach-cream line, brick bars, a candle-gold bar.
  // Character: warm, saturated dark; a red room rather than a black one (7 / 89 / 46 / 83).
  rothko: {paper: '#2b0c10', ink: '#f6dcc4', pencil: '#6a3a38', mass: '#b84a42', accent: '#ffc46b', nightPaper: '#1a0709', nightInk: '#f6dcc4'},
  // Café (Espresso refined, after the owner's verdict that Dune's amber suited it): coffee, cream line, darker latte bars, amber.
  // Character: Black's warm sibling; the latte bars are darkened so the amber stands apart in lightness (7 / 93 / 49 / 77).
  cafe: {paper: '#1e130e', ink: '#f4ead9', pencil: '#584d45', mass: '#8a6f58', accent: '#ffb000', nightPaper: '#1e130e', nightInk: '#f4ead9'},
};
