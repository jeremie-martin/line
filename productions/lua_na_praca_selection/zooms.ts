/**
 * Lua na Praça (52 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale every
 * song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: loud percussion (to 5.56), a vocal pickup, the bass-and-drum body (7.767–20.1), a vocal release (20.55) into
 * seven seconds of near silence (22–29.65), the drums return alone (29.652), and the bass completes the return (36.92) to
 * the ending (49.6).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'close', name: 'Comes in for the silence',
    about: 'Follows the silence as a quiet moment. The percussion and the body are wide, with the vocal pickup between them a little closer; the near silence brings the picture close; the drums open it halfway, and the bass opens it fully.',
    keyframes: [{t: 0, wide: 0.7}, {t: 5.4, wide: 0.7}, {t: 6.6, wide: 0.5}, {t: 7.52, wide: 0.5}, {t: 8.02, wide: 0.85}, {t: 20.3, wide: 0.85},
      {t: 22.5, wide: 0.3}, {t: 29.4, wide: 0.3}, {t: 29.9, wide: 0.6}, {t: 36.67, wide: 0.6}, {t: 37.17, wide: 0.95}]},
  {id: 'space', name: 'Wide in the silence',
    about: 'Follows the silence as space: the long flight. The picture holds in the middle through the opening; it opens slowly into the silence and is widest there; the drums come back close, and the bass opens it again.',
    keyframes: [{t: 0, wide: 0.6}, {t: 20.3, wide: 0.6}, {t: 24.0, wide: 0.95}, {t: 29.4, wide: 0.95}, {t: 29.9, wide: 0.45}, {t: 36.67, wide: 0.45},
      {t: 37.17, wide: 0.85}]},
];
export default zooms;
