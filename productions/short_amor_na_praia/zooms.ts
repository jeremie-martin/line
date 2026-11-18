import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "run", name: "Shortening breaths",
    about: "Open over the run-up and settle at a steady width until the heavier low answer begins.",
    keyframes: [{t: 0.0, wide: 0.32}, {t: 8.95, wide: 0.32}, {t: 10.78, wide: 0.56}, {t: 12.1, wide: 0.8}, {t: 29.08, wide: 0.8}, {t: 32.24, wide: 0.94}]},
  {id: "line", name: "Closing singer",
    about: "Hold nearer through the upper response, then widen with the bass and slowly return to the closing voice.",
    keyframes: [{t: 0.0, wide: 0.47}, {t: 18.71, wide: 0.57}, {t: 24.2, wide: 0.38}, {t: 30.3, wide: 0.38}, {t: 32.25, wide: 0.83}, {t: 42.81, wide: 0.83}, {t: 48.58, wide: 0.43}]},
];
export default lanes;
