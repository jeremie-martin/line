/**
 * Bones (54 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: the voice almost whispered (0–8.6), three bass entries alone under it (8.94, 11.04, 13.14), a pickup of four
 * words and three strokes (15.28–17.11), the chorus (17.36): sixteen bars of two heavy hits, every fourth a fill of three
 * (23.67, 32.09, 40.51, 48.92); a release from 49.7 while the tail rings.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'turn', name: 'The turn',
    about: 'Follows the one turn of the clip. Close on the whispered voice; each bass entry opens the picture a little, the only thing that grows; the chorus entry opens it at once and it stays wide to the release.',
    keyframes: [{t: 0, wide: 0.3}, {t: 8.74, wide: 0.3}, {t: 9.24, wide: 0.37}, {t: 10.84, wide: 0.37}, {t: 11.34, wide: 0.44}, {t: 12.94, wide: 0.44},
      {t: 13.44, wide: 0.51}, {t: 17.11, wide: 0.51}, {t: 17.56, wide: 0.9}, {t: 49.73, wide: 0.9}, {t: 51.0, wide: 0.7}]},
  {id: 'fills', name: 'A step at each fill',
    about: 'Follows the chorus fills. Close through the bridge; the chorus opens the picture halfway, and each fill bar of three heavy hits pushes it a step wider, widest at the last fill; it eases back as the tail rings.',
    keyframes: [{t: 0, wide: 0.35}, {t: 17.11, wide: 0.35}, {t: 17.56, wide: 0.6}, {t: 23.47, wide: 0.6}, {t: 24.17, wide: 0.7}, {t: 31.89, wide: 0.7},
      {t: 32.59, wide: 0.8}, {t: 40.31, wide: 0.8}, {t: 41.01, wide: 0.9}, {t: 48.72, wide: 0.9}, {t: 49.42, wide: 1}, {t: 49.9, wide: 1},
      {t: 51.0, wide: 0.75}]},
];
export default zooms;
