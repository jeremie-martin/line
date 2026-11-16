/**
 * No Batidão (slowed, 59.5 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from its
 * id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: this cut starts on the percussion-only build (to 6.4), the bass arrives (6.409) for the full body, a vocal passage
 * with sparse drum answers (23.626–32.5), and the return (32.496), where the voice drops out at about 41, to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'gentle', name: "Small steps",
    about: "No big event in this version, so no big move: a small step out as the bass arrives, slowly a little wider, a little nearer for the voice, a small step out for the return.",
    keyframes: [{t: 0, wide: 0.4}, {t: 4.5, wide: 0.4}, {t: 6.41, wide: 0.6}, {t: 23, wide: 0.7}, {t: 23.63, wide: 0.7}, {t: 27, wide: 0.5}, {t: 31, wide: 0.5}, {t: 32.5, wide: 0.75}, {t: 56, wide: 0.75}]},
  {id: 'long', name: "One slow opening",
    about: "The picture only ever opens, slowly, from the drum build to the return.",
    keyframes: [{t: 0, wide: 0.35}, {t: 6.41, wide: 0.45}, {t: 23.63, wide: 0.6}, {t: 32.5, wide: 0.8}, {t: 56, wide: 0.85}]},
];
export default zooms;
