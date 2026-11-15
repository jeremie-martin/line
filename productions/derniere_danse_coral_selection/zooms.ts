/**
 * Dernière danse × Montagem Coral (60 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of
 * them from its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest),
 * on the scale every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture
 * pulls back to the whole course. Times are the song's (composition.json).
 *
 * The song: the voice exposed (to 12.26), isolated drum answers (12.26, 15.41), a first drum burst (19.006–24.9), the voice
 * in the foreground with its held line, the loudest singing of the clip (25.3–34.5), the voice continuing over sparse answers
 * (41.12, 44.28), the final burst (47.88–53.8), and a decay (54.8).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'bursts', name: 'Opens for the bursts',
    about: 'Follows the drums against the voice. Close on the exposed voice; the first drum answer opens the picture a little, and each burst opens it at once; between them it comes back in for the voice, and the final burst is the widest.',
    keyframes: [{t: 0, wide: 0.35}, {t: 12.0, wide: 0.35}, {t: 12.5, wide: 0.45}, {t: 18.76, wide: 0.45}, {t: 19.26, wide: 0.9}, {t: 24.9, wide: 0.9},
      {t: 26.2, wide: 0.35}, {t: 40.87, wide: 0.35}, {t: 41.37, wide: 0.5}, {t: 47.63, wide: 0.5}, {t: 48.13, wide: 1}, {t: 53.8, wide: 1},
      {t: 55.5, wide: 0.55}]},
  {id: 'line', name: 'Closes on the held line',
    about: 'Follows the voice\'s strongest moment. The first burst opens the picture; after it, the picture closes in slowly onto the held line, the loudest singing; then it opens slowly as the voice goes on, and the final burst opens it fully.',
    keyframes: [{t: 0, wide: 0.45}, {t: 18.76, wide: 0.45}, {t: 19.26, wide: 0.7}, {t: 24.9, wide: 0.7}, {t: 28.28, wide: 0.28}, {t: 32.5, wide: 0.28},
      {t: 47.63, wide: 0.6}, {t: 48.13, wide: 1}, {t: 53.8, wide: 1}, {t: 55.5, wide: 0.6}]},
];
export default zooms;
