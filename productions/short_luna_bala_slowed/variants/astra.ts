/**
 * The distant words gather speed from a murmur until the drum cuts them off. The bare voice keeps its delicate tread.
 * The five upper strokes travel in broad bounds, pulling close to the ground for the shortened bar around 23 seconds.
 * When the bass begins answering, the rider folds low and runs. As the bass thins, the bright notes lift the rider
 * out of that run, with the last few strokes hanging almost in place.
 */
import base from '../spec.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
export {overlayMeta} from '../spec.ts';

export default {
  ...base,
  contacts: base.contacts.map(c => c.t < 6.713 ? {...c, impact: c.impact! * .88} : c),
  axes: {
    air: curve([[0,.40],[3.73,.43],[6.71,.59],[8.217,.43],[10.295,.49],[11.323,.57],
      [12.199,.43],[14.626,.39],[15.44,.62],[17.627,.81],[21.986,.83],
      [23.078,.42],[23.89,.42],[26.346,.79],[30.705,.84],[32.348,.73],[33.985,.44],
      [40.777,.42],[43.238,.66],[47.598,.72],[48.962,.87],[50.291,.78]]),
    speed: curve([[0,.38],[2.366,.48],[6.45,.87],[7,.64],[10.295,.50],[11.323,.50],
      [12.2,.64],[14.35,.66],[15.44,.83],[19.804,.65],[21.986,.68],[23.618,.94],
      [26.346,.68],[30.705,.55],[34.519,.92],[40.777,.94],[45.421,.68],[50.291,.36]]),
    amplitude: curve([[0,.018],[6.71,.045],[10.295,.016],[10.8,.22],[11.323,.022],
      [15.44,.018],[17.627,.17],[21.986,.20],[23.078,.02],[23.89,.02],[26.346,.15],
      [30.705,.22],[32.348,.13],[33.985,.025],[41.067,.025],[45.421,.12],[48.962,.20],[50.291,.06]]),
  },
};
