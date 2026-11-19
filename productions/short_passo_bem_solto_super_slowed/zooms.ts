import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "register", name: "Rising answer",
    about: "Widen before the high reply so the first big rise has room. Settle a little nearer on the recurring C, not so near that its returning arcs feel cramped, and open across the five calls into the late drums.",
    keyframes: [{t: 0.0, wide: 0.29}, {t: 4.6, wide: 0.29}, {t: 6.55, wide: 0.61}, {t: 13.04, wide: 0.61}, {t: 17.98, wide: 0.47}, {t: 28.13, wide: 0.47}, {t: 30.72, wide: 0.84}]},
  {id: "pickups", name: "Wait for percussion",
    about: "Stay still across the recurring vocal, draw close on the bare calls, then open quickly over the last pickups so the full width lands just inside the return.",
    keyframes: [{t: 0.0, wide: 0.48}, {t: 25.67, wide: 0.48}, {t: 28.7, wide: 0.32}, {t: 29.83, wide: 0.32}, {t: 30.7, wide: 0.82}]},
];
export default lanes;
