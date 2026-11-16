/**
 * L'amour de ma vie (44.5 s cut): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: the voice alone (to 3.25), the drums enter with three kicks (3.251) in a syncopated groove of runs and rests;
 * the voice sings alone in a few rests (10.275, 15.604, 23.766); the hook (17–24); a break where the voice holds a word
 * alone (24.3–25.25); the re-entry (25.252) into the same groove, the loudest stretch of the cut, to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'arc', name: "Opens with the groove",
    about: "Close on her voice, opening as the drums come in, and from there one slow opening, with the one-second break carrying it a step further into the peak.",
    keyframes: [{t: 0, wide: 0.3}, {t: 2.3, wide: 0.3}, {t: 3.35, wide: 0.5}, {t: 24.4, wide: 0.7}, {t: 25.35, wide: 0.9}, {t: 41, wide: 1}]},
  {id: 'peak', name: "The break before the peak",
    about: "Steady through the first groove, leans in over its last bars, and opens across the one-second break so the peak arrives wide.",
    keyframes: [{t: 0, wide: 0.45}, {t: 22.5, wide: 0.45}, {t: 24.4, wide: 0.3}, {t: 25.35, wide: 0.9}, {t: 41, wide: 0.85}]},
];
export default zooms;
