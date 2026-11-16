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
  {id: 'bass', name: "Wide where the bass is",
    about: "The voice pickup carries the picture out to the bass body. In the quiet it settles at the steady distance, neither near nor far; the drum return opens it slowly, arriving wide when the bass comes back.",
    keyframes: [{t: 0, wide: 0.5}, {t: 5.56, wide: 0.5}, {t: 7.77, wide: 0.85}, {t: 20.55, wide: 0.85}, {t: 24, wide: 0.5}, {t: 29.65, wide: 0.5}, {t: 36.92, wide: 0.9}, {t: 49, wide: 0.9}]},
  {id: 'shape', name: "One slow shape",
    about: "Opens slowly through the first half, eases back a little for the quiet, and takes one step over the last two seconds before the bass returns.",
    keyframes: [{t: 0, wide: 0.35}, {t: 20, wide: 0.8}, {t: 20.5, wide: 0.8}, {t: 23, wide: 0.6}, {t: 35, wide: 0.6}, {t: 36.92, wide: 0.95}, {t: 49, wide: 0.95}]},
];
export default zooms;
