/**
 * Run low under the bass, rise on the seven notes, glide through the quiet. Wherever the bass pumps the rider runs
 * fast and close to the line; on each seven-note contour it lifts, as if the melody pulled it up (an idea all three
 * new readings share, and their rides show it clearly). The quiet middle keeps the approved float, with the touches
 * lighter still, as you asked there. The drums alone start lighter and gather stroke by stroke, so the return of the
 * bass is the clear peak of the song (Opus: its ride is the only one where that return truly lands hardest).
 * From there the run is low and fast again, and the last answer lifts once more as the music lets go.
 * My own part is how much: the low run is lower than approved but not flat, the lifts as high as in the quiet,
 * and the whole song keeps the approved high pace.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';
import base from './variants/approved.ts';
import {returningDrums} from './music.ts';

export {overlayMeta} from './variants/approved.ts';

// The drums alone gather toward the bass return (Opus).
const drums = new Map(returningDrums.map(([t, impact], i) => [t, i === 0 ? .70 :
  impact * (.74 + .26 * i / (returningDrums.length - 1))]));

function strength(t: number, impact: number): number {
  if (t >= 21.2 && t <= 26.3) return impact * .7;      // the quiet: lighter still
  if (drums.has(t)) return drums.get(t)!;
  if (t >= 33.8 && t < 34.5) return impact * .88;     // the pickup into the return stays below it
  return impact;
}

const spec: Spec = {
  ...base,
  contacts: base.contacts.map(({t, impact = 0}) => ({t, impact: Number(strength(t, impact).toFixed(3))})),
  axes: {
    air: curve([
      [0,.48],[3.25,.52],[3.6,.68],[5.30,.66],[5.522,.60],[5.98,.46],[10.70,.46],[10.979,.72],[12.57,.72],[12.79,.46],
      [17.9,.46],[18.246,.72],[19.85,.76],[26.2,.70],[27.34,.56],[33.5,.56],[34.384,.48],[34.611,.46],
      [47.3,.46],[47.567,.72],[49.691,.74],
    ]),
    speed: curve([
      [0,.96],[3.25,.90],[5.30,.94],[5.522,1],[10.70,1],[10.979,.94],[12.57,.94],[12.79,1],[17.9,1],[18.246,.94],
      [19.85,.86],[21.2,.84],[26.2,.86],[27.34,.97],[33.81,.97],[34.611,1],[47.3,1],[47.567,.90],[49.691,.84],
    ]),
  },
};
export default spec;
