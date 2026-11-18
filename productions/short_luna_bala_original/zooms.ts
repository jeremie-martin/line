import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "bare", name: "The uncovered ending",
    about: "Go wide on the first percussion phrase and narrow gradually as the low answers shorten into exposed drums.",
    keyframes: [{t: 0.0, wide: 0.34}, {t: 2.76, wide: 0.34}, {t: 3.8, wide: 0.84}, {t: 27.46, wide: 0.84}, {t: 32.3, wide: 0.53}, {t: 35.54, wide: 0.27}]},
  {id: "low", name: "Transfer to bass",
    about: "Stay at middle distance through the drums and broaden with the bass sentences before easing near the singer.",
    keyframes: [{t: 0.0, wide: 0.46}, {t: 15.92, wide: 0.46}, {t: 19.62, wide: 0.77}, {t: 29.54, wide: 0.77}, {t: 35.07, wide: 0.39}]},
];
export default lanes;
