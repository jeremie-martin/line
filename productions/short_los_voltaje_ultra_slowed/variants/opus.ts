/** Heavy, slow-motion bounces, in three waves. The rider starts close to the line, talking along with the singer in
 * small low steps, and lifts off as the words quicken, the hops growing taller to the first broad drum. From there each
 * low stroke throws it into a deep, round, unhurried arc, slower than the approved reading so the height reads. The
 * three waves of the drum climb: the first is the lowest and lightest, the one with the F loop rises higher, and the
 * heavy downbeats at the end swing tallest and fastest with their plain strokes at full weight. The singer's words
 * between the drums are low quick touches under the arcs. The four exposed syllables at the end bring the rider back
 * down onto the line, as it began.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';
import base from './approved.ts';

export {overlayMeta} from './approved.ts';

type Kind = 'talk' | 'quick' | 'drum' | 'word' | 'end';
type Strike = [time: number, impact: number];

const dialogue: Strike[] = [
  [.395,.17],[.662,.085],[1.080,.12], [1.707,.09],[2.020,.15],[2.357,.12],
  [3.042,.20],[3.309,.13],[3.738,.17],[4.110,.12], [4.354,.15],[4.667,.20],[5.016,.11],
  [5.700,.36],[6.049,.25],[6.351,.29],[6.757,.19],[7.047,.26],[7.430,.17],
  [8.371,.38],[8.615,.23],[9.044,.30],[9.416,.20],
  [9.671,.21],[9.985,.32],[10.321,.28],[10.658,.16],[10.995,.40],
];
const exposedVoice: Strike[] = [
  [11.331,.527],[11.691,.381],[12.051,.445],[12.330,.516],[12.550,.393],[13.061,.342],
  [13.653,.466],[13.920,.303],[14.129,.341],[14.350,.392],[14.571,.373],[14.803,.349],
  [15.035,.384],[15.267,.407],[15.476,.286],[15.720,.419],[15.929,.359],
];
const lowBeat: Strike[] = [
  [16.289,.972],[16.962,.516],[17.624,.601],[18.286,.633],[18.947,.86],
  [19.621,.533],[20.271,.616],[20.933,.627],[21.269,.748],[21.595,.82],
  [22.268,.509],[22.930,.604],[23.591,.616],[24.253,.842],[24.915,.741],
  [25.577,.95],[26.239,.813],[26.900,.846],
  [27.574,.573],[28.235,.611],[28.897,.639],[29.559,.811],[30.221,.552],[30.883,.591],
  [31.544,.623],[31.869,.78],[32.206,.786],[32.879,.566],[33.541,.647],[34.203,.624],
  [34.865,.834],[35.527,.755],[36.188,.93],[36.850,.858],
  [37.512,.872],[38.185,.548],[38.847,.611],[39.509,.624],[40.159,.809],[40.832,.556],
  [41.494,.588],[42.156,.619],[42.493,.80],[42.818,.805],[43.491,.522],[44.153,.615],
  [44.815,.602],[45.476,.798],[46.138,.758],[46.800,.89],[47.462,.805],[48.123,.847],
  [48.797,.537],[49.447,.566],[50.120,.629],[50.782,.819],[51.444,.837],[52.106,.572],
  [52.767,.592],[53.092,.741],[53.429,.786],[54.102,.534],[54.764,.611],[55.426,.625],
  [56.076,.828],[56.750,.766],[57.411,.88],[58.073,.792],
];
const refrain: Strike[] = [
  [27.028,.422],[29.176,.389],[29.907,.427],[31.045,.339],[32.322,.496],[36.478,.321],[37.140,.451],
  [40.403,.437],[41.982,.419],[45.709,.401],[47.090,.342],[47.752,.413],
  [50.387,.429],[52.280,.358],[56.320,.412],[57.702,.457],
];
const ending: Strike[] = [[58.363,.408],[58.781,.447],[59.025,.343],[59.455,.385]];

const SECOND_WAVE = 27.3, THIRD_WAVE = 37.4;
/** The plain drum strokes (below .7) grow wave by wave; the accented ones keep their weight and their order. */
const drumWeight = (t: number, impact: number): number => {
  if (impact >= .7) return impact;
  return Number((impact * (t < SECOND_WAVE ? .86 : t < THIRD_WAVE ? .94 : 1)).toFixed(3));
};

const all: Array<[number, number, Kind]> = [
  ...dialogue.map(([t, i]): [number, number, Kind] => [t, i, 'talk']),
  ...exposedVoice.map(([t, i]): [number, number, Kind] => [t, i, 'quick']),
  ...lowBeat.map(([t, i]): [number, number, Kind] => [t, drumWeight(t, i), 'drum']),
  // The words between the drums are quick low touches, a little lighter than before.
  ...refrain.map(([t, i]): [number, number, Kind] => [t, Number((i * .85).toFixed(3)), 'word']),
  ...ending.map(([t, i]): [number, number, Kind] => [t, i, 'end']),
].sort((a, b) => a[0] - b[0]);

/** Arc height over the span ending at `next` (0 = along the line, 1 = 60 px above it). */
function arcHeight(prev: [number, number, Kind] | undefined, next: [number, number, Kind]): number {
  const t = next[0];
  if (next[2] === 'talk') return .02;                               // close to the line
  if (next[2] === 'quick') return .02 + .16 * (t - 11.3) / 4.7;      // lift-off as the words quicken
  if (next[2] === 'end') return .02;                                // settle back down
  if (next[2] === 'word') return .03;                               // a low touch under the arc
  const wave = t < SECOND_WAVE ? .20 : t < THIRD_WAVE ? .26 : .32;
  return prev?.[2] === 'drum' ? wave : wave * .5;                   // full arc drum to drum, half after a word
}

const amplitude = (t: number): number => {
  const i = all.findIndex(([ct]) => ct >= t);
  const k = i < 0 ? all.length - 1 : i;
  return arcHeight(all[k - 1], all[k]);
};

const spec: Spec = {
  ...base,
  contacts: all.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([
      [0,.40],[5.016,.38],[5.700,.36],[10.995,.32],[11.331,.32],[13.653,.46],[15.929,.62],[16.289,.80],
      [26.239,.78],[26.900,.60],[27.237,.76],[37.2,.80],[37.512,.86],[58.073,.86],[58.363,.42],[60,.34],
    ]),
    speed: curve([
      [0,.30],[5.016,.32],[5.700,.42],[10.995,.52],[11.331,.56],[15.929,.84],[16.289,.86],
      [26.239,.80],[26.900,.70],[27.237,.86],[37.2,.88],[37.512,.94],[58.073,.96],[58.363,.50],[60,.40],
    ]),
    amplitude,
  },
};
export default spec;
