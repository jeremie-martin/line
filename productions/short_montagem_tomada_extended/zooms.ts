import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "vowels", name: "Held vowels",
    about: "Stay near the short vowels and open across the final held word before each drum entrance.",
    keyframes: [{t: 0.0, wide: 0.27}, {t: 5.85, wide: 0.27}, {t: 8.73, wide: 0.77}, {t: 21.54, wide: 0.77}, {t: 27.77, wide: 0.42}, {t: 35.39, wide: 0.42}, {t: 38.26, wide: 0.96}]},
  {id: "upper", name: "The uncovered figure",
    about: "Keep the first drums at middle distance. Draw close as the bright offbeats continue alone, then open when the lower part rebuilds.",
    keyframes: [{t: 0.0, wide: 0.54}, {t: 18.19, wide: 0.54}, {t: 24.31, wide: 0.32}, {t: 30.54, wide: 0.32}, {t: 36.77, wide: 0.66}, {t: 38.32, wide: 0.84}]},
];
export default lanes;
