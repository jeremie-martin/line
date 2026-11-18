import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "boom", name: "Dry boom",
    about: "Keep the chopped call close. The first low boom opens a little space and the full band opens the rest.",
    keyframes: [{t: 0.0, wide: 0.24}, {t: 3.6, wide: 0.24}, {t: 4.57, wide: 0.62}, {t: 8.04, wide: 0.62}, {t: 9.24, wide: 0.91}]},
  {id: "hey", name: "Break for the hey",
    about: "Hold the duet at middle distance until the isolated hey. Lean near over the preceding bars and release with the returning low note.",
    keyframes: [{t: 0.0, wide: 0.38}, {t: 7.19, wide: 0.38}, {t: 9.3, wide: 0.72}, {t: 22.33, wide: 0.72}, {t: 26.18, wide: 0.43}, {t: 26.84, wide: 0.82}]},
];
export default lanes;
