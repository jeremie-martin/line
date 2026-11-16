/**
 * Luna Bala (original speed, 58 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from
 * its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: a vocal pickup (to 5.58), the body with drums and upper answers (5.584), its second phrase with syncopated bass
 * answers (19.42), a voice break with three exposed calls (35.109, 36.966, 38.812) and near silence, then the final return
 * (42.353), larger than the first, to the end.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'returns', name: "Two returns",
    about: "Opens over the last bar of the voice pickup into the drums; comes in for the voice break, and the near-silence before the final return lets it out again.",
    keyframes: [{t: 0, wide: 0.3}, {t: 4, wide: 0.3}, {t: 5.58, wide: 0.8}, {t: 35.1, wide: 0.8}, {t: 38, wide: 0.4}, {t: 40.8, wide: 0.4}, {t: 42.35, wide: 0.95}, {t: 55, wide: 0.95}]},
  {id: 'bass', name: "A step for each layer",
    about: "A step into the drums, another over the bar before the syncopated bass; in for the voice break, out for the return and slowly wider to the end.",
    keyframes: [{t: 0, wide: 0.35}, {t: 4.5, wide: 0.35}, {t: 5.58, wide: 0.6}, {t: 18, wide: 0.6}, {t: 19.42, wide: 0.8}, {t: 35.1, wide: 0.8}, {t: 39, wide: 0.5}, {t: 41, wide: 0.5}, {t: 42.35, wide: 0.9}, {t: 54, wide: 1}, {t: 55, wide: 1}]},
];
export default zooms;
