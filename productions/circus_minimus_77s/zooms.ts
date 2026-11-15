/**
 * Circus Minimus (77 s): zoom lanes. Each follows one thing in the music; a ride is given one of them from its id.
 * A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to
 * the whole course. Times are the song's (music.ts).
 *
 * The song: the 808 alone with a murmured voice (to 12.86), the verse with a snare from 13.66, the groove with busy hats from
 * 25.68, the hook (38.48) where the voice leads and the drums thin out, a break without the bass (49.73), and the re-entry
 * (51.28) into the full groove, the busiest section, unchanged to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'fills', name: 'Opens as the band fills',
    about: 'Follows the texture. Close for the 808 and the murmur; a step wider when the snare comes in, another when the hats start; the hook, where her voice leads and the drums thin out, comes back in; the break draws closer, and the re-entry opens the picture wide for the full groove.',
    keyframes: [{t: 0, wide: 0.3}, {t: 12.86, wide: 0.3}, {t: 13.86, wide: 0.45}, {t: 25.43, wide: 0.45}, {t: 25.93, wide: 0.7}, {t: 38.15, wide: 0.7},
      {t: 39.65, wide: 0.45}, {t: 49.6, wide: 0.45}, {t: 50.3, wide: 0.35}, {t: 51.03, wide: 0.35}, {t: 51.53, wide: 0.9}]},
  {id: 'arc', name: 'One long opening',
    about: 'Follows the long shape, with no sudden change. The picture opens slowly from the verse to the hook, eases back in under the hook\'s long sung lines, and opens fully over the first bars after the re-entry.',
    keyframes: [{t: 0, wide: 0.25}, {t: 12.86, wide: 0.25}, {t: 38.48, wide: 0.8}, {t: 49.73, wide: 0.55}, {t: 51.0, wide: 0.55}, {t: 54.0, wide: 0.95}]},
];
export default zooms;
