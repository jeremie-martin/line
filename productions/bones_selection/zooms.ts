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
  {id: 'pickup', name: "Opens through the pickup",
    about: "Close on the voice, a little wider when the bass joins; the pickup carries the picture out so the chorus arrives wide, and it stays there.",
    keyframes: [{t: 0, wide: 0.3}, {t: 7.6, wide: 0.3}, {t: 8.6, wide: 0.4}, {t: 15.35, wide: 0.4}, {t: 17.51, wide: 0.95}, {t: 50, wide: 0.85}]},
  {id: 'long', name: "Slow, then the chorus",
    about: "Opens very slowly through the voice and the bass, takes one clear step in the last second before the chorus, and keeps opening through it.",
    keyframes: [{t: 0, wide: 0.2}, {t: 15.2, wide: 0.45}, {t: 16.5, wide: 0.45}, {t: 17.46, wide: 0.8}, {t: 45, wide: 1}, {t: 50, wide: 1}]},
];
export default zooms;
