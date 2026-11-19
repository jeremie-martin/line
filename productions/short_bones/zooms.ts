import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "crash", name: "Out of the bridge",
    about: "Stay close to the creeping bridge, give the held vowel's lift and the slow bass arcs a little room, then open with the taut pickup and arrive wide on the chorus crash.",
    keyframes: [{t: 0.0, wide: 0.22}, {t: 3.3, wide: 0.22}, {t: 4.2, wide: 0.34}, {t: 10.6, wide: 0.34}, {t: 11.94, wide: 0.46}, {t: 13.42, wide: 0.94}]},
  {id: "takeoff", name: "Second sentence takes off",
    about: "Follows the blend's wider arc: middle distance on the grounded first drum sentence, wide when the second sentence takes off and through the float over the held notes, nearer as the last line comes back to the ground, and the final fill opens it once more.",
    keyframes: [{t: 0.0, wide: 0.34}, {t: 12.22, wide: 0.34}, {t: 13.43, wide: 0.62}, {t: 20.8, wide: 0.62}, {t: 21.82, wide: 0.86}, {t: 36.6, wide: 0.86}, {t: 39.2, wide: 0.6}, {t: 43.6, wide: 0.6}, {t: 44.95, wide: 0.8}]},
];
export default lanes;
