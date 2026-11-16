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
  {id: 'runup', name: "Opens through the run up",
    about: "Close while the figure and the voice are alone, a little wider for the isolated answers; the run up carries the picture out, so the return arrives wide, and the last phrases open it a touch more.",
    keyframes: [{t: 0, wide: 0.25}, {t: 9.88, wide: 0.25}, {t: 17.21, wide: 0.35}, {t: 19.64, wide: 0.9}, {t: 38.4, wide: 0.9}, {t: 39.78, wide: 1}, {t: 56, wide: 1}]},
  {id: 'long', name: "One long opening",
    about: "No sudden change: the picture opens slowly from the first voice to the last phrases, following the song filling up.",
    keyframes: [{t: 0, wide: 0.2}, {t: 4.99, wide: 0.2}, {t: 19.64, wide: 0.6}, {t: 39.78, wide: 0.85}, {t: 52, wide: 0.95}]},
];
export default zooms;
