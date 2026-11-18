import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "clock", name: "The clock fills out",
    about: "Begin close enough for the faint clock. Open with its upper melody and widen again over the fill into the motor.",
    keyframes: [{t: 0.0, wide: 0.19}, {t: 4.18, wide: 0.19}, {t: 8.81, wide: 0.51}, {t: 15.52, wide: 0.51}, {t: 17.88, wide: 0.92}]},
  {id: "motor", name: "Leave room for the motor",
    about: "Keep the words and their drum replies in one near frame. Open during the final reply and hold through the dip in the bass.",
    keyframes: [{t: 0.0, wide: 0.39}, {t: 16.23, wide: 0.39}, {t: 17.88, wide: 0.85}, {t: 36.45, wide: 0.85}]},
];
export default lanes;
