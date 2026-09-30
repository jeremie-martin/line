/** Authored research choices, outside both the music specification and benchmark.
 * Windows are hypotheses to review visually, not rules inferred from a score. */
export const musicalDirectionCases = [
  {song:'luna_bala_44s',title:'Luna Bala',excerpt:[6,38],
    guidance:[6.4,8.55],mixed:[24.2,25.8],
    intent:'Try a single-rail vocal build into the drop; try a distinct rail shape at the climax, followed by ordinary arcs.',
    moments:[{time:6.4,title:'Vocal build',from:5.7,to:8.58},
      {time:8.58,title:'First drop',from:8,to:9.8},
      {time:24.2,title:'Climax and return',from:23.4,to:27}]},
  {song:'amor_na_praia_46s',title:'Amor na Praia',excerpt:[2,34],
    guidance:[1.5,3.5],mixed:[4.46,7.87],
    intent:'Check the same controls on a soft intro and percussion burst, preserving the breath and main drop.',
    moments:[{time:1.5,title:'Soft introduction',from:1,to:4.46},
      {time:4.46,title:'Percussion burst and return',from:4,to:9.1},
      {time:9.1,title:'Main drop',from:8.6,to:10.2}]},
] as const;

export const musicalDirectionMethods = {
  baseline:{title:'Production baseline',description:'The current smooth-arc compiler, with its ordinary guide search and cleanup.'},
  guidance:{title:'Single-rail phrase',description:'Guides forbidden only in the indicated phrase; the earlier ride is locked and the complete continuation is searched again.'},
  facets:{title:'Facets throughout',description:'An independent full ride searched using angular geometry. This comparison can differ throughout.'},
  mixed:{title:'Arcs → facets → arcs',description:'A selected phrase uses actual faceted construction, then returns to smooth construction. The earlier ride is locked; later motion may change.'},
};

/** Reserved before repertoire development. Never included in default development runs. */
export const repertoireConfirmationCase = {
  song:'tiki_tiki_48s',title:'Tiki Tiki',excerpt:[5,37],
  guidance:[6.9,9.5],mixed:[27.83,30.5],
  intent:'Check reuse on the first beat phrase and the later run, with ordinary arcs between and afterwards.',
  moments:[{time:6.9,title:'First beats and entry',from:6.4,to:10.43},
    {time:10.43,title:'Drop and return',from:9.8,to:12},
    {time:27.83,title:'Run and return',from:27,to:32}],
} as const;

/** New intervention windows, reserved before the ripple/contact development.
 * Tiki is an already known song; this is passage reuse, not unseen-song evidence. */
export const repertoireContactReuseCase = {
  song:'tiki_tiki_48s',title:'Tiki Tiki · new passages',excerpt:[10,42],
  guidance:[12.1,14.8],mixed:[36,38.6],
  intent:'Check the frozen constructions on two further phrases of a previously used song.',
  moments:[{time:12.1,title:'First changed phrase',from:11.6,to:15.6},
    {time:15.6,title:'Return to arcs',from:15,to:17},
    {time:36,title:'Later phrase and return',from:35.5,to:40}],
} as const;

/** Reserved before connected-face development; further interventions on known music. */
export const repertoireFoldReuseCase = {
  song:'tiki_tiki_48s',title:'Tiki Tiki · connected folds',excerpt:[16,48],
  guidance:[18.5,21],mixed:[40,42.5],
  intent:'Compare a folded connected construction on further passages, then combine scattered and folded phrases.',
  moments:[{time:18.5,title:'First folded phrase',from:18,to:21.8},
    {time:21.8,title:'Return to arcs',from:21.2,to:23.2},
    {time:40,title:'Later phrase and return',from:39.5,to:44}],
} as const;
