/**
 * Funk do Bounce (super slowed, 60 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them
 * from its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the
 * scale every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back
 * to the whole course. Times are the song's (composition.json).
 *
 * The song: the voice leads (to 8.45), a soft roll, the bass restarts alone (10.728), a suspension (18.8), the drums arrive
 * (20.48) for the strongest passage, then an upper instrumental figure takes the lead (39.695) and the instruments decay one
 * by one (50.28) to a tail.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'lead', name: 'Follows who leads',
    about: 'Follows the lead as it passes from voice to bass to drums to the upper figure. Close on the voice; the bass opens the picture halfway; the suspension draws it in; the drums open it to the widest; the upper figure brings it back to the middle, and the decay closes it slowly.',
    keyframes: [{t: 0, wide: 0.3}, {t: 10.48, wide: 0.3}, {t: 10.98, wide: 0.55}, {t: 18.6, wide: 0.55}, {t: 19.6, wide: 0.4}, {t: 20.23, wide: 0.4},
      {t: 20.73, wide: 0.95}, {t: 39.45, wide: 0.95}, {t: 41.0, wide: 0.65}, {t: 50.28, wide: 0.65}, {t: 55.0, wide: 0.45}]},
  {id: 'held', name: 'Held breath',
    about: 'Follows tension. From the roll the picture closes in slowly through the bass restart, closest in the suspension; the drums open it at once; after them it closes slowly again as the instruments fall away.',
    keyframes: [{t: 0, wide: 0.5}, {t: 8.45, wide: 0.5}, {t: 19.6, wide: 0.25}, {t: 20.23, wide: 0.25}, {t: 20.73, wide: 0.95}, {t: 39.7, wide: 0.9},
      {t: 55.0, wide: 0.45}]},
];
export default zooms;
