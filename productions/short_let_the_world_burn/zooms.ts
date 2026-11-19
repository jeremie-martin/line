import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "held", name: "On the held G",
    about: "Open on the approaching chorus, then draw in as the drum sentence eases into the first long G, staying near the exposed singer but leaving the slow, tall arcs their room; open a touch as the upper C climbs higher still.",
    keyframes: [{t: 0.0, wide: 0.32}, {t: 3.2, wide: 0.32}, {t: 4.59, wide: 0.88}, {t: 21.26, wide: 0.88}, {t: 27.5, wide: 0.56}, {t: 33.0, wide: 0.56}, {t: 34.1, wide: 0.68}]},
  {id: "octave", name: "The high C",
    about: "Keep the drum chorus broad and the held G at middle distance. Open slowly as the melody reaches its upper octave, where the rider's arcs are the highest of the film.",
    keyframes: [{t: 0.0, wide: 0.44}, {t: 3.65, wide: 0.44}, {t: 4.61, wide: 0.76}, {t: 22.55, wide: 0.76}, {t: 28.5, wide: 0.5}, {t: 32.9, wide: 0.5}, {t: 35.55, wide: 0.8}]},
];
export default lanes;
