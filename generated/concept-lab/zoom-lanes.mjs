// The lanes the zoom page offers for a ride: steady, the old spec's lane brought onto today's scale when the spec has one, and
// the lanes written for the song (productions/<song>/zooms.ts, which the scene carries).
import {legacyWide} from './zoom-model.mjs';

/** [{id, name, about, keyframes}]. written: the spec's old zoom keyframes or null; zooms: the song's lanes. */
export function lanesFor(written, zooms = []) {
  return [
    {id: 'steady', name: 'Steady', about: 'One zoom for the whole ride: what a song without lanes gets.', keyframes: [{t: 0, wide: 0.5}]},
    ...(written?.length > 1 ? [{id: 'written', name: 'As the old spec wrote it', about: 'The zoom the spec has carried since the first videos, brought onto today\'s scale.', keyframes: written.map(k => ({t: k.t, wide: +legacyWide(k.zoom).toFixed(3)}))}] : []),
    ...zooms,
  ];
}
