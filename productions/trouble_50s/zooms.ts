/**
 * Trouble: zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: a quiet voice intro (to 14.71), a 3-3-2 groove, a short break (27.6), the drop (29.02) with heavy kicks in a
 * stop-and-go, two climbing triples (34.40, 41.56), a vocal break (43.4), and last kicks climbing from 46.95. The owner liked
 * the step at each triple and found the plain lane reasonable; the voice lane was too close on the voice, and is eased here.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'drop', name: "Opens across the break",
    about: "Close on the voice, a step out over the bar before the groove; the break carries the picture out to the drop. In for the vocal break, and out again through its build.",
    keyframes: [{t: 0, wide: 0.3}, {t: 13.2, wide: 0.3}, {t: 14.71, wide: 0.5}, {t: 27.6, wide: 0.5}, {t: 29.02, wide: 0.95}, {t: 43.4, wide: 0.95}, {t: 45.3, wide: 0.55}, {t: 46.95, wide: 0.85}]},
  {id: 'long', name: "Slowly wider, then the drop",
    about: "Opens slowly through the voice and the groove, takes one clear step in the last second of the break, and eases back for the vocal break.",
    keyframes: [{t: 0, wide: 0.2}, {t: 14.71, wide: 0.4}, {t: 27.6, wide: 0.6}, {t: 28.2, wide: 0.6}, {t: 29.02, wide: 0.9}, {t: 43.4, wide: 0.9}, {t: 47, wide: 0.6}]},
];
export default zooms;
