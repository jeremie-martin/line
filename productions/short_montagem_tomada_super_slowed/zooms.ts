import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "upper", name: "Between the calls",
    about: "Let the isolated upper answer open a small space, then come back to the singer before the bass swells.",
    keyframes: [{t: 0.0, wide: 0.28}, {t: 5.17, wide: 0.28}, {t: 6.85, wide: 0.56}, {t: 8.7, wide: 0.56}, {t: 12.71, wide: 0.34}, {t: 18.25, wide: 0.34}, {t: 20.2, wide: 0.86}]},
  {id: "low", name: "Under the slow voice",
    about: "Hold the exposed line close, opening gradually with the low entries and holding through the gap in the drums.",
    keyframes: [{t: 0.0, wide: 0.38}, {t: 9.96, wide: 0.38}, {t: 17.63, wide: 0.66}, {t: 19.48, wide: 0.72}, {t: 20.25, wide: 0.91}]},
];
export default lanes;
