import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "run", name: "Shortening breaths",
    about: "Open over the run-up and settle at a steady width; the last widening now arrives on the big stroke at 31.5, where the hook and the first bass answer break as one wave and the rider starts to hang back.",
    keyframes: [{t: 0.0, wide: 0.32}, {t: 8.95, wide: 0.32}, {t: 10.78, wide: 0.56}, {t: 12.1, wide: 0.8}, {t: 29.6, wide: 0.8}, {t: 31.62, wide: 0.94}]},
  {id: "line", name: "Closing singer",
    about: "Hold nearer through the upper response, then widen into the breaking wave at 31.5 so the slow, tall steps over the bass have room, and slowly return to the closing voice.",
    keyframes: [{t: 0.0, wide: 0.47}, {t: 18.71, wide: 0.57}, {t: 24.2, wide: 0.38}, {t: 29.7, wide: 0.38}, {t: 31.62, wide: 0.83}, {t: 42.81, wide: 0.83}, {t: 48.58, wide: 0.43}]},
];
export default lanes;
