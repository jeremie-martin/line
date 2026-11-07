// Round 9 whole-theme variants, hand-tuned in OKLCH (ok.py), merged into lab.js SCHEMES as overrides of a base palette.
// Hypothesis from the owner's round-8 picks: in every loved scheme the BARS carry more colour than the paper
// (Hokusai paper C .023 vs bars .099, Café .021 vs .048, Dune .031 vs .120). Cyanotype as designed inverts it
// (paper .111 vs bars .085) and its "less colour" paper, preferred "by far", restores it. Kraft inverts it too (.062 vs .034).
// Each variant tests that, or answers a remark: "for the lighter we need to change the bar colour", "a bit more colour than
// less colour but integrated like it", "there is a world where the as-designed background works".
export const VARIANTS = {
  // Kraft: the owner preferred the darker paper. Here the bars carry the colour instead of the paper.
  'kraft~a': ['As designed, richer bars', 'kraft', {mass: '#5d3414'}],
  'kraft~b': ['Darker paper, richer bars', 'kraft', {paper: '#bb9e79', mass: '#552c0a'}],
  // "For the lighter, there's something to be done, but not with these bar colours": lighter bars and a dark accent.
  'kraft~c': ['Lighter paper, lighter bars, dark accent', 'kraft', {paper: '#e4ccad', mass: '#8b6a4d', accent: '#1a140e'}],
  // Cyanotype: "a bit more colour than less colour, but integrated like it… something new, cleaner".
  'cyanotype~a': ['A little more colour than “less”', 'cyanotype', {paper: '#304b71'}],
  'cyanotype~b': ['A little more colour, toward indigo', 'cyanotype', {paper: '#3b456c'}],
  'cyanotype~c': ['Darker, quieter', 'cyanotype', {paper: '#21334f'}],
  // Rothko: "there is a world where the as-designed background works; how do we integrate it with the rest".
  'rothko~a': ['As designed, dusty-rose bars', 'rothko', {mass: '#b0696c'}],
  'rothko~b': ['As designed, peach bars', 'rothko', {mass: '#c78669'}],
};
