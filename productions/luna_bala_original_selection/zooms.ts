/**
 * Luna Bala (original speed, 58 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from
 * its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: a vocal pickup (to 5.58), the body with drums and upper answers (5.584), its second phrase with syncopated bass
 * answers (19.42), a voice break with three exposed calls (35.109, 36.966, 38.812) and near silence, then the final return
 * (42.353), larger than the first, to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'returns', name: 'Two returns',
    about: 'Follows the form. Close on the vocal pickup; the drums open the picture at once; the voice break comes back in, and the final return opens it wider than the first.',
    keyframes: [{t: 0, wide: 0.3}, {t: 5.33, wide: 0.3}, {t: 5.83, wide: 0.8}, {t: 34.9, wide: 0.8}, {t: 36.4, wide: 0.35}, {t: 42.1, wide: 0.35},
      {t: 42.6, wide: 1}]},
  {id: 'calls', name: 'Closer at each call',
    about: 'Follows the break\'s three calls. The drums open the picture halfway and the bass answers a step more; in the break each call brings it a step closer, so the final return opens from the closest picture to the widest.',
    keyframes: [{t: 0, wide: 0.4}, {t: 5.33, wide: 0.4}, {t: 5.83, wide: 0.65}, {t: 19.2, wide: 0.65}, {t: 19.9, wide: 0.8}, {t: 34.9, wide: 0.8},
      {t: 35.4, wide: 0.6}, {t: 36.77, wide: 0.6}, {t: 37.27, wide: 0.45}, {t: 38.61, wide: 0.45}, {t: 39.11, wide: 0.3}, {t: 42.1, wide: 0.3},
      {t: 42.6, wide: 1}]},
];
export default zooms;
