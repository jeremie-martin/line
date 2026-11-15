/**
 * No Batidão (59.5 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale every
 * song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: vocal phrases (to 7.6), a percussion-only build (7.628), the bass arrives (15.244) for the full body, a vocal
 * passage with sparse drum answers (29.547–36.9), and the last body (36.931), where the voice drops out at about 43.7, to the
 * end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'stages', name: 'Two-stage return',
    about: 'Follows the return in its two stages. Close on the voice; the drums open the picture halfway, the bass opens it fully; the vocal passage comes back in, and the last body opens it to the widest.',
    keyframes: [{t: 0, wide: 0.3}, {t: 7.38, wide: 0.3}, {t: 7.88, wide: 0.55}, {t: 14.99, wide: 0.55}, {t: 15.49, wide: 0.85}, {t: 29.3, wide: 0.85},
      {t: 30.5, wide: 0.45}, {t: 36.68, wide: 0.45}, {t: 37.18, wide: 0.95}]},
  {id: 'pull', name: 'One pull-back, one held breath',
    about: 'Follows the two builds differently. Close on the voice; from the first drum the picture opens without a pause through the build and is widest as the bass arrives; through the vocal passage it closes in slowly, and the last body opens it at once.',
    keyframes: [{t: 0, wide: 0.25}, {t: 7.4, wide: 0.25}, {t: 15.49, wide: 0.95}, {t: 29.3, wide: 0.95}, {t: 36.68, wide: 0.4}, {t: 37.18, wide: 0.95}]},
];
export default zooms;
