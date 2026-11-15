/**
 * MXZI — Montagem Tomada (extended, 59 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of
 * them from its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on
 * the scale every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls
 * back to the whole course. Times are the song's (composition.json).
 *
 * The song: two builds and two returns. The voice over a held bass (3.05–9.17), a bass swell (9.172), the first drum return
 * (11.018–24.9); the voice again without drums (25.6), a pickup (35.04), a last swell (39.242), and the final return
 * (40.554), firmer, to the recording's release (55.3).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'returns', name: 'The swell opens it',
    about: 'Follows the swells. Close on the voice; each bass swell starts to open the picture and the drums complete it at once; the voice\'s second build comes back in, and the final return is the widest.',
    keyframes: [{t: 0, wide: 0.3}, {t: 9.17, wide: 0.3}, {t: 10.77, wide: 0.5}, {t: 11.27, wide: 0.85}, {t: 24.9, wide: 0.85}, {t: 26.4, wide: 0.35},
      {t: 39.24, wide: 0.35}, {t: 40.3, wide: 0.55}, {t: 40.8, wide: 0.95}]},
  {id: 'held', name: 'Held breath, twice',
    about: 'Follows tension. Through each build the picture closes in slowly, the second time further, and each return opens it at once, the final one to the widest.',
    keyframes: [{t: 0, wide: 0.6}, {t: 3.05, wide: 0.6}, {t: 10.77, wide: 0.3}, {t: 11.27, wide: 0.9}, {t: 24.9, wide: 0.9}, {t: 26.0, wide: 0.75},
      {t: 40.3, wide: 0.25}, {t: 40.8, wide: 0.95}]},
];
export default zooms;
