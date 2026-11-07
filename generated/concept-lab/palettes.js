// Palettes for the concept lab: every scheme, its variants, the owner's library tiers and the drop partners.
// Moved verbatim out of lab.js (R20 cleanup); the order of definitions is unchanged, so every colour is identical.
// A scheme is colours only (LEDGER.md: Schemes). Tokens: paper, ink, pencil, mass (the bars), accent, sun?, nightPaper, nightInk.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));

// A scheme is a whole print identity: every colour below comes from these tokens. Validated in agents/round4-ideas (contrast, 4:2:0).
export const SCHEMES = {
  graphite: {tone: '#eef2f8', paper: '#ffffff', ink: '#15181d', pencil: '#b4bcc8', mass: '#3b414a', accent: '#d3262e', nightPaper: '#14171d', nightInk: '#eef1f5'},
  hokusai: {paper: '#f4ecdc', ink: '#12294d', pencil: '#b8b4a4', mass: '#1d3e73', accent: '#d4412a', nightPaper: '#0d1f3f', nightInk: '#f4ecdc'},
  klein: {paper: '#ffffff', ink: '#0d1433', pencil: '#b4bcd8', mass: '#0f2fb5', accent: '#f2500f', nightPaper: '#0a1a6e', nightInk: '#f5f7ff'},
  bottle: {paper: '#f3f1e4', ink: '#0e2e27', pencil: '#b0b9a8', mass: '#14604c', accent: '#c96805', nightPaper: '#0a2a23', nightInk: '#f6efcf'},
  salmon: {paper: '#fce6d9', ink: '#3a1024', pencil: '#cfb3a8', mass: '#7a1438', accent: '#007a78', nightPaper: '#2b0a1a', nightInk: '#fce6d9'},
  black: {paper: '#101216', ink: '#eef1f5', pencil: '#4c535f', mass: '#c9ced6', accent: '#ff4d3d', nightPaper: '#101216', nightInk: '#eef1f5'},
  lagoon: {paper: '#e6f1ef', ink: '#052b35', pencil: '#a9c3c1', mass: '#0e6f78', accent: '#f4623a', nightPaper: '#06262e', nightInk: '#e6f1ef'},
  riso: {paper: '#f7f3e9', ink: '#1a2f9c', pencil: '#b9b7cf', mass: '#2a47c9', accent: '#ff3d7f', nightPaper: '#14206e', nightInk: '#f7f3e9'},
  dune: {paper: '#efe2cd', ink: '#3a2115', pencil: '#c4b197', mass: '#8c3a1c', accent: '#e39a1b', sun: '#d8622a', nightPaper: '#2a160d', nightInk: '#efe2cd'},
  plum: {paper: '#1c1025', ink: '#f5e9fb', pencil: '#5c4a6a', mass: '#cfb2e6', accent: '#ffb000', nightPaper: '#1c1025', nightInk: '#f5e9fb'},
  // Round 6 candidates (agents/colour-r6): lightness first, since a thin line on a phone is read by lightness and 4:2:0 encoding
  // keeps only 10–60 % of a thin line's chroma. Near-black ink on calm paper; colour lives in the band, the accent and the sun.

  // Fog over a harbour: blue-grey paper, slate band, one mustard bar. Cool, calm, muted.
  slate: {paper: '#ecf1f5', ink: '#131e2b', pencil: '#aeb9c2', mass: '#486176', accent: '#deac2e', nightPaper: '#101c28', nightInk: '#ecf1f5'},
  // A 1970s print: linen, olive band, a tomato bar and an ochre sun. Warm and a little retro.
  olive: {paper: '#f3efdc', ink: '#222312', pencil: '#bebba9', mass: '#5c6325', accent: '#ed6b42', sun: '#e3ad4b', nightPaper: '#1a1c08', nightInk: '#f3efdc'},
  // Dusk: a pale mauve paper, dusty violet band, apricot bar; the day side of Plum, which is its night.
  mauve: {paper: '#f5edf4', ink: '#291c2f', pencil: '#c2b6c5', mass: '#72577f', accent: '#ed9c55', nightPaper: '#1c1025', nightInk: '#f5e9fb'},
  // Bold: bone paper, solid black bars, one cobalt bar. The loudest light scheme, loud by contrast rather than colour.
  bauhaus: {paper: '#f6f3eb', ink: '#0f0f0f', pencil: '#c0beb8', mass: '#161616', accent: '#3672e9', nightPaper: '#0f0f0f', nightInk: '#f6f3eb'},
  // Brush and seal: warm white, sumi ink, a pale grey band, and the accent as a vermilion stamp. The quietest band.
  sumi: {paper: '#f7f3ec', ink: '#1a1512', pencil: '#c2bdb7', mass: '#aaa39d', accent: '#d33e21', nightPaper: '#1a1512', nightInk: '#f7f3ec'},
  // Deep night blue, steel band, an amber bar, a pale moon instead of a sun.
  midnight: {paper: '#0b1726', ink: '#ebf1f7', pencil: '#4a5666', mass: '#7b95b0', accent: '#fda856', sun: '#d8d1bb', nightPaper: '#0b1726', nightInk: '#ebf1f7'},
  // Warm dark: coffee paper, cream line, latte band, one verdigris bar.
  espresso: {paper: '#1e130e', ink: '#f4ead9', pencil: '#584d45', mass: '#ae9278', accent: '#65d2d2', nightPaper: '#1e130e', nightInk: '#f4ead9'},
  // Forest at night: green-black paper, ivory line, sage band, one pale coral bar.
  moss: {paper: '#0c1c12', ink: '#eff0e1', pencil: '#445547', mass: '#809b80', accent: '#f9a782', nightPaper: '#0c1c12', nightInk: '#eff0e1'},
  // Round 7 candidates (agents/palettes-r7): designed by hand from named sources, not from a metric. Not yet shown to the owner.

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
  // Round 10: from Sanzo Wada's Dictionary of Color Combinations (agents/wada): each a proven combination, assigned to our roles
  // with the rules learned from the owner's verdicts (bars carry more colour than the paper; paper and bars in one family, etc.).

  // Prussian — Wada no. 343 (Burnt Sienna, Ivory Buff, Deep Grayish Olive, Vandar Poel's Blue).
  //   paper Ivory Buff · bars Vandar Poel's Blue · accent Burnt Sienna · ink made · adjusted: paper L 0.875→0.935, C 0.069→0.026; accent L 0.546→0.63
  //   Hokusai's sea-green cousin: ivory, a deep Prussian teal band, one burnt-sienna bar.
  wPrussian: {paper: '#f2e9d6', ink: '#0b2532', pencil: '#adaea5', mass: '#064f6e', accent: '#ca6b3f', nightPaper: '#041620', nightInk: '#f2e9d6'},
  // Brick — Wada no. 325 (Eugenia Red | B, Naples Yellow, Yellow Ocher, Deep Slate Green).
  //   paper Naples Yellow · bars Eugenia Red | B · accent Yellow Ocher · ink Deep Slate Green · adjusted: paper L 0.926→0.945, C 0.091→0.03, h 93.367→85; mass L 0.622→0.54, C 0.17→0.16; ink L 0.281→0.24; night paper L 0.281→0.21, C 0.036→0.025
  //   Naples-yellow cream, a rose-brick band, one ochre bar, the line in Wada's deep slate green; its night is Gilt.
  wBrick10: {paper: '#f6ecd7', ink: '#062522', pencil: '#aeb0a1', mass: '#b93c48', accent: '#e2b540', nightPaper: '#091c1a', nightInk: '#fbe6a0'},
  wBrick: {paper: '#f6ecd7', ink: '#062522', pencil: '#aeb0a1', mass: '#b93c48', accent: '#cd9205', nightPaper: '#091c1a', nightInk: '#fbe6a0'},  // R11: accent deepened (L .79 → .70) so it parts from the cream paper
  // Orchid — Wada no. 315 (Grenadine Pink, Sulpher Yellow, Golden Yellow, Eupatorium Purple).
  //   paper Sulpher Yellow · bars Eupatorium Purple · accent Golden Yellow · ink made · adjusted: paper L 0.94→0.95, C 0.055→0.018; mass L 0.605→0.55
  //   Cream, an orchid band, a marigold bar: Lavender's warmer, pinker sister.
  wOrchid: {paper: '#f2efe1', ink: '#2d1723', pencil: '#b7aea8', mass: '#ac4781', accent: '#f3a257', nightPaper: '#1f0d17', nightInk: '#f2efe1'},
  // Verdigris — Wada no. 266 (Spectrum Red, Ivory Buff, Rainette Green, Benzol Green).
  //   paper Ivory Buff · bars Benzol Green · accent Spectrum Red · ink made · adjusted: paper L 0.875→0.935, C 0.069→0.026; mass L 0.609→0.52; accent L 0.586→0.66
  //   Ivory, a verdigris band, one vermilion bar: a cooler band on a warm page.
  wVerdigris: {paper: '#f2e9d6', ink: '#072522', pencil: '#acaea0', mass: '#027971', accent: '#fe423f', nightPaper: '#001816', nightInk: '#f2e9d6'},
  // Denim — Wada no. 279 (Raw Sienna, Vinaceous Cinnamon, Ecru, Dark Tyrian Blue).
  //   paper Ecru · bars Dark Tyrian Blue · accent Vinaceous Cinnamon · ink made · adjusted: paper L 0.761→0.74, C 0.044→0.052; accent L 0.79→0.88
  //   Kraft's blue twin: ecru card, a navy band, one pale cinnamon bar like white ink.
  wDenim: {paper: '#bea787', ink: '#061825', pencil: '#877c6a', mass: '#12354e', accent: '#ffcab6', nightPaper: '#0a151e', nightInk: '#bea787'},
  // Russet — Wada no. 249 (Hay's Russet, Ecru, Olive Ocher, Dark Medici Blue).
  //   paper Ecru · bars Hay's Russet · accent Olive Ocher · ink made · adjusted: paper L 0.761→0.74; accent L 0.779→0.82
  //   Ecru card, an oxblood-russet band, one ochre-gold bar: Kraft dressed warmer.
  wRusset: {paper: '#bba78d', ink: '#22110d', pencil: '#8d7a67', mass: '#793327', accent: '#e3c14d', nightPaper: '#210d0a', nightInk: '#bba78d'},
  // Magenta — Wada no. 144 (Rosolanc Purple, Orange, Black).
  //   paper Black · bars Rosolanc Purple · accent Orange · ink made · adjusted: paper L 0.185→0.18, C 0.004→0.014, h 229.03→357; accent L 0.698→0.74
  //   A near-black page, a deep magenta band, one orange bar: Plum turned up.
  wMagenta: {paper: '#170f12', ink: '#f8ebee', pencil: '#5b5154', mass: '#b73f74', accent: '#ff833a', nightPaper: '#170f12', nightInk: '#f8ebee'},
  // Viridian — Wada no. 256 (Vinaceous Cinnamon, Orange, Dull Viridian Green, Black).
  //   paper Black · bars Dull Viridian Green · accent Vinaceous Cinnamon · ink made · adjusted: paper L 0.185→0.18, C 0.004→0.014, h 229.03→162; mass L 0.589→0.56
  //   Green-black, a viridian band, one pale cinnamon bar: a night garden.
  wViridian: {paper: '#0c1410', ink: '#e8f1ec', pencil: '#4e5652', mass: '#078a5e', accent: '#eea78c', nightPaper: '#0c1410', nightInk: '#e8f1ec'},
  // Ultramarine — Wada no. 295 (Cream Yellow, Yellow, Blue, Dull Violet Black).
  //   paper Dull Violet Black · bars Blue · accent Cream Yellow · ink made · adjusted: paper L 0.221→0.2, C 0.088→0.04
  //   Violet-black, a pure blue band, one cream-yellow bar: deep and clear.
  wUltramarine: {paper: '#171226', ink: '#eaeef9', pencil: '#565465', mass: '#006eb8', accent: '#fdbf68', nightPaper: '#171226', nightInk: '#eaeef9'},
  // Old Rose — Wada no. 265 (Old Rose, Apricot Yellow, Olive Yellow, Dull Violet Black).
  //   paper Dull Violet Black · bars Old Rose · accent Apricot Yellow · ink made · adjusted: paper L 0.221→0.2, C 0.088→0.04; mass L 0.657→0.62; accent L 0.899→0.88, C 0.186→0.15, h 97.857→88
  //   Violet-black, an old-rose band, one yellow bar: dusk in a velvet room.
  wOldRose: {paper: '#171226', ink: '#f8ebeb', pencil: '#5b5361', mass: '#c7626f', accent: '#ffd15a', nightPaper: '#171226', nightInk: '#f8ebeb'},
  // Indigo Teal — Wada no. 155 (Jasper Red, Benzol Green, Deep Indigo).
  //   paper Deep Indigo · bars Benzol Green · accent Jasper Red · ink made · adjusted: paper L 0.192→0.19, C 0.063→0.035; mass L 0.609→0.57; accent L 0.643→0.74
  //   Deep indigo, a teal band, one coral bar: Midnight with the sea in it.
  wIndigoTeal: {paper: '#0b1323', ink: '#e7f0f5', pencil: '#4d5562', mass: '#078a81', accent: '#ff815d', nightPaper: '#0b1323', nightInk: '#e7f0f5'},
  // Gilt — Wada no. 325 (Eugenia Red | B, Naples Yellow, Yellow Ocher, Deep Slate Green).
  //   paper Deep Slate Green · bars Yellow Ocher · accent Eugenia Red | B · ink Naples Yellow · adjusted: paper L 0.281→0.21, C 0.036→0.025; mass L 0.793→0.72; accent L 0.622→0.56
  //   Bottle-green black, an ochre-gold band, a rose-red bar, the line in Naples yellow.
  wGilt: {paper: '#091c1a', ink: '#fbe6a0', pencil: '#525942', mass: '#ca9e1f', accent: '#c43d4b', nightPaper: '#091c1a', nightInk: '#fbe6a0'},
  // Round 11: Wada pass 2 (agents/wada/pass2): light papers in other hues, each differing in hue from its bars

  // Etruscan — Wada no. 152 (Etruscan Red, Hay's Russet, Light Glaucous Blue).
  //   paper Light Glaucous Blue · bars Hay's Russet · accent Etruscan Red · ink made · adjusted: paper L 0.81→0.95, C 0.039→0.018; accent L 0.587→0.72, C 0.149→0.15
  //   Ice-blue paper, an oxblood-russet band, one salmon-red bar: warm earth under a cold sky.
  w2Etruscan: {paper: '#e2f2f6', ink: '#301813', pencil: '#adb1b2', mass: '#793327', accent: '#d15d50', nightPaper: '#210d0a', nightInk: '#e2f2f6'},
  // Peony — Wada no. 204 (Rosolanc Purple, Cinnamon Rufous, Light Glaucous Blue).
  //   paper Light Glaucous Blue · bars Rosolanc Purple · accent Cinnamon Rufous · ink made · adjusted: paper L 0.81→0.95, C 0.039→0.018; accent L 0.636→0.74
  //   Ice-blue paper, a magenta band, one apricot bar: Magenta in daylight.
  w2Peony: {paper: '#e2f2f6', ink: '#2e171f', pencil: '#acb0b6', mass: '#b73f74', accent: '#e59564', nightPaper: '#200d14', nightInk: '#e2f2f6'},
  // Umber — Wada no. 234 (Cinnamon Buff, Pale Raw Umber, Pale King's Blue).
  //   paper Pale King's Blue · bars Pale Raw Umber · accent Cinnamon Buff · ink made · adjusted: paper L 0.843→0.95, C 0.052→0.018; accent L 0.859→0.78, C 0.109→0.13
  //   Pale sky paper, a raw-umber band, one buff-gold bar: coffee and air, the quietest.
  w2Umber: {paper: '#e2f2f7', ink: '#271a0d', pencil: '#aab1b1', mass: '#71502f', accent: '#eaa950', nightPaper: '#1c1107', nightInk: '#e2f2f7'},
  // Hydrangea — Wada no. 142 (Hydrangea Red, Sulphine Yellow, Salvia Blue).
  //   paper Salvia Blue · bars Hydrangea Red · accent Sulphine Yellow · ink made · adjusted: paper L 0.738→0.95, C 0.047→0.018; accent L 0.714→0.75
  //   Periwinkle-grey paper, a rose-red band, one mustard bar: Brick on a cool page.
  w2Hydrangea: {paper: '#e7effb', ink: '#301719', pencil: '#b0aeb7', mass: '#a94151', accent: '#cdaa3b', nightPaper: '#210d0f', nightInk: '#e7effb'},
  // Celadon — Wada no. 171 (Pale Burnt Lake, Yellow Orange, Glaucous Green).
  //   paper Glaucous Green · bars Pale Burnt Lake · accent Yellow Orange · ink made · adjusted: paper L 0.826→0.95, C 0.031→0.016; mass L 0.409→0.45
  //   Celadon paper, a maroon band, one marigold bar: glaze and lacquer.
  w2Celadon: {paper: '#e5f2ec', ink: '#2d1514', pencil: '#aeb0ab', mass: '#8d3331', accent: '#f99d1b', nightPaper: '#210d0c', nightInk: '#e5f2ec'},
  // Camellia — Wada no. 260 (Old Rose, Vinaceous Cinnamon, Glaucous Green, Sea Green).
  //   paper Glaucous Green · bars Old Rose · accent Sea Green · ink made · adjusted: paper L 0.826→0.95, C 0.031→0.016; mass L 0.657→0.58; accent L 0.689→0.72
  //   Celadon paper, an old-rose band, one sea-green bar: soft, the accent the only cool note.
  w2Camellia: {paper: '#e5f2ec', ink: '#30171a', pencil: '#afb0ad', mass: '#ba5664', accent: '#eea78c', nightPaper: '#210d0f', nightInk: '#e5f2ec'},
  // Blush — Wada no. 264 (Corinthian Pink, Red Orange, Dark Greenish Glaucous, Cerulian Blue).
  //   paper Corinthian Pink · bars Cerulian Blue · accent Red Orange · ink made · adjusted: paper L 0.838→0.95, C 0.077→0.018; mass L 0.608→0.52; accent L 0.6→0.66
  //   Blush paper, a cerulean band, one red-orange bar: the warm paper Lagoon never had.
  w2Blush: {paper: '#faeaeb', ink: '#02212a', pencil: '#b0aeb1', mass: '#047685', accent: '#f3553c', nightPaper: '#00181c', nightInk: '#faeaeb'},
  // Heather — Wada no. 338 (Carmine Red, Orange Yellow, Dusky Green, Grayish Lavender - B).
  //   paper Grayish Lavender - B · bars Dusky Green · accent Orange Yellow · ink made · adjusted: paper L 0.758→0.95, C 0.03→0.016; mass L 0.384→0.42; accent L 0.815→0.78
  //   Mauve-blush paper, a dusky green band, one orange-yellow bar; its night is Heather Night. Drop partner: w2HeatherNight.
  w2Heather: {paper: '#f8eaf0', ink: '#06221e', pencil: '#afaeb1', mass: '#125950', accent: '#efa800', nightPaper: '#041815', nightInk: '#f8eaf0'},
  // Aubergine — Wada no. 307 (Carmine, Grayish Lavender - A, Aconite Violet, Cotinga Purple).
  //   paper Grayish Lavender - A · bars Cotinga Purple · accent Carmine · ink made · adjusted: paper L 0.777→0.95, C 0.055→0.016; mass L 0.311→0.4; accent L 0.54→0.6
  //   Lilac paper, an aubergine band, one carmine bar; its night is Aubergine Night. Drop partner: w2AubergineNight.
  w2Aubergine: {paper: '#eeedf9', ink: '#261322', pencil: '#b2acb9', mass: '#6b2d5e', accent: '#e23247', nightPaper: '#1d0d1a', nightInk: '#eeedf9'},
  // Wisteria — Wada no. 197 (Eosine Pink, Dark Soft Violet, Neutral Gray).
  //   paper Neutral Gray · bars Dark Soft Violet · accent Eosine Pink · ink made · adjusted: paper L 0.798→0.955, C 0.01→0.008
  //   Near-white cool grey, a soft violet band, one eosine-pink bar: the whitest page.
  w2Wisteria: {paper: '#eaf2f3', ink: '#1b1a2f', pencil: '#acb1b8', mass: '#66629c', accent: '#f37f94', nightPaper: '#131123', nightInk: '#eaf2f3'},
  // Cobalt — Wada no. 333 (Burnt Sienna, Lemon Yellow, Cobalt Green, Blue).
  //   paper Cobalt Green · bars Blue · accent Burnt Sienna · ink made · adjusted: paper L 0.81→0.95, C 0.082→0.016; accent L 0.546→0.65
  //   Mint-white paper, a pure blue band, one burnt-sienna bar: Klein in spring.
  w2Cobalt: {paper: '#e7f2ea', ink: '#0c1e2f', pencil: '#a5b2b2', mass: '#006eb8', accent: '#d17145', nightPaper: '#061523', nightInk: '#e7f2ea'},
  // Seashell — Wada no. 194 (Jasper Red, Seashell Pink, Olympic Blue).
  //   paper Seashell Pink · bars Olympic Blue · accent Jasper Red · ink made · adjusted: paper L 0.899→0.95, C 0.056→0.02; mass L 0.598→0.5; accent L 0.643→0.66
  //   Peach-shell paper, a slate-blue band, one jasper-red bar: Hokusai on a pinker page.
  w2Seashell: {paper: '#faebe3', ink: '#0f1e2f', pencil: '#b4aead', mass: '#3e6594', accent: '#f1592b', nightPaper: '#081423', nightInk: '#faebe3'},
  // Carmine — Wada no. 232 (Carmine, Pinkish Cinnamon, Deep Indigo).
  //   paper Deep Indigo · bars Carmine · accent Pinkish Cinnamon · ink made · adjusted: paper L 0.192→0.19, C 0.063→0.035
  //   Deep indigo, a carmine band, one pale cinnamon bar: red velvet at night.
  w2Carmine: {paper: '#0b1323', ink: '#f7ebeb', pencil: '#52545f', mass: '#cc1236', accent: '#eeb480', nightPaper: '#0b1323', nightInk: '#f7ebeb'},
  // Aconite — Wada no. 344 (Cinnamon Buff, Deep Lyons Blue, Aconite Violet, Black).
  //   paper Deep Lyons Blue · bars Aconite Violet · accent Cinnamon Buff · ink made · adjusted: paper L 0.393→0.19, C 0.122→0.04
  //   Navy-violet black, an orchid band, one buff bar: Old Rose's cooler sister.
  w2Aconite: {paper: '#091326', ink: '#f4ebf4', pencil: '#505464', mass: '#a36aa5', accent: '#fdc57e', nightPaper: '#091326', nightInk: '#f4ebf4'},
  // Apricot — Wada no. 253 (Lemon Yellow, Apricot Orange, Cotinga Purple, Slate Color).
  //   paper Slate Color · bars Apricot Orange · accent Lemon Yellow · ink made · adjusted: paper L 0.379→0.2, C 0.025→0.02; mass L 0.743→0.66
  //   Slate black, an apricot band, one lemon bar: the brightest dark.
  w2Apricot: {paper: '#0c181d', ink: '#f6ece8', pencil: '#52585a', mass: '#d97234', accent: '#f8ed43', nightPaper: '#0c181d', nightInk: '#f6ece8'},
  // Grenadine — Wada no. 166 (Grenadine Pink, Naples Yellow, Deep Slate Green).
  //   paper Deep Slate Green · bars Grenadine Pink · accent Naples Yellow · ink made · adjusted: paper L 0.281→0.21, C 0.036→0.025; mass L 0.725→0.64
  //   Bottle-green black, a coral band, one Naples-yellow bar: Gilt's pink twin.
  w2Grenadine: {paper: '#091c1a', ink: '#f6ece9', pencil: '#505a58', mass: '#d6654e', accent: '#fbe6a0', nightPaper: '#091c1a', nightInk: '#f6ece9'},
  // Pansy — Wada no. 157 (Pansy Purple, Olive Ocher, Olympic Blue).
  //   paper Pansy Purple · bars Olympic Blue · accent Olive Ocher · ink made · adjusted: paper L 0.39→0.19, C 0.141→0.04
  //   Wine black, an Olympic-blue band, one gold bar: blue on red-black, unexpected and calm.
  w2Pansy: {paper: '#220b11', ink: '#e9eff7', pencil: '#5e4f56', mass: '#5a82b3', accent: '#d6b43e', nightPaper: '#220b11', nightInk: '#e9eff7'},
  // Saxe — Wada no. 186 (Hay's Russet, Ochraceous Salmon, Blue).
  //   paper Hay's Russet · bars Blue · accent Ochraceous Salmon · ink made · adjusted: paper L 0.415→0.19, C 0.101→0.035; mass L 0.526→0.55
  //   Russet-brown black, a pure blue band, one salmon bar: Café with a blue band.
  w2Saxe: {paper: '#210d0a', ink: '#f5ede7', pencil: '#61504c', mass: '#1275c0', accent: '#d8a37b', nightPaper: '#210d0a', nightInk: '#f5ede7'},
  // Heather Night — Wada no. 338 (Carmine Red, Orange Yellow, Dusky Green, Grayish Lavender - B).
  //   paper Dusky Green · bars Carmine Red · accent Orange Yellow · ink made · adjusted: paper L 0.384→0.2, C 0.069→0.03; mass L 0.486→0.56
  //   Drop partner of Heather (no. 338): dusky-green black, a carmine band, the same orange-yellow bar. Drop partner: w2Heather.
  w2HeatherNight: {paper: '#041a17', ink: '#f7ebeb', pencil: '#4d5957', mass: '#bf444b', accent: '#fcb315', nightPaper: '#041a17', nightInk: '#f7ebeb'},
  // Aubergine Night — Wada no. 307 (Carmine, Grayish Lavender - A, Aconite Violet, Cotinga Purple).
  //   paper Cotinga Purple · bars Carmine · accent Grayish Lavender - A · ink made · adjusted: paper L 0.311→0.19, C 0.11→0.04; mass L 0.54→0.56; accent L 0.777→0.82, C 0.055→0.07
  //   Drop partner of Aubergine (no. 307): aubergine black, a carmine band, a lavender bar. Drop partner: w2Aubergine.
  w2AubergineNight: {paper: '#1f0c1b', ink: '#f4ecf1', pencil: '#5f4f5b', mass: '#d31f3c', accent: '#c3bdef', nightPaper: '#1f0c1b', nightInk: '#f4ecf1'},
  // R12 accent fixes, from each combination's own colours: Etruscan's salmon (a lightened Etruscan Red) → a deeper Etruscan Red;
  // Camellia's sea-green ("not well integrated") → Vinaceous Cinnamon, the fourth colour of Wada no. 260.
  w2EtruscanR11: {paper: '#e2f2f6', ink: '#301813', pencil: '#adb1b2', mass: '#793327', accent: '#f47c6d', nightPaper: '#210d0a', nightInk: '#e2f2f6'},
  w2CamelliaR11: {paper: '#e5f2ec', ink: '#30171a', pencil: '#afb0ad', mass: '#ba5664', accent: '#21bea5', nightPaper: '#210d0f', nightInk: '#e5f2ec'},
  // a lab-only test: Riso with darker ink and a quieter band. If it reads as clearly as Hokusai, lightness was Riso's problem.
  risoDeep: {paper: '#f7f3e9', ink: '#0d2063', pencil: '#b9b7cf', mass: '#304d99', accent: '#ff3d7f', nightPaper: '#14206e', nightInk: '#f7f3e9'},
};
export const SCHEME_NAMES = {graphite: 'Graphite & red', hokusai: 'Hokusai', black: 'Black', lagoon: 'Lagoon', riso: 'Riso', dune: 'Dune', plum: 'Plum', slate: 'Slate', olive: 'Olive', mauve: 'Mauve', bauhaus: 'Bauhaus', sumi: 'Sumi', midnight: 'Midnight', espresso: 'Espresso', moss: 'Moss', klein: 'Klein', bottle: 'Bottle', risoDeep: 'Riso, deeper ink (test)', wPrussian: 'Prussian (Wada 343)', wBrick: 'Brick (Wada 325)', wOrchid: 'Orchid (Wada 315)', wVerdigris: 'Verdigris (Wada 266)', wDenim: 'Denim (Wada 279)', wRusset: 'Russet (Wada 249)', wMagenta: 'Magenta (Wada 144)', wViridian: 'Viridian (Wada 256)', wUltramarine: 'Ultramarine (Wada 295)', wOldRose: 'Old Rose (Wada 265)', wIndigoTeal: 'Indigo Teal (Wada 155)', wGilt: 'Gilt (Wada 325)', w2Etruscan: 'Etruscan (Wada)', w2Peony: 'Peony (Wada)', w2Umber: 'Umber (Wada)', w2Hydrangea: 'Hydrangea (Wada)', w2Celadon: 'Celadon (Wada)', w2Camellia: 'Camellia (Wada)', w2Blush: 'Blush (Wada)', w2Heather: 'Heather (Wada)', w2Aubergine: 'Aubergine (Wada)', w2Wisteria: 'Wisteria (Wada)', w2Cobalt: 'Cobalt (Wada)', w2Seashell: 'Seashell (Wada)', w2Carmine: 'Carmine (Wada)', w2Aconite: 'Aconite (Wada)', w2Apricot: 'Apricot (Wada)', w2Grenadine: 'Grenadine (Wada)', w2Pansy: 'Pansy (Wada)', w2Saxe: 'Saxe (Wada)', w2HeatherNight: 'Heather Night (Wada)', w2AubergineNight: 'Aubergine Night (Wada)', wBrick10: 'Brick, round 10', w2EtruscanR11: 'Etruscan, round 11', w2CamelliaR11: 'Camellia, round 11', cahier: 'Cahier', toile: 'Toile', ravilious: 'Ravilious', lavender: 'Lavender', kraft: 'Kraft', vegas: 'Vegas', cyanotype: 'Cyanotype', kintsugi: 'Kintsugi', rothko: 'Rothko', cafe: 'Café'};
const DIMS = {scheme: ['Colour', SCHEME_NAMES]}; // the variant code below names schemes through DIMS.scheme[1], as it did in lab.js

