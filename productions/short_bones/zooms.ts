import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "crash", name: "Out of the bridge",
    about: "Stay close to the lower words. Open with the tightening pickup and arrive wide on the chorus crash.",
    keyframes: [{t: 0.0, wide: 0.22}, {t: 9.71, wide: 0.22}, {t: 11.94, wide: 0.44}, {t: 13.42, wide: 0.94}]},
  {id: "register", name: "The second voice phrase",
    about: "Give the first chorus a sustained middle distance and drift closer for the low held line before its last fill.",
    keyframes: [{t: 0.0, wide: 0.34}, {t: 12.22, wide: 0.34}, {t: 13.43, wide: 0.74}, {t: 26.72, wide: 0.74}, {t: 32.24, wide: 0.49}, {t: 38.56, wide: 0.49}, {t: 44.35, wide: 0.82}]},
];
export default lanes;
