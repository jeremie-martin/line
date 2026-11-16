/**
 * Believer (78.5 s): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: a stomp in bars of 1.92 s from 0.43, the same from first bar to last; every fourth bar is a stop (kick and snare,
 * three guitar notes in the gap, then a downbeat alone): bars starting 6.19, 13.87, 21.55, 29.23, 36.91, 44.59, 52.27, 59.95,
 * 67.63. Verse (0.43), denser verse (15.79), pre-chorus (31.15), the drums stop for a bar (46.51), "Pain!" and the chorus
 * (48.43), where a second percussion layer joins from 61.87.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'chorus', name: "Opens for the chorus",
    about: "Holds through the verses, leans in slowly through the pre-chorus, and opens across the break where the drums stop, so \"Pain!\" lands in a wide picture. The chorus keeps opening slowly.",
    keyframes: [{t: 0, wide: 0.4}, {t: 31.15, wide: 0.4}, {t: 44.6, wide: 0.3}, {t: 46.45, wide: 0.3}, {t: 48.45, wide: 0.9}, {t: 70, wide: 1}, {t: 75, wide: 1}]},
  {id: 'climb', name: "Climbs with the song",
    about: "A step wider into each new part, each taken in the stop bar that leads to it: the denser verse, the pre-chorus, then the break into the chorus, and once more where the second percussion joins.",
    keyframes: [{t: 0, wide: 0.3}, {t: 13.9, wide: 0.3}, {t: 15.79, wide: 0.4}, {t: 29.2, wide: 0.4}, {t: 31.15, wide: 0.5}, {t: 46.45, wide: 0.5}, {t: 48.45, wide: 0.85}, {t: 60.15, wide: 0.85}, {t: 62.02, wide: 1}, {t: 75, wide: 1}]},
];
export default zooms;
