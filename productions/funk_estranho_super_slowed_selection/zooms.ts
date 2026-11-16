/**
 * Funk Estranho (super slowed, 59 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them
 * from its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the
 * scale every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back
 * to the whole course. Times are the song's (composition.json).
 *
 * The song: the tail of a bass pulse (to 3.38), a dissolve to near silence, an upper figure that builds (7.9, 12.43), a short
 * voice pickup with light drums (16.96), then the bass returns (21.49) with a pulse every 0.57 s, unchanged to the release
 * (57.13). The bass is the song.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'build', name: "In with the silence, out with the build",
    about: "Wide on the bass tail, coming in as it dissolves; then one slow opening across the upper figure and the voice, arriving wide when the bass returns.",
    keyframes: [{t: 0, wide: 0.7}, {t: 2.5, wide: 0.7}, {t: 6, wide: 0.3}, {t: 12.43, wide: 0.3}, {t: 21.49, wide: 0.9}, {t: 38.8, wide: 0.9}, {t: 40.17, wide: 1}, {t: 56, wide: 1}]},
  {id: 'return', name: "Waits for the bass",
    about: "Comes in as the opening dissolves and stays close through the figure and the voice; the last two seconds before the bass open the picture, and it stays wide.",
    keyframes: [{t: 0, wide: 0.5}, {t: 3.4, wide: 0.5}, {t: 7.9, wide: 0.25}, {t: 19.65, wide: 0.25}, {t: 21.64, wide: 0.85}, {t: 50, wide: 0.95}, {t: 56, wide: 0.95}]},
];
export default zooms;
