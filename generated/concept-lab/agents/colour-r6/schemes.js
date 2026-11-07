// Round 6 candidate schemes, in lab.js SCHEMES token format. All pass the provisional clarity guardrail (measure.mjs).
// Drafted in OKLCH; see REPORT.md for the lightness/chroma of each token.
export const CANDIDATES = {
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
};
