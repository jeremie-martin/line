import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "naked", name: "The exposed pickup",
    about: "Come close where the backing disappears and the rider runs flat into the slam, then let the end of the quick line open onto the drum and its tall hops.",
    keyframes: [{t: 0.0, wide: 0.42}, {t: 8.69, wide: 0.42}, {t: 12.81, wide: 0.24}, {t: 14.07, wide: 0.24}, {t: 14.99, wide: 0.9}]},
  {id: "bright", name: "Treble above the beat",
    about: "Take a moderate step at the drum entrance, then open a little more on the entry of the bright replies and on two later phrase-closing drums, so the picture grows with the rider's lift phrase by phrase.",
    keyframes: [{t: 0.0, wide: 0.31}, {t: 13.35, wide: 0.31}, {t: 15.28, wide: 0.63}, {t: 22.3, wide: 0.63}, {t: 23.65, wide: 0.72}, {t: 29.3, wide: 0.72}, {t: 30.5, wide: 0.8}, {t: 37.6, wide: 0.8}, {t: 38.78, wide: 0.9}]},
];
export default lanes;
