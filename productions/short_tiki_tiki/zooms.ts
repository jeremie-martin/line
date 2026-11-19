import type {ZoomLane} from '../../scripts/video/zooms.ts';

const lanes: ZoomLane[] = [
  {id: 'booms', name: 'Two returns',
    about: 'Hold close under the first beats and finish opening just inside the first kick. Come in a little on the reset, then open with its climbing staircase so the tallest steps have room and the run arrives at full width.',
    keyframes: [{t: 0, wide: .15}, {t: 6, wide: .15}, {t: 7, wide: .30}, {t: 9.6, wide: .30},
      {t: 10.55, wide: .95}, {t: 23.9, wide: .95}, {t: 25.3, wide: .5}, {t: 26.1, wide: .5},
      {t: 27.95, wide: 1}, {t: 41.2, wide: 1}, {t: 43.2, wide: .45}]},
  {id: 'breath', name: 'One slow breath',
    about: 'Open through the whole first groove, draw in only briefly at the start of the reset, and widen through the run until the voice is alone again.',
    keyframes: [{t: 0, wide: .2}, {t: 24, wide: .9}, {t: 25.6, wide: .68}, {t: 41, wide: 1}, {t: 45, wide: .55}]},
];
export default lanes;
