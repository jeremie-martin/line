/** The singer opens in threes, then stretches a fourth syllable over the response.
 * A five-stroke drum answer leads to the exposed quick words. The broad return
 * at 16.289 keeps its two-thirds-second pulse through both later waves. The F
 * answers it in the gaps. Let near-coincident words ride the drum. Leave the
 * middle instrument and bass recoveries airborne. Carry the last soft vowel into the return. At 51.444 the drum carries
 * the rising shoulder after it. How much weight that composite deserves is
 * uncertain. The four exposed notes at the end belong to the singer.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LOS VOLTAJE (Ultra Slowed)", "audio": "productions/short_los_voltaje_ultra_slowed/audio.mp3", "beats": "productions/short_los_voltaje_ultra_slowed/audio.json", "spectrogram": {"image": "productions/short_los_voltaje_ultra_slowed/spectrogram.png", "metadata": "productions/short_los_voltaje_ultra_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Sayfalse, Yb Wasg'ood & Ariis", phases: [
  {"name": "Soft calls", "t0": 0, "t1": 5.69, "color": "#426582"},
  {"name": "Longer sentence", "t0": 5.69, "t1": 11.331, "color": "#a45643"},
  {"name": "Exposed quickening", "t0": 11.331, "t1": 16.29, "color": "#448078"},
  {"name": "Broad drum and short answers", "t0": 16.29, "t1": 27.028, "color": "#826488"},
  {"name": "F against low drum", "t0": 27.028, "t1": 37.51, "color": "#426582"},
  {"name": "Heavy downbeats and words", "t0": 37.51, "t1": 58.363, "color": "#a45643"},
  {"name": "Four exposed syllables", "t0": 58.363, "t1": 60.0, "color": "#448078"},
]};

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
  [16.289,.972],[16.962,.516],[17.624,.601],[18.286,.633],[18.947,.826],
  [19.621,.533],[20.271,.616],[20.933,.627],[21.269,.748],[21.595,.787],
  [22.268,.509],[22.930,.604],[23.591,.616],[24.253,.842],[24.915,.741],
  [25.577,.921],[26.239,.813],[26.900,.846],
  // The F at 27.028 leaves the next low sentence intact.
  [27.574,.573],[28.235,.611],[28.897,.639],[29.559,.811],[30.221,.552],[30.883,.591],
  [31.544,.623],[31.869,.738],[32.206,.786],[32.879,.566],[33.541,.647],[34.203,.624],
  [34.865,.834],[35.527,.755],[36.188,.901],[36.850,.858],
  // Keep the low strokes through the break in the vocal answers.
  [37.512,.872],[38.185,.548],[38.847,.611],[39.509,.624],[40.159,.809],[40.832,.556],
  [41.494,.588],[42.156,.619],[42.493,.764],[42.818,.805],[43.491,.522],[44.153,.615],
  [44.815,.602],[45.476,.798],[46.138,.758],[46.800,.863],[47.462,.805],[48.123,.847],
  [48.797,.537],[49.447,.566],[50.120,.629],[50.782,.819],[51.444,.837],[52.106,.572],
  [52.767,.592],[53.092,.741],[53.429,.786],[54.102,.534],[54.764,.611],[55.426,.625],
  [56.076,.828],[56.750,.766],[57.411,.845],[58.073,.792],
];
const refrain: Strike[] = [
  [27.028,.422],[29.176,.389],[29.907,.427],[31.045,.339],[32.322,.496],[36.478,.321],[37.140,.451],
  [40.403,.437],[41.982,.419],[45.709,.401],[47.090,.342],[47.752,.413],
  [50.387,.429],[52.280,.358],[56.320,.412],[57.702,.457],
];
const ending: Strike[] = [[58.363,.408],[58.781,.447],[59.025,.343],[59.455,.385]];

const spec: Spec = {
  duration: 60, preroll: 2, music,
  contacts: [...dialogue, ...exposedVoice, ...lowBeat, ...refrain, ...ending]
    .sort(([a], [b]) => a - b).map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.58],[1.080,.58],[1.707,.66],[2.357,.66],[3.042,.46],[4.110,.46],[4.354,.52],[5.016,.52],[5.700,.44],[9.416,.44],[9.671,.36],[10.995,.36],[11.331,.30],[15.720,.30],[15.929,.47],[16.126,.65],[16.289,.84],[26.239,.84],[26.900,.52],[27.237,.70],[31.869,.62],[32.543,.74],[37.512,.80],[42.156,.80],[42.818,.74],[48.797,.78],[50.782,.82],[51.444,.73],[53.092,.76],[54.102,.80],[58.073,.80],[58.363,.50],[59.455,.42]]),
    speed: curve([[0,.34],[5.016,.34],[5.700,.48],[9.416,.48],[9.671,.56],[10.995,.56],[11.331,.72],[13.653,.90],[15.035,1],[15.720,1],[16.289,.98],[26.239,.98],[26.900,.76],[27.237,.94],[37.512,.98],[58.073,.98],[58.363,.56],[59.455,.48]]),
  },
};
export default spec;
