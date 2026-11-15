/**
 * Los Voltaje (57.4 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale every
 * song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: the tail of the groove (to 6.9), the voice in space over soft drums (7–15.6), the voice building and a rapid
 * pickup of words (20–23.8), then the full return of the drums (23.917) to the end, where a short three-stroke answer comes
 * every 8.27 s (27.55, 35.82, 44.09, 52.37) and a synth joins from about 32.6.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'held', name: 'Held breath',
    about: 'Follows tension. The groove tail sits in the middle; the voice in space comes a little closer; as it builds the picture closes in, closest on the rapid pickup, and the full return opens it at once to the widest.',
    keyframes: [{t: 0, wide: 0.6}, {t: 6.9, wide: 0.6}, {t: 8.4, wide: 0.45}, {t: 15.6, wide: 0.45}, {t: 22.0, wide: 0.25}, {t: 23.67, wide: 0.25},
      {t: 24.17, wide: 0.95}]},
  {id: 'answers', name: 'A step at each answer',
    about: 'Follows the drums\' short three-stroke answers. Close for the voice; the return opens the picture halfway, and each answer pushes it a step wider, widest at the last.',
    keyframes: [{t: 0, wide: 0.6}, {t: 6.9, wide: 0.6}, {t: 8.4, wide: 0.4}, {t: 23.67, wide: 0.4}, {t: 24.17, wide: 0.6}, {t: 27.45, wide: 0.6},
      {t: 28.15, wide: 0.7}, {t: 35.72, wide: 0.7}, {t: 36.42, wide: 0.8}, {t: 43.99, wide: 0.8}, {t: 44.69, wide: 0.9}, {t: 52.27, wide: 0.9},
      {t: 52.97, wide: 1}]},
];
export default zooms;
