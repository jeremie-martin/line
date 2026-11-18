import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: 'bass', name: "Room for the bass",
    about: "The build draws away from the singer. Its last suspended beat reveals the full width of the bass entrance.",
    keyframes: [{t: 0, wide: 0.26}, {t: 4.77, wide: 0.26}, {t: 10.78, wide: 0.59}, {t: 11.47, wide: 0.63}, {t: 12.73, wide: 0.96}, {t: 26.71, wide: 0.96}, {t: 33.09, wide: 0.45}, {t: 33.86, wide: 0.45}, {t: 34.89, wide: 0.88}]},
  {id: 'register', name: "Change of singer",
    about: "Widen with the high stab, then draw close over the low voice and let its answering drums reopen the picture.",
    keyframes: [{t: 0, wide: 0.44}, {t: 11.12, wide: 0.44}, {t: 12.27, wide: 0.71}, {t: 20.11, wide: 0.81}, {t: 25.55, wide: 0.81}, {t: 30.62, wide: 0.46}, {t: 32.52, wide: 0.46}, {t: 36.72, wide: 0.83}]},
];
export default lanes;
