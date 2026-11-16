/**
 * Passo Bem Solto (56 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale every
 * song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: a call and response between percussion and voice. The groove (to 9.1), the voice leads over soft drums (9.114),
 * drum strikes come back into it (16.695, 18.541), the return (24.079), a short interruption with two vocal shouts (37.198,
 * 37.756), the last return (38.847), and the start of a decay (54.5).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'call', name: "Leans in for the call",
    about: "Wide on the groove, nearer when the voice comes forward; out over the bar before the return; it leans in for the first half of the vocal call and lets go in the second, so the last return arrives wide.",
    keyframes: [{t: 0, wide: 0.65}, {t: 9.11, wide: 0.65}, {t: 12.11, wide: 0.45}, {t: 22.48, wide: 0.45}, {t: 24.08, wide: 0.75}, {t: 36.8, wide: 0.75}, {t: 37.93, wide: 0.6}, {t: 38.85, wide: 0.9}, {t: 53, wide: 0.9}]},
  {id: 'breath', name: "One slow breath",
    about: "No sudden change: slowly in through the voice, slowly out through the drum answers to the return, and slowly wider to the end.",
    keyframes: [{t: 0, wide: 0.6}, {t: 18.54, wide: 0.4}, {t: 24.08, wide: 0.7}, {t: 38.85, wide: 0.85}, {t: 53, wide: 0.9}]},
];
export default zooms;
