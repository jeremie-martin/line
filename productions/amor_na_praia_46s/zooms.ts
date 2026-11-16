/**
 * Amor na Praia (slowed, 46 s): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: a whispered intro over one 808 (to 4.46), the burst of the 808 alone (4.46–7.9, the loudest hits), a breath
 * with the voice alone (7.9–9.1), the drop (9.125) into an even four-on-the-floor groove, a hole filled by a sung "hey"
 * (26.29), the re-drop (26.726) and the same groove to the fade (43.3). After the drop nothing builds: it is one level.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'swell', name: "Opens with the groove",
    about: "Close for the soft intro; the picture opens a little into the burst, draws in for the breath with the voice alone, and opens through that breath so the groove arrives wide. From there it keeps opening slowly to the end.",
    keyframes: [{t: 0, wide: 0.3}, {t: 3, wide: 0.3}, {t: 4.46, wide: 0.5}, {t: 7.9, wide: 0.5}, {t: 8.4, wide: 0.42}, {t: 9.12, wide: 0.72}, {t: 25, wide: 0.85}, {t: 40, wide: 0.95}]},
  {id: 'hole', name: "The hole before the second groove",
    about: "Holds a middle distance through the first groove, leans in over the last bars before the hole, and opens across the hole so the second groove lands wide. One sharp move in the whole song.",
    keyframes: [{t: 0, wide: 0.35}, {t: 4.46, wide: 0.45}, {t: 22.5, wide: 0.45}, {t: 26.29, wide: 0.3}, {t: 26.73, wide: 0.9}, {t: 42, wide: 0.95}]},
];
export default zooms;
