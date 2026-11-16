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
  {id: 'bursts', name: "Opens for the two bursts",
    about: "Close on the exposed voice; opens over the bars leading to each burst and comes back to the voice between them.",
    keyframes: [{t: 0, wide: 0.25}, {t: 11, wide: 0.25}, {t: 12.26, wide: 0.4}, {t: 17.5, wide: 0.4}, {t: 19.01, wide: 0.85}, {t: 25.3, wide: 0.85}, {t: 28.28, wide: 0.5}, {t: 40, wide: 0.45}, {t: 41.12, wide: 0.55}, {t: 46.4, wide: 0.55}, {t: 47.88, wide: 0.95}, {t: 54.8, wide: 0.95}, {t: 57, wide: 0.7}]},
  {id: 'line', name: "Closes on the held line",
    about: "Opens slowly with the drums, then comes in for the held line, the closest moment of the song, and opens slowly again as the answers return toward the final burst.",
    keyframes: [{t: 0, wide: 0.3}, {t: 19, wide: 0.6}, {t: 25.3, wide: 0.75}, {t: 30, wide: 0.35}, {t: 41.12, wide: 0.35}, {t: 47.88, wide: 0.9}, {t: 57, wide: 0.9}]},
];
export default zooms;
