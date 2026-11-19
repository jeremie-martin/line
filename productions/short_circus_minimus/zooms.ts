import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: "syllables", name: "Into the hook",
    about: "Expand through the last hat phrase, then settle nearer over the run of sung hook syllables before the synth opens into the bass.",
    keyframes: [{t: 0.0, wide: 0.44}, {t: 14.69, wide: 0.44}, {t: 18.81, wide: 0.76}, {t: 23.89, wide: 0.76}, {t: 30.69, wide: 0.45}, {t: 31.61, wide: 0.94}]},
  {id: "hats", name: "Hats and full band",
    about: "Open with the hat entry, hold the hook at one width, and give the whole five-note synth run to the opening into the full band.",
    keyframes: [{t: 0.0, wide: 0.35}, {t: 4.69, wide: 0.35}, {t: 6.0, wide: 0.58}, {t: 18.8, wide: 0.7}, {t: 29.94, wide: 0.7}, {t: 31.61, wide: 0.9}]},
  {id: "vault", name: "The juggler's hook",
    about: "Open just before the hook, the loudest part, and hold it wide so the vault every two bars reads at one height; settle a little nearer under the voice over the full groove, and open again for the held note's slow lob.",
    keyframes: [{t: 0.0, wide: 0.4}, {t: 17.6, wide: 0.4}, {t: 18.8, wide: 0.86}, {t: 31.6, wide: 0.86}, {t: 35.0, wide: 0.64}, {t: 49.9, wide: 0.64}, {t: 50.86, wide: 0.84}]},
];
export default lanes;
