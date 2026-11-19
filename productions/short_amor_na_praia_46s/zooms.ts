import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "boom", name: "Dry boom",
    about: "Keep the chopped call close. The dry double stroke opens a little space, and the rest opens through the last strokes and the silence, so the highest arc has room before the full band lands.",
    keyframes: [{t: 0.0, wide: 0.24}, {t: 3.6, wide: 0.24}, {t: 4.57, wide: 0.62}, {t: 7.2, wide: 0.62}, {t: 9.24, wide: 0.91}]},
  {id: "hey", name: "Break for the hey",
    about: "Hold the duet at middle distance; lean near while the rider runs low at the end of the band's first passage, then release with the great downbeat into the high flight and settle a little as it comes down before the last words.",
    keyframes: [{t: 0.0, wide: 0.38}, {t: 7.19, wide: 0.38}, {t: 9.3, wide: 0.72}, {t: 21.3, wide: 0.72}, {t: 25.0, wide: 0.43}, {t: 26.18, wide: 0.43}, {t: 26.84, wide: 0.82}, {t: 39.9, wide: 0.82}, {t: 42.9, wide: 0.62}]},
  {id: "exhale", name: "Held breath, long exhale",
    about: "Follows the blend's own shape: close on the tiptoe, open on the 808 strokes and widest for the arc in the silence, a little nearer for the low flat run, wide again from the last bar into the flight, easing back as it comes down.",
    keyframes: [{t: 0.0, wide: 0.26}, {t: 3.7, wide: 0.26}, {t: 4.56, wide: 0.58}, {t: 6.95, wide: 0.58}, {t: 7.86, wide: 0.86}, {t: 9.6, wide: 0.86}, {t: 12.6, wide: 0.66}, {t: 25.1, wide: 0.66}, {t: 26.84, wide: 0.92}, {t: 39.9, wide: 0.92}, {t: 42.9, wide: 0.72}]},
];
export default lanes;
