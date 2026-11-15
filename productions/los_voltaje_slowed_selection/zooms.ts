/**
 * Los Voltaje (slowed, 58 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its
 * id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: the tail of the groove (to 4.4), the voice over soft drums (4.66–13.5), a phrase rising into a fast pickup of words
 * (18.19) over a gap in the drums, then the return (22.291) to the end, where a short three-stroke answer comes every 8.76 s
 * (26.13, 34.89, 43.64, 52.40) and a synth joins from about 31.9.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'held', name: 'Held breath',
    about: 'Follows tension. The groove tail sits in the middle; the voice comes a little closer; as the phrase rises the picture closes in, closest on the fast pickup, and the return opens it at once to the widest.',
    keyframes: [{t: 0, wide: 0.6}, {t: 4.4, wide: 0.6}, {t: 5.9, wide: 0.45}, {t: 13.5, wide: 0.45}, {t: 20.0, wide: 0.25}, {t: 22.04, wide: 0.25},
      {t: 22.54, wide: 0.95}]},
  {id: 'answers', name: 'A step at each answer',
    about: 'Follows the drums\' short three-stroke answers. Close for the voice; the return opens the picture halfway, and each answer pushes it a step wider, widest at the last.',
    keyframes: [{t: 0, wide: 0.6}, {t: 4.4, wide: 0.6}, {t: 5.9, wide: 0.4}, {t: 22.04, wide: 0.4}, {t: 22.54, wide: 0.6}, {t: 26.03, wide: 0.6},
      {t: 26.73, wide: 0.7}, {t: 34.79, wide: 0.7}, {t: 35.49, wide: 0.8}, {t: 43.54, wide: 0.8}, {t: 44.24, wide: 0.9}, {t: 52.3, wide: 0.9},
      {t: 53.0, wide: 1}]},
];
export default zooms;
