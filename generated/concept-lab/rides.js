// The lab's songs and ride sets, defined once for the lab, prepare.mjs, film.mjs and recompile.sh. Shared by Node and the browser.

/** Each song of the lab, in the lab's order: its name there, its song (a folder of productions/), the ride the lab compiles
 * (recompile.sh: the seed, and the variant when not spec.ts) and its round 1–5 ride (music-library round 2; Circus Minimus has
 * none). */
export const SONGS = {
  circus: {name: 'Circus Minimus', song: 'circus_minimus_77s', seed: 101, variant: 'voice-drums', round5: null},
  petrunko: {name: 'Petrunko', song: 'petrunko_selection', seed: 202, round5: 'petrunko_selection-s202'},
  lua: {name: 'Lua na Praça', song: 'lua_na_praca_selection', seed: 101, round5: 'lua_na_praca_selection-s101'},
  los: {name: 'Los Voltaje', song: 'los_voltaje_selection', seed: 202, round5: 'los_voltaje_selection-s202'},
  batidao: {name: 'No Batidão', song: 'no_batidao_selection', seed: 202, round5: 'no_batidao_selection-s202'},
  burn: {name: 'Let the World Burn', song: 'let_the_world_burn_selection', seed: 202, round5: 'let_the_world_burn_selection-s202'},
  coma: {name: 'Montagem Coma', song: 'montagem_coma_selection', seed: 202, round5: 'montagem_coma_selection-s202'},
  tomada: {name: 'Montagem Tomada (super slowed)', song: 'montagem_tomada_super_slowed_selection', seed: 202, round5: 'montagem_tomada_super_slowed_selection-s202'},
};

// The ride sets, by name: where prepare.mjs writes each set's scenes and the lab and film.mjs read them.
//   ''    the lab's rides (rides/, recompiled 8 November with their authored beats, so aligned: TIMING-DESIGN.md)
//   'old' the round 1–5 rides (music-library round 2), recorded before beats, so shown as compiled
export const RIDES = {
  '': {dir: 'data', label: ''},
  old: {dir: 'data-r5', label: 'round-5 ride'},
};
/** The named set, refusing a name that is not one. */
export function rideSet(name = '') {
  if (!Object.hasOwn(RIDES, name)) throw new Error(`no ride set ${name}: ${Object.keys(RIDES).filter(Boolean).join(', ')}`);
  return RIDES[name];
}
