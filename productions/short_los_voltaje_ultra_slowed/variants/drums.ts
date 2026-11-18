/** The small drum begins under the first word. In the broad beat the short pickup sounds close to the footfall and the longer answers have a whole space to themselves. Keep the last four words exposed. */
import main from '../spec.ts';
export {overlayMeta} from '../spec.ts';

const answers: [number, number][] = [
  [.157,.12],[.824,.11],[1.358,.10],[2.810,.12],[3.477,.08],[4.011,.14],[5.462,.23],
  [6.136,.09],[6.670,.14],[7.332,.21],[7.680,.15],[8.121,.12],[8.789,.10],[9.317,.14],
  [10.768,.25],[11.436,.14],[11.970,.12],[12.632,.25],[12.980,.15],[13.421,.10],
  // Three answers recur under each broad bar.
  [16.788,.24],[17.287,.39],[17.949,.28], [19.447,.26],[19.946,.42],[20.608,.27],
  [22.094,.26],[22.593,.44],[23.255,.25], [24.752,.24],[25.252,.43],[25.913,.26],
  [27.411,.21],[27.910,.40],[28.561,.27], [30.058,.24],[30.557,.41],[31.219,.23],
  [32.717,.23],[33.216,.40],[33.878,.24], [35.364,.13],[35.863,.27],
  [38.023,.23],[38.510,.44],[39.172,.22], [40.681,.21],[41.169,.49],[41.831,.24],
  [43.317,.26],[43.816,.43],[44.478,.24], [45.976,.23],[46.475,.52],
  [48.634,.22],[49.122,.42],[49.784,.23], [51.281,.21],[51.780,.48],[52.442,.22],
  [53.928,.24],[54.428,.42],[55.089,.25], [56.587,.23],[57.086,.47],
];

export default {
  ...main,
  // An answer within a tenth of a second of a landing of the main reading is that same stroke, heard once: the main
  // landing stands for it. The ride cannot land in its first quarter second.
  contacts: [...main.contacts, ...answers.filter(([t]) => t >= .25 && main.contacts.every(c => Math.abs(c.t - t) >= .1)).map(([t, impact]) => ({t, impact}))]
    .sort((a, b) => a.t - b.t),
};
