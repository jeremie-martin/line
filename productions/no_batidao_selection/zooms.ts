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
  {id: 'pull', name: "One pull-back, one held breath",
    about: "Close on the vocal phrases; the drum build pulls the picture back, arriving wide as the bass does. It comes in for the voice and its answers, and opens over the last bar before the last body.",
    keyframes: [{t: 0, wide: 0.25}, {t: 7.4, wide: 0.25}, {t: 15.24, wide: 0.95}, {t: 29.55, wide: 0.95}, {t: 35.5, wide: 0.4}, {t: 36.1, wide: 0.4}, {t: 37.03, wide: 0.95}, {t: 56, wide: 0.95}]},
  {id: 'build', name: "Follows the build",
    about: "A smaller pull-back through the drum build, slowly wider through the body; eases in for the voice and steps out before the last body.",
    keyframes: [{t: 0, wide: 0.3}, {t: 7.63, wide: 0.3}, {t: 15.24, wide: 0.7}, {t: 29, wide: 0.85}, {t: 29.55, wide: 0.85}, {t: 33, wide: 0.6}, {t: 35.65, wide: 0.6}, {t: 37.08, wide: 0.95}, {t: 56, wide: 0.95}]},
];
export default zooms;
