import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: 'booms', name: 'Two returns',
    about: 'Hold close under the first beats and finish opening just inside the first kick. Come in on the reset and open again on the return.',
    keyframes: [{t: 0, wide: .15}, {t: 6, wide: .15}, {t: 7, wide: .30}, {t: 9.6, wide: .30},
      {t: 10.55, wide: .95}, {t: 23.9, wide: .95}, {t: 25.3, wide: .4}, {t: 27, wide: .4},
      {t: 27.95, wide: 1}, {t: 41.2, wide: 1}, {t: 43.2, wide: .45}]},
  {id: 'breath', name: 'One slow breath',
    about: 'Open through the whole first groove, draw in over the boom, and widen through the run until the voice is alone again.',
    keyframes: [{t: 0, wide: .2}, {t: 24, wide: .9}, {t: 26.5, wide: .6}, {t: 41, wide: 1}, {t: 45, wide: .55}]},
];
export default lanes;
