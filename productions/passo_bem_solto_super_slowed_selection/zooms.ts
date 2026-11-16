/**
 * Passo Bem Solto (super slowed, 60 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them
 * from its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the
 * scale every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back
 * to the whole course. Times are the song's (composition.json).
 *
 * The song: a call and response between percussion and voice. The tail of the groove (to 5.4), the exposed voice (5.457), drum
 * strikes come back into it (14.478, 16.672), the return (23.255), a short interruption with three vocal shouts (38.847,
 * 39.509, 40.043), the last return (40.821) to the decay (58.4).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'call', name: "Leans in for the call",
    about: "Wide on the groove, nearer when the voice comes forward; out over the bar before the return; it leans in for the first half of the vocal call and lets go in the second, so the last return arrives wide.",
    keyframes: [{t: 0, wide: 0.65}, {t: 5.46, wide: 0.65}, {t: 8.46, wide: 0.45}, {t: 21.65, wide: 0.45}, {t: 23.25, wide: 0.75}, {t: 38.4, wide: 0.75}, {t: 39.73, wide: 0.6}, {t: 40.82, wide: 0.85}, {t: 57, wide: 0.85}]},
  {id: 'breath', name: "One slow breath",
    about: "No sudden change: slowly in through the voice, slowly out through the drum answers to the return, and slowly wider to the end.",
    keyframes: [{t: 0, wide: 0.6}, {t: 16.67, wide: 0.4}, {t: 23.25, wide: 0.7}, {t: 40.82, wide: 0.85}, {t: 57, wide: 0.9}]},
];
export default zooms;
