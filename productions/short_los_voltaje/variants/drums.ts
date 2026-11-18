/** The short drum answers start beneath the calls. After the return they fall in threes between the main beats. From the bright hook onward those three places already share the hook's landings. */
import main from '../spec.ts';
export {overlayMeta} from '../spec.ts';

const answers: [number, number][] = [
  [.234,.08],[.791,.09],[1.169,.14],[1.442,.09],[2.301,.12],[2.817,.07],[3.235,.10],
  [4.367,.14],[4.930,.09],[5.302,.18],[5.569,.14],[6.434,.22],[7.003,.10],[7.891,.23],
  [8.164,.12],[8.512,.09],[9.069,.12],[10.573,.25],[11.136,.13],[12.024,.21],[12.297,.11],
  // The short first stroke leans into the beat. The next two answer across it.
  [15.275,.24],[15.658,.36],[16.180,.23], [17.341,.22],[17.725,.39],[18.247,.21],
  [19.408,.23],[19.791,.43],[20.314,.26], [21.486,.20],[21.869,.39],[22.392,.23],
];

export default {
  ...main,
  contacts: [...main.contacts, ...answers.map(([t, impact]) => ({t, impact}))]
    .sort((a, b) => a.t - b.t),
};
