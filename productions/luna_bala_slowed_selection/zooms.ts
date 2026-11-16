/**
 * Luna Bala (slowed, 56 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale every
 * song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: a groove fragment dissolves (to 3.2) into four seconds of empty space, then the voice alone (7.3) with one lone
 * drum answer (12.19) and a pickup (16.8), then the drums and upper replies return (20.921), larger than the opening, to the
 * end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'pickup', name: "Opens through the pickup",
    about: "Wide as the groove dissolves, in for the empty space and the voice; the pickup carries the picture out to the drums.",
    keyframes: [{t: 0, wide: 0.7}, {t: 1, wide: 0.7}, {t: 5, wide: 0.3}, {t: 16.95, wide: 0.3}, {t: 21.07, wide: 0.85}, {t: 53, wide: 0.85}]},
  {id: 'long', name: "One long opening",
    about: "In for the empty space, then slowly wider from the first word to the drums, and a small step over the bar before the later phrase.",
    keyframes: [{t: 0, wide: 0.55}, {t: 3, wide: 0.55}, {t: 6, wide: 0.25}, {t: 7.3, wide: 0.25}, {t: 20.92, wide: 0.7}, {t: 36.1, wide: 0.7}, {t: 37.37, wide: 0.85}, {t: 53, wide: 0.85}]},
];
export default zooms;
