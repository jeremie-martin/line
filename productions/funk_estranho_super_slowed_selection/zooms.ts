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
  {id: 'bass', name: 'Where the bass is',
    about: 'Follows the bass. Wide while its pulse plays at the start; when it dissolves the picture comes in and stays close through the figure and the voice; the bass return opens it wide at once.',
    keyframes: [{t: 0, wide: 0.7}, {t: 3.38, wide: 0.7}, {t: 5.5, wide: 0.35}, {t: 21.24, wide: 0.35}, {t: 21.74, wide: 0.9}]},
  {id: 'build', name: 'Pushes in to the return',
    about: 'Follows tension. The empty dissolve stays in the middle; from the upper figure\'s first accent the picture closes in slowly through the voice pickup, and the bass return opens it at once to the widest.',
    keyframes: [{t: 0, wide: 0.6}, {t: 12.43, wide: 0.6}, {t: 21.24, wide: 0.22}, {t: 21.74, wide: 0.95}]},
];
export default zooms;
