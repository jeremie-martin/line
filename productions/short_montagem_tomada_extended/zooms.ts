import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "vowels", name: "Held vowels",
    about: "Stay near the short vowels and open across the final held word before each drum entrance. The break is reached before it starts and kept a little wider than before, so the blend's slow high float over the upper figure has room.",
    keyframes: [{t: 0.0, wide: 0.27}, {t: 5.85, wide: 0.27}, {t: 8.73, wide: 0.77}, {t: 20.5, wide: 0.77}, {t: 23.3, wide: 0.5}, {t: 35.39, wide: 0.5}, {t: 38.26, wide: 0.96}]},
  {id: "upper", name: "The uncovered figure",
    about: "Keep the first drums at middle distance. Draw in before the bright offbeats continue alone, not so close that the blend's high float is cramped, then open across the second verse, whose hangs are higher, as the lower part rebuilds.",
    keyframes: [{t: 0.0, wide: 0.54}, {t: 19.6, wide: 0.54}, {t: 23.3, wide: 0.38}, {t: 30.54, wide: 0.38}, {t: 36.77, wide: 0.66}, {t: 38.32, wide: 0.84}]},
];
export default lanes;
