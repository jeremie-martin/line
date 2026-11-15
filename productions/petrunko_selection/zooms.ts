/**
 * Petrunko: zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: a tick becomes a hit, doubles, ends in a roll (11.48–20.9), 1.4 s of nothing, the return at 22.40, then drum
 * replies in bars of 2.73 s, some answered by the bass, and a decay from 56. All three lanes were liked by the owner (2026-11-15).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'build', name: 'One pull-back',
    about: 'Follows the build. Close on the ticks; from the first drum hit the picture opens without a pause through the doubling and the roll, is at its widest for the silence and the return, and stays wide for the replies.',
    keyframes: [{t: 0, wide: 0.2}, {t: 11.0, wide: 0.2}, {t: 20.9, wide: 0.95}, {t: 22.4, wide: 1}, {t: 55.0, wide: 0.85}, {t: 58.0, wide: 0.4}]},
  {id: 'release', name: 'Held breath',
    about: 'Follows tension. The picture closes in as the build tightens, closest on the roll; it opens in the silence, so the return lands in the widest picture of the song.',
    keyframes: [{t: 0, wide: 0.5}, {t: 11.0, wide: 0.5}, {t: 20.9, wide: 0.1}, {t: 21.1, wide: 0.1}, {t: 22.3, wide: 1}, {t: 55.0, wide: 0.85}, {t: 58.0, wide: 0.45}]},
  {id: 'bass', name: 'Leans in for the bass',
    about: 'Follows the replies. The same opening through the build, then the picture comes a little closer in each bar where the bass answers the drums, and steps back for the drums alone.',
    keyframes: [{t: 0, wide: 0.2}, {t: 11.0, wide: 0.2}, {t: 20.9, wide: 0.95}, {t: 25.9, wide: 0.95}, {t: 25.98, wide: 0.95}, {t: 26.98, wide: 0.6}, {t: 28.71, wide: 0.6}, {t: 29.71, wide: 0.95}, {t: 31.44, wide: 0.95}, {t: 32.44, wide: 0.6}, {t: 34.17, wide: 0.6}, {t: 35.17, wide: 0.95}, {t: 36.91, wide: 0.95}, {t: 37.91, wide: 0.6}, {t: 39.62, wide: 0.6}, {t: 40.62, wide: 0.95}, {t: 42.35, wide: 0.95}, {t: 43.35, wide: 0.6}, {t: 45.08, wide: 0.6}, {t: 46.08, wide: 0.95}, {t: 53.27, wide: 0.95}, {t: 54.27, wide: 0.6}, {t: 58.0, wide: 0.4}]},
];
export default zooms;
