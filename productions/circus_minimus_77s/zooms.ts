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
  {id: 'arc', name: "One long opening",
    about: "One slow opening from the verse to the hook; the picture comes back in before the break and opens across it, so the full groove arrives wide.",
    keyframes: [{t: 0, wide: 0.25}, {t: 12, wide: 0.25}, {t: 38.48, wide: 0.8}, {t: 47.5, wide: 0.8}, {t: 49.73, wide: 0.55}, {t: 51.28, wide: 0.95}, {t: 74, wide: 0.95}]},
  {id: 'fills', name: "Opens as the band fills",
    about: "A step wider for each layer that joins, each taken over the bar that leads into it: the verse, the hats, the voice; in for the break, and out across it to the full groove.",
    keyframes: [{t: 0, wide: 0.3}, {t: 11.4, wide: 0.3}, {t: 12.86, wide: 0.42}, {t: 24.2, wide: 0.42}, {t: 25.68, wide: 0.6}, {t: 37, wide: 0.6}, {t: 38.48, wide: 0.75}, {t: 48.6, wide: 0.75}, {t: 49.73, wide: 0.5}, {t: 49.9, wide: 0.5}, {t: 51.28, wide: 1}, {t: 74, wide: 1}]},
];
export default zooms;