// Background study (round 8): a palette's line, bars and accent kept exactly; only the paper moves, along one plain direction
// (OKLCH: less colour, almost neutral, lighter, darker). The pencil keeps its offset from the paper.
const BG_STUDY = {
  kraft: [['less colour', '#c6b7a4'], ['almost neutral', '#bdb9b3'], ['lighter', '#e4ccad'], ['lighter, less colour', '#dacebf'], ['darker', '#bb9e79']],
  cyanotype: [['less colour', '#384c69'], ['almost neutral', '#454c54'], ['darker', '#0f305d'], ['darker, less colour', '#223247'], ['lighter', '#305b99']],
  rothko: [['less colour', '#221314'], ['almost neutral', '#1b1617'], ['darker', '#120103'], ['darker, less colour', '#0c0304'], ['lighter', '#3b1a1e']],
};
for (const [b, vs] of Object.entries(BG_STUDY)) vs.forEach(([, paper], i) => {
  const o = SCHEMES[b], d = hex(o.pencil).map((c, j) => c - hex(o.paper)[j]), pencil = '#' + hex(paper).map((c, j) => clamp(c + d[j], 0, 255).toString(16).padStart(2, '0')).join('');
  SCHEMES[`${b}~${i}`] = {...o, paper, pencil}; DIMS.scheme[1][`${b}~${i}`] = `${DIMS.scheme[1][b]}, paper ${vs[i][0]}`;
});
// Round 9: whole-theme variants (agents/palettes-r9/variants.js): in every loved scheme the bars carry more colour than the paper.
const VARIANTS = {
  'kraft~a': ['As designed, richer bars', 'kraft', {mass: '#5d3414'}],
  'kraft~b': ['Darker paper, richer bars', 'kraft', {paper: '#bb9e79', mass: '#552c0a'}],
  'kraft~c': ['Lighter paper, lighter bars, dark accent', 'kraft', {paper: '#e4ccad', mass: '#8b6a4d', accent: '#1a140e'}],
  'kraft~d': ['Lighter paper, lighter bars, red accent', 'kraft', {paper: '#e4ccad', mass: '#8b6a4d', accent: '#b23a2a'}], // R10: "maybe something red-ish?"
  'cyanotype~a': ['A little more colour than “less”', 'cyanotype', {paper: '#304b71'}],
  'cyanotype~b': ['A little more colour, toward indigo', 'cyanotype', {paper: '#3b456c'}],
  'cyanotype~c': ['Darker, quieter', 'cyanotype', {paper: '#21334f'}],
  'rothko~a': ['As designed, dusty-rose bars', 'rothko', {mass: '#b0696c'}],
  'rothko~b': ['As designed, peach bars', 'rothko', {mass: '#c78669'}],
};
for (const [key, [label, b, o]] of Object.entries(VARIANTS)) {
  const base = SCHEMES[b], paper = o.paper ?? base.paper, d = hex(base.pencil).map((c, j) => c - hex(base.paper)[j]);
  SCHEMES[key] = {...base, ...o, pencil: o.paper ? '#' + hex(paper).map((c, j) => clamp(c + d[j], 0, 255).toString(16).padStart(2, '0')).join('') : base.pencil};
  DIMS.scheme[1][key] = `${DIMS.scheme[1][b]}: ${label}`;
}
// Round 9 decisions: Kraft takes the darker paper; Cyanotype and Rothko take "less colour"; the other liked papers stay as siblings.
SCHEMES.kraft = {...SCHEMES['kraft~4']};
SCHEMES.cyanotypeIndigo = {...SCHEMES['cyanotype~b']}; SCHEMES.cyanotypeDeep = {...SCHEMES['cyanotype~c']}; SCHEMES.cyanotype = {...SCHEMES['cyanotype~0']};
SCHEMES.rothkoNeutral = {...SCHEMES['rothko~1']}; SCHEMES.rothko = {...SCHEMES['rothko~0']};
Object.assign(DIMS.scheme[1], {cyanotypeIndigo: 'Cyanotype, indigo', cyanotypeDeep: 'Cyanotype, deep', rothkoNeutral: 'Rothko, neutral'});
// The palette library (R12): the owner's latest verdict per scheme, for future sampling and weighting. 'love' = a favourite,
// 'good' = keep, 'works' = good enough but not a favourite, 'out' = not to be used. LEDGER.md has the words behind each.
const LIBRARY = {
  love: ['graphite', 'hokusai', 'black', 'dune', 'plum', 'lavender', 'wPrussian', 'wMagenta', 'wUltramarine', 'wOldRose', 'w2Celadon', 'w2Aubergine', 'w2Wisteria', 'w2Seashell', 'w2Aconite'],
  good: ['cafe', 'kraft', 'cyanotype', 'cyanotypeIndigo', 'cyanotypeDeep', 'rothko', 'rothkoNeutral', 'lagoon', 'slate', 'sumi', 'ravilious', 'cahier', 'kintsugi', 'wBrick', 'wOrchid', 'wRusset', 'wGilt', 'w2Etruscan', 'w2Peony', 'w2Umber', 'w2Hydrangea', 'w2Heather', 'w2Cobalt', 'w2Carmine', 'w2Apricot', 'w2Grenadine', 'w2AubergineNight'],
  works: ['wVerdigris', 'wDenim', 'wViridian', 'wIndigoTeal', 'w2Camellia', 'w2Blush', 'w2Pansy', 'w2Saxe', 'w2HeatherNight', 'mauve', 'midnight', 'vegas'],
  out: ['riso', 'risoDeep', 'olive', 'bauhaus', 'espresso', 'moss', 'toile', 'klein', 'bottle', 'salmon', 'cyanotype~a'],
};

// The drop switch: during the hand-placed Night cue, a scheme can hand over to its 'drop' partner (a cut on the cue), a darker
// scheme of the same family, instead of Night's dark version of itself.
const DROPS = {graphite: 'black', hokusai: 'midnight', dune: 'espresso', lagoon: 'moss', slate: 'midnight', mauve: 'plum', olive: 'moss', sumi: 'black', bauhaus: 'black',
  // R20: Wada drop partners from each scheme's own combination (agents/wada/pass2)
  w2Aubergine: 'w2AubergineNight', w2Heather: 'w2HeatherNight', wBrick: 'wGilt'};

export {LIBRARY, DROPS};
