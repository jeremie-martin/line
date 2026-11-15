/**
 * Amor na Praia (60 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (composition.json).
 *
 * The song: a gentle upper figure alone (0–5), the voice joins (4.99), isolated drum answers with the bass dropping out
 * (9.88, 14.45, 14.77), a run-up of three strokes (17.21–18.12), then the return (19.64): bass and drums together, an
 * even groove to the end (58), with no change of level in it.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'answers', name: 'A step at each answer',
    about: 'Follows the drums arriving. Close on the gentle figure and the voice; each isolated drum answer opens the picture a step; it keeps opening through the run-up, and the return opens it fully for the groove.',
    keyframes: [{t: 0, wide: 0.3}, {t: 9.63, wide: 0.3}, {t: 10.13, wide: 0.45}, {t: 14.2, wide: 0.45}, {t: 14.7, wide: 0.6}, {t: 17.0, wide: 0.6},
      {t: 19.4, wide: 0.8}, {t: 19.9, wide: 0.9}]},
  {id: 'held', name: 'Held before the return',
    about: 'Follows tension. From the first drum answer the picture slowly closes in under the voice, closest on the run-up; the return opens it at once, so the groove arrives in the widest picture.',
    keyframes: [{t: 0, wide: 0.45}, {t: 9.88, wide: 0.45}, {t: 17.2, wide: 0.25}, {t: 19.4, wide: 0.25}, {t: 19.9, wide: 1}, {t: 24.0, wide: 0.9}]},
];
export default zooms;
