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
  {id: 'drop', name: 'The drop and the toms',
    about: 'Follows the form. Close on the solo voice; the drop opens the picture at once; the tom break, where the bass and the voice stop, draws it in, and the re-entry opens it again to the widest.',
    keyframes: [{t: 0, wide: 0.3}, {t: 8.37, wide: 0.3}, {t: 8.86, wide: 0.9}, {t: 23.62, wide: 0.9}, {t: 24.1, wide: 0.55}, {t: 25.8, wide: 0.55},
      {t: 26.3, wide: 0.95}]},
  {id: 'fills', name: 'A step at each fill',
    about: 'Follows the kick triplets. Close on the voice; the drop opens the picture halfway, and each triplet fill, every sixteen kicks, pushes it a step wider through the whole body.',
    keyframes: [{t: 0, wide: 0.35}, {t: 8.37, wide: 0.35}, {t: 8.86, wide: 0.55}, {t: 12.33, wide: 0.55}, {t: 12.93, wide: 0.65}, {t: 21.05, wide: 0.65},
      {t: 21.65, wide: 0.75}, {t: 29.77, wide: 0.75}, {t: 30.37, wide: 0.85}, {t: 38.49, wide: 0.85}, {t: 39.09, wide: 0.95}]},
];
export default zooms;
