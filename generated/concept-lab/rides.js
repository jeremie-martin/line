// The lab's ride sets, by name: where prepare.mjs writes each set's scenes and the lab and film.mjs read them. Shared by Node
// and the browser.
//   ''         the lab's rides (rides/, recompiled 8 November with their authored beats, so aligned: TIMING-DESIGN.md)
//   'compiled' the same rides drawn as compiled: their beats withheld, so exactly the scenes the lab showed before (stage 3's
//              reference; the records were identical but for the beats)
//   'old'      the round 1–5 rides (music-library round 2)
export const RIDES = {
  '': {dir: 'data', label: ''},
  compiled: {dir: 'data-compiled', label: 'as compiled'},
  old: {dir: 'data-r5', label: 'round-5 ride'},
};
/** The named set, refusing a name that is not one. */
export function rideSet(name = '') {
  if (!Object.hasOwn(RIDES, name)) throw new Error(`no ride set ${name}: ${Object.keys(RIDES).filter(Boolean).join(', ')}`);
  return RIDES[name];
}
