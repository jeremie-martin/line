// The lab's ride sets, by name: where prepare.mjs writes each set's scenes and the lab and film.mjs read them. Shared by Node
// and the browser.
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
