/**
 * Each sung pair flicks up and leaves the rider hanging on the long vowel. The first drum takes up that bounce,
 * with an extra lift in the missing beat before 16 seconds. The upper notes in the break gather into a quick skim.
 * On the second verse the long vowels stretch out again. This time the drum pulls everything low and fast
 * until the singer briefly gets the space back at 44.7 seconds. The last kick sends the treble clear.
 */
import base from '../spec.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from '../spec.ts';

export default {
  ...base,
  contacts: base.contacts.map(c => c.t < 6.77
    ? {...c, impact: c.impact! * (.85 + .15 * c.t / 6.77)} : c),
  axes: {
    air: curve([[0,.39],[2.161,.58],[4.45,.88],[5.388,.49],[6.28,.90],[7.234,.70],[8.418,.43],
      [10.003,.72],[14.618,.67],[15.57,.90],[16.929,.70],[22.467,.73],
      [25.20,.86],[27.772,.53],[29.618,.36],[31.697,.61],[33.99,.87],[34.93,.52],
      [35.85,.91],[36.77,.68],[37.954,.42],[39.533,.47],[43.69,.43],[44.96,.83],
      [45.536,.54],[47.382,.43],[52.699,.50],[53.39,.83],[53.773,.76]]),
    speed: curve([[0,.50],[2.161,.58],[6.28,.44],[8.418,.74],[12.308,.76],[15.57,.55],[17.852,.74],
      [22.467,.66],[25.20,.48],[29.618,.88],[31.697,.52],[35.85,.43],
      [37.954,.78],[39.533,.92],[43.69,.90],[44.96,.57],[46,.88],[51.538,.94],[53.773,.54]]),
    amplitude: curve([[0,.024],[2.161,.07],[4.007,.09],[4.45,.35],[5.388,.045],[6.28,.38],
      [7.234,.09],[8.418,.018],[10.003,.13],[14.618,.12],[15.57,.39],[16.929,.12],
      [22.467,.12],[25.20,.31],[27.772,.07],[29.618,.018],[31.697,.08],[33.99,.38],
      [34.93,.05],[35.85,.42],[36.77,.10],[37.954,.015],[43.69,.045],[44.96,.20],
      [45.536,.06],[47.382,.036],[52.699,.034],[53.15,.17],[53.773,.055]]),
  },
};
