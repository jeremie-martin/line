/**
 * Andromeda — Montagem Coma (59 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from
 * its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song alternates drums and voice over a continuing bass: drum bursts (to 9.57), a light upper figure and the voice
 * answering (9.57–19), the return of the drums (19.075), the voice in the foreground over lighter drums (33.576–43), and the
 * last return (43.073), the strongest, to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'returns', name: "Out for the drums, in for the voice",
    about: "A middle distance on the drum bursts, nearer for the light figure and the voice; each return of the drums opens the picture over the bar before it, the last one furthest.",
    keyframes: [{t: 0, wide: 0.6}, {t: 9.57, wide: 0.6}, {t: 12, wide: 0.4}, {t: 17.6, wide: 0.4}, {t: 19.07, wide: 0.7}, {t: 33.58, wide: 0.7}, {t: 36, wide: 0.45}, {t: 41.6, wide: 0.45}, {t: 43.07, wide: 0.8}, {t: 56, wide: 0.8}]},
  {id: 'gentle', name: "Gentle swell",
    about: "Small moves only, for a song whose level hardly changes: slightly nearer toward the voice answers, slowly out to the return, a little in for the voice in the foreground, and slowly out to the end.",
    keyframes: [{t: 0, wide: 0.5}, {t: 15, wide: 0.4}, {t: 19.07, wide: 0.6}, {t: 33.6, wide: 0.6}, {t: 38, wide: 0.5}, {t: 43.07, wide: 0.7}, {t: 55, wide: 0.8}, {t: 56, wide: 0.8}]},
];
export default zooms;
