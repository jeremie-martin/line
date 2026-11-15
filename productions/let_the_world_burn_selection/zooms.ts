/**
 * Let the World Burn (59 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its
 * id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (composition.json).
 *
 * The song: a quiet vocal pickup rising (to 4.48), the last chorus with the drums (4.481–44.2) in which the voice holds
 * (24.46) and then climbs (34.15), the drums falling away and the voice alone (44.94), its last words (54) and release.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'drums', name: 'Drums wide, voice close',
    about: 'Follows who is there. Close on the pickup; the chorus opens the picture at once and it holds wide while the drums play; when they fall away it comes back in to the voice alone, a little closer for the last words.',
    keyframes: [{t: 0, wide: 0.3}, {t: 4.23, wide: 0.3}, {t: 4.73, wide: 0.85}, {t: 44.3, wide: 0.85}, {t: 46.0, wide: 0.4}, {t: 53.99, wide: 0.4},
      {t: 55.5, wide: 0.3}]},
  {id: 'rise', name: 'Rises with the voice',
    about: 'Follows the voice through the chorus. The chorus opens the picture halfway; it opens a step when the voice holds its long note, another when it climbs, and closes in slowly as the drums fall away.',
    keyframes: [{t: 0, wide: 0.35}, {t: 4.23, wide: 0.35}, {t: 4.73, wide: 0.6}, {t: 24.2, wide: 0.6}, {t: 25.4, wide: 0.75}, {t: 33.9, wide: 0.75},
      {t: 35.1, wide: 0.9}, {t: 44.3, wide: 0.9}, {t: 47.0, wide: 0.45}]},
];
export default zooms;
