/**
 * Luna Bala (slowed, 44 s): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: a solo voice in two phrases with a dead stop between (3.5–4.49), the drop (8.615) into a flat, even body of a
 * kick every 0.545 s with a kick triplet fill every 16 kicks (12.434, 21.153, 29.872, 38.592), a tom break without bass or
 * voice (23.87–26.05), the re-entry (26.053), and the collapse after the last kick (42.96).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'drop', name: "Opens into the drop",
    about: "Close on the voice intro; the last two seconds before the drop open the picture, so the body arrives wide. A little nearer for the breakdown.",
    keyframes: [{t: 0, wide: 0.25}, {t: 6.8, wide: 0.25}, {t: 8.58, wide: 0.9}, {t: 34, wide: 0.9}, {t: 35.5, wide: 0.75}, {t: 41, wide: 0.75}]},
  {id: 'slow', name: "Slowly wider",
    about: "A smaller step into the drop, then one slow opening through the body to the climax; it eases back through the breakdown.",
    keyframes: [{t: 0, wide: 0.3}, {t: 7.5, wide: 0.35}, {t: 8.58, wide: 0.6}, {t: 24.2, wide: 0.95}, {t: 35.5, wide: 0.95}, {t: 40, wide: 0.7}, {t: 41, wide: 0.7}]},
];
export default zooms;
