// Zoom lanes drafted for the two study songs (2026-11-15), to look at; none is judged. A lane is keyframes on the fixed
// scale of zoom-model.mjs. Each song's sections come with its ride; the values below are one per section, in order.
import {bySection, pushIn, legacyWide} from './zoom-model.mjs';

// how full the song is in each section, by ear of its structure: 0 calm, 1 full
const FULL = {
  tiki: [0.15, 0.35, 1, 0.45, 0.9, 0.25],   // support intro, first beats, drop hook, reset, run, float out
  circus: [0.2, 0.45, 0.7, 0.55, 0.2, 1],   // 808 intro, verse, groove · hats, hook · voice, break, full groove
};
/** [{id, name, about, keyframes}] for a song. sections: [{t0, t1}]; written: the spec's old zoom keyframes or null. */
export function lanesFor(song, sections, written) {
  const full = FULL[song] ?? sections.map(() => 0.5);
  return [
    {id: 'steady', name: 'Steady', about: 'Today: one zoom for the whole ride.', keyframes: [{t: 0, wide: 0.5}]},
    ...(written?.length > 1 ? [{id: 'written', name: 'As the old spec wrote it', about: 'The zoom keyframes the spec has carried since the first videos, brought onto today\'s scale.', keyframes: written.map(k => ({t: k.t, wide: +legacyWide(k.zoom).toFixed(3)}))}] : []),
    {id: 'open', name: 'Opens with the song', about: 'Close while the song is calm, wide when it is full; it changes at the start of each section.', keyframes: bySection(sections, full)},
    {id: 'push', name: 'Pushes in', about: 'Each section starts wide and closes in slowly until the next one opens the picture again.', keyframes: pushIn(sections, full.map(v => 0.35 + 0.65 * v))},
    {id: 'near', name: 'Closes with the song', about: 'The reverse reading: wide while the song is calm, close when it is full.', keyframes: bySection(sections, full.map(v => 1 - v))},
  ];
}
