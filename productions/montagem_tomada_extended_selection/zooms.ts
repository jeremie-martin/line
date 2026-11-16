/**
 * MXZI — Montagem Tomada (extended, 59 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of
 * them from its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on
 * the scale every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls
 * back to the whole course. Times are the song's (composition.json).
 *
 * The song: two builds and two returns. The voice over a held bass (3.05–9.17), a bass swell (9.172), the first drum return
 * (11.018–24.9); the voice again without drums (25.6), a pickup (35.04), a last swell (39.242), and the final return
 * (40.554), firmer, to the recording's release (55.3).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'swells', name: "The swells open it",
    about: "Close on the build and the voice; each swell carries the picture out to the return that follows it. In for the voice between them.",
    keyframes: [{t: 0, wide: 0.3}, {t: 9.17, wide: 0.3}, {t: 11.02, wide: 0.9}, {t: 25.6, wide: 0.9}, {t: 28.5, wide: 0.4}, {t: 35.04, wide: 0.4}, {t: 39.24, wide: 0.5}, {t: 40.55, wide: 0.95}, {t: 55, wide: 0.95}]},
  {id: 'second', name: "The second return is the big one",
    about: "A moderate opening to the first return; in for the voice; then one long opening through the pickup and the last swell, widest for the final return.",
    keyframes: [{t: 0, wide: 0.35}, {t: 8, wide: 0.35}, {t: 11.02, wide: 0.7}, {t: 25.6, wide: 0.7}, {t: 29, wide: 0.45}, {t: 35.04, wide: 0.45}, {t: 40.55, wide: 1}, {t: 55, wide: 1}]},
];
export default zooms;
