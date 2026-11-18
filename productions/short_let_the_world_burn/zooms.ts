import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "held", name: "On the held G",
    about: "Open on the approaching chorus, then draw close over the first long G and stay with the exposed singer.",
    keyframes: [{t: 0.0, wide: 0.32}, {t: 3.2, wide: 0.32}, {t: 4.59, wide: 0.88}, {t: 21.26, wide: 0.88}, {t: 28.75, wide: 0.36}, {t: 34.15, wide: 0.36}, {t: 39.09, wide: 0.47}]},
  {id: "octave", name: "The high C",
    about: "Keep the drum chorus broad and the lower held line at middle distance. Open slowly as the melody reaches its upper octave.",
    keyframes: [{t: 0.0, wide: 0.44}, {t: 3.65, wide: 0.44}, {t: 4.61, wide: 0.76}, {t: 22.55, wide: 0.76}, {t: 29.47, wide: 0.43}, {t: 32.9, wide: 0.43}, {t: 35.55, wide: 0.69}]},
];
export default lanes;
