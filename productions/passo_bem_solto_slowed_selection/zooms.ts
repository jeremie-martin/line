/**
 * Passo Bem Solto (slowed, 58 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from
 * its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: a call and response between percussion and voice. The groove (to 6.5), the voice forward over soft drums and bass
 * (6.513), drum strikes come back into it (15.023, 17.101), the return (23.313), a short interruption with two vocal shouts
 * (38.034, 38.65), the last return (39.892) to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'call', name: "Leans in for the call",
    about: "Wide on the groove, nearer when the voice comes forward; out over the bar before the return; it leans in for the first half of the vocal call and lets go in the second, so the last return arrives wide.",
    keyframes: [{t: 0, wide: 0.65}, {t: 6.5, wide: 0.65}, {t: 9.5, wide: 0.45}, {t: 21.86, wide: 0.45}, {t: 23.46, wide: 0.75}, {t: 37.6, wide: 0.75}, {t: 38.96, wide: 0.6}, {t: 39.99, wide: 0.85}, {t: 55, wide: 0.85}]},
  {id: 'breath', name: "One slow breath",
    about: "No sudden change: slowly in through the voice, slowly out through the drum answers to the return, and slowly wider to the end.",
    keyframes: [{t: 0, wide: 0.6}, {t: 17.1, wide: 0.4}, {t: 23.31, wide: 0.7}, {t: 39.89, wide: 0.85}, {t: 55, wide: 0.9}]},
];
export default zooms;
