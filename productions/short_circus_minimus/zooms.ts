import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "syllables", name: "Into the hook",
    about: "Expand through the last hat phrase, then settle nearer over the run of sung hook syllables before the synth opens into the bass.",
    keyframes: [{t: 0.0, wide: 0.44}, {t: 14.69, wide: 0.44}, {t: 18.81, wide: 0.76}, {t: 23.89, wide: 0.76}, {t: 30.69, wide: 0.45}, {t: 31.61, wide: 0.94}]},
  {id: "hats", name: "Hats and full band",
    about: "Open with the hat entry, hold the hook at one width, and give the whole five-note synth run to the opening into the full band.",
    keyframes: [{t: 0.0, wide: 0.35}, {t: 4.69, wide: 0.35}, {t: 6.0, wide: 0.58}, {t: 18.8, wide: 0.7}, {t: 29.94, wide: 0.7}, {t: 31.61, wide: 0.9}]},
];
export default lanes;
