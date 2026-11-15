// Zoom lanes written for the study songs (2026-11-15), each with what it is trying to do; none is judged. A lane is keyframes on
// the fixed scale of zoom-model.mjs (0 closest, 0.5 today, 1 widest). Times come from each song's music.ts. The picture eases
// between points, so two points of the same value hold it, and a change is two points a little apart. Nothing is written for the
// last three seconds: there the picture pulls back to the whole course whatever the lane says.
import {legacyWide} from './zoom-model.mjs';

const lane = (id, name, about, points) => ({id, name, about, keyframes: points.map(([t, wide]) => ({t, wide}))});
/** A change from a to b centred on t, over d seconds: two points. */
const turn = (t, a, b, d = 1) => [[+(t - d / 2).toFixed(2), a], [+(t + d / 2).toFixed(2), b]];

const WRITTEN = {
  petrunko: [
    // The reading is "the long build": a tick becomes a hit, doubles, ends in a roll (11.48–20.9), 1.4 s of nothing, the return
    // at 22.40, then drum replies in bars of 2.73 s, some answered by the bass, and a decay from 56.
    lane('build', 'One pull-back', 'Follows the build. Close on the ticks; from the first drum hit the picture opens without a pause through the doubling and the roll, is at its widest for the silence and the return, and stays wide for the replies.',
      [[0, 0.2], [11.0, 0.2], [20.9, 0.95], [22.4, 1], [55.0, 0.85], [58.0, 0.4]]),
    lane('release', 'Held breath', 'Follows tension. The picture closes in as the build tightens, closest on the roll; it opens in the silence, so the return lands in the widest picture of the song.',
      [[0, 0.5], [11.0, 0.5], [20.9, 0.1], [21.1, 0.1], [22.3, 1], [55.0, 0.85], [58.0, 0.45]]),
    lane('bass', 'Leans in for the bass', 'Follows the replies. The same opening through the build, then the picture comes a little closer in each bar where the bass answers the drums, and steps back for the drums alone.',
      [[0, 0.2], [11.0, 0.2], [20.9, 0.95], [25.9, 0.95], ...turn(26.48, 0.95, 0.6), ...turn(29.21, 0.6, 0.95), ...turn(31.94, 0.95, 0.6), ...turn(34.67, 0.6, 0.95),
        ...turn(37.41, 0.95, 0.6), ...turn(40.12, 0.6, 0.95), ...turn(42.85, 0.95, 0.6), ...turn(45.58, 0.6, 0.95), ...turn(53.77, 0.95, 0.6), [58.0, 0.4]]),
  ],
  trouble: [
    // A quiet voice intro (to 14.71), a 3-3-2 groove, a short break (27.6), the drop (29.02) with heavy kicks in a stop-and-go,
    // two climbing triples (34.40, 41.56), a vocal break (43.4), and last kicks climbing from 46.95.
    lane('who', 'Voice close, drums wide', 'Follows who is playing. Close for the voice, at the start and in the vocal break; wider for the groove; the break draws in, and the drop opens the picture at once.',
      [[0, 0.15], ...turn(14.71, 0.15, 0.6, 1.2), ...turn(27.9, 0.6, 0.35, 0.6), ...turn(29.02, 0.35, 1, 0.4), ...turn(43.6, 1, 0.3, 1.2), ...turn(46.95, 0.3, 0.85, 0.8)]),
    lane('kicks', 'A step at each triple', 'Follows the heavy kicks. The picture drifts toward the voice through the intro, and after the drop it steps wider at each climbing triple of kicks, then widens with the last kicks as they climb.',
      [[0, 0.45], [14.0, 0.25], ...turn(14.71, 0.25, 0.55, 0.8), [28.6, 0.55], ...turn(29.02, 0.55, 0.7, 0.4), ...turn(34.74, 0.7, 0.85, 0.8), ...turn(41.9, 0.85, 1, 0.8), ...turn(43.8, 1, 0.5, 1.2), [46.6, 0.55], [50.07, 0.9]]),
  ],
  tiki: [
    // A quiet intro (to 6.9), first beats, the drop at 10.43, a reset at 24.35, the run from 27.83, a float out from 41.74.
    lane('drops', 'Two drops', 'Follows the two drops. Close for the intro and the first beats; each drop opens the picture at once; the reset between them comes back in.',
      [[0, 0.15], ...turn(6.9, 0.15, 0.3, 1.2), ...turn(10.43, 0.3, 0.95, 0.5), ...turn(24.6, 0.95, 0.4, 1.4), ...turn(27.83, 0.4, 1, 0.5), ...turn(42.2, 1, 0.45, 2)]),
    lane('breath', 'One slow breath', 'Follows the long shape, with no sudden change: the picture opens slowly from the first second to the end of the hook, breathes in at the reset, opens again through the run, and settles.',
      [[0, 0.2], [24.0, 0.9], [26.5, 0.6], [41.0, 1], [45.0, 0.55]]),
  ],
};
/** [{id, name, about, keyframes}] for a song: steady, the old spec's lane when it has one, and the lanes written above. */
export function lanesFor(song, written) {
  return [
    lane('steady', 'Steady', 'Today: one zoom for the whole ride.', [[0, 0.5]]),
    ...(written?.length > 1 ? [{id: 'written', name: 'As the old spec wrote it', about: 'The zoom the spec has carried since the first videos, brought onto today\'s scale.', keyframes: written.map(k => ({t: k.t, wide: +legacyWide(k.zoom).toFixed(3)}))}] : []),
    ...(WRITTEN[song] ?? []),
  ];
}
