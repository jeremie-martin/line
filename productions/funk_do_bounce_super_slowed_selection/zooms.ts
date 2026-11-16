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
  {id: 'arrive', name: "Two arrivals",
    about: "Close on the voice; the roll carries the picture out to the bass, and the suspension carries it out again to the drums. It comes back in as the song decays.",
    keyframes: [{t: 0, wide: 0.3}, {t: 8.45, wide: 0.3}, {t: 10.73, wide: 0.6}, {t: 18.8, wide: 0.6}, {t: 20.48, wide: 0.95}, {t: 50.28, wide: 0.95}, {t: 55, wide: 0.6}, {t: 57, wide: 0.6}]},
  {id: 'suspension', name: "Held in the suspension",
    about: "Opens gently to the bass, then draws in and holds through the suspension; its last half second lets go, so the drums arrive wide. Slowly wider to the upper figure.",
    keyframes: [{t: 0, wide: 0.35}, {t: 9, wide: 0.35}, {t: 10.73, wide: 0.5}, {t: 17, wide: 0.5}, {t: 18.8, wide: 0.38}, {t: 19.9, wide: 0.35}, {t: 20.48, wide: 0.9}, {t: 39.7, wide: 1}, {t: 50.28, wide: 1}, {t: 56, wide: 0.7}]},
];
export default zooms;
