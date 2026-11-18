import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "naked", name: "The exposed pickup",
    about: "Come close where the backing disappears, then let the end of the quick line open onto the drum.",
    keyframes: [{t: 0.0, wide: 0.42}, {t: 8.69, wide: 0.42}, {t: 12.81, wide: 0.24}, {t: 14.07, wide: 0.24}, {t: 14.99, wide: 0.9}]},
  {id: "bright", name: "Treble above the beat",
    about: "Take a moderate step at the drum entrance and open further as the brighter replies accumulate over the second wave.",
    keyframes: [{t: 0.0, wide: 0.31}, {t: 13.35, wide: 0.31}, {t: 15.28, wide: 0.63}, {t: 22.12, wide: 0.63}, {t: 27.69, wide: 0.79}, {t: 32.46, wide: 0.88}]},
];
export default lanes;
