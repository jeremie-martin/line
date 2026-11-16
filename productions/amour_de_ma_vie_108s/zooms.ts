/**
 * L'amour de ma vie (108.5 s, the full cut): zoom lanes. Each follows one thing in the music; a ride is given one of them from
 * its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the
 * scale every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back
 * to the whole course. Times are the song's (music.ts).
 *
 * The song: the voice alone (to 3.25), the drums' groove with words alone in its rests (10.286, 15.604, 23.766), a break
 * (24.3) and re-entry (25.252) into the loudest stretch, a fill and groove B (46.579) whose lift (57) ends with the drums
 * stopping (64.935); then 24 s of calm, bass and voice (65–89), light drums with a swell (89.2, 94.575), and the voice
 * thinning out to the fade (97.3–105).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'arc', name: "Out with the drums, back with the voice",
    about: "Opens into the first groove and keeps opening through both grooves, each lead-in (the one-second break, the fill) carrying it a step further. When the drums leave it comes back in slowly and stays near for the breakdown.",
    keyframes: [{t: 0, wide: 0.25}, {t: 2.3, wide: 0.25}, {t: 3.35, wide: 0.5}, {t: 24.4, wide: 0.7}, {t: 25.35, wide: 0.85}, {t: 44.26, wide: 0.9}, {t: 46.58, wide: 1}, {t: 63.9, wide: 1}, {t: 67, wide: 0.6}, {t: 89.38, wide: 0.3}, {t: 92.15, wide: 0.45}, {t: 100, wide: 0.4}, {t: 105, wide: 0.4}]},
  {id: 'peak', name: "The break before the peak",
    about: "Steady through the first groove, leans in over its last bars, and opens across the one-second break so the peak arrives wide. After the last groove, one long closing in to the end.",
    keyframes: [{t: 0, wide: 0.4}, {t: 22.5, wide: 0.4}, {t: 24.4, wide: 0.3}, {t: 25.35, wide: 0.85}, {t: 44.26, wide: 0.85}, {t: 46.58, wide: 0.95}, {t: 64.94, wide: 0.95}, {t: 97.3, wide: 0.2}, {t: 105, wide: 0.2}]},
];
export default zooms;
