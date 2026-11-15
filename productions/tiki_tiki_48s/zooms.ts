/**
 * Tiki Tiki: zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: a quiet intro (to 6.9), first beats, the drop at 10.43, a reset at 24.35, the run from 27.83, a float out from
 * 41.74. The owner liked both written lanes (2026-11-15).
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'drops', name: 'Two drops',
    about: 'Follows the two drops. Close for the intro and the first beats; each drop opens the picture at once; the reset between them comes back in.',
    keyframes: [{t: 0, wide: 0.15}, {t: 6.3, wide: 0.15}, {t: 7.5, wide: 0.3}, {t: 10.18, wide: 0.3}, {t: 10.68, wide: 0.95}, {t: 23.9, wide: 0.95}, {t: 25.3, wide: 0.4}, {t: 27.58, wide: 0.4}, {t: 28.08, wide: 1}, {t: 41.2, wide: 1}, {t: 43.2, wide: 0.45}]},
  {id: 'breath', name: 'One slow breath',
    about: 'Follows the long shape, with no sudden change: the picture opens slowly from the first second to the end of the hook, breathes in at the reset, opens again through the run, and settles.',
    keyframes: [{t: 0, wide: 0.2}, {t: 24.0, wide: 0.9}, {t: 26.5, wide: 0.6}, {t: 41.0, wide: 1}, {t: 45.0, wide: 0.55}]},
];
export default zooms;
