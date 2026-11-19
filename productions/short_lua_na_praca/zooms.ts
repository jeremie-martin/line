import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "still", name: "Quiet centre",
    about: "Drift near as the second answer loses its bass and stay close over the glide through the quiet. The drums alone, which the blend starts light, take only a small step out, so the big opening belongs to the return of the bass.",
    keyframes: [{t: 0.0, wide: 0.57}, {t: 17.34, wide: 0.7}, {t: 22.58, wide: 0.25}, {t: 26.75, wide: 0.25}, {t: 27.6, wide: 0.44}, {t: 33.81, wide: 0.44}, {t: 34.72, wide: 0.89}]},
  {id: "bass", name: "Waiting for bass",
    about: "Let the bare returning drums stay at medium distance. Open fully only when the bass rejoins them.",
    keyframes: [{t: 0.0, wide: 0.48}, {t: 4.62, wide: 0.48}, {t: 5.65, wide: 0.73}, {t: 15.98, wide: 0.73}, {t: 22.23, wide: 0.42}, {t: 32.79, wide: 0.42}, {t: 34.74, wide: 0.91}]},
];
export default lanes;
