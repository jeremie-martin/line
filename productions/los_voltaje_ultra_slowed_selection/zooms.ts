/**
 * Los Voltaje (ultra slowed, 60 s selection): zoom lanes. Each follows one thing in the music; a ride is given one of them from
 * its id. A lane is keyframes {t, wide}: song seconds, and how wide the picture is from 0 (closest) to 1 (widest), on the scale
 * every song shares (scripts/video/zoom.js). Nothing is written for the last three seconds: there the picture pulls back to the
 * whole course. Times are the song's (composition.json).
 *
 * The song: no groove tail in this cut; the voice over soft drums from the start, a phrase (5.68) that quickens (11.32) over a
 * gap in the drums, then the broad return (16.289) to the end, where a short three-stroke answer comes every 10.6 s (20.93,
 * 31.54, 42.16, 52.77) and a synth joins from about 27.4.
 */
import type {ZoomLane} from '../../scripts/video/zooms.ts';
const zooms: ZoomLane[] = [
  {id: 'quickening', name: "Opens through the quickening",
    about: "Close while the voice is in space; the quickening carries the picture out, and the broad return arrives wide.",
    keyframes: [{t: 0, wide: 0.3}, {t: 11.32, wide: 0.3}, {t: 16.29, wide: 0.85}, {t: 57, wide: 0.85}]},
  {id: 'long', name: "One long opening",
    about: "No sudden change: slowly wider from the first phrase to the broad return, and a step more over the bar before the last wave.",
    keyframes: [{t: 0, wide: 0.25}, {t: 5.68, wide: 0.3}, {t: 16.29, wide: 0.7}, {t: 36.15, wide: 0.7}, {t: 37.66, wide: 0.9}, {t: 57, wide: 0.9}]},
];
export default zooms;
