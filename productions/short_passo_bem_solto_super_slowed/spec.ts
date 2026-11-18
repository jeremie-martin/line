/**
 * Let the long low vowel travel before the little climbing reply. The F-sharp high answer at six and a
 * half seconds reaches across the drum, then the insistent repeated C takes over. Land each new call and
 * the two A-sharp turns. Use the upper replies between the longer calls. The low holes between them are deliberate. At the
 * unaccompanied phrase keep the quieter restatement. The late drummer plays a displaced pickup and a
 * two-stroke answer. Allow the last syllables to interrupt him. I am least sure of the weight on the
 * high answer.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "PASSO BEM SOLTO (Super Slowed)", "audio": "productions/short_passo_bem_solto_super_slowed/audio.mp3", "beats": "productions/short_passo_bem_solto_super_slowed/audio.json", "spectrogram": {"image": "productions/short_passo_bem_solto_super_slowed/spectrogram.png", "metadata": "productions/short_passo_bem_solto_super_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "ATLXS", phases: [
  {"name": "Low vowel and climbing reply", "t0": 0, "t1": 6.45, "color": "#426582"},
  {"name": "High answer over bass", "t0": 6.45, "t1": 13.04, "color": "#a45643"},
  {"name": "Recurring C", "t0": 13.04, "t1": 28.68, "color": "#448078"},
  {"name": "Five calls", "t0": 28.68, "t1": 30.6, "color": "#826488"},
  {"name": "Pickup and drum pair", "t0": 30.6, "t1": 48.16, "color": "#426582"},
  {"name": "Last syllables on the drummer", "t0": 48.16, "t1": 49.778, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // The first attack is already under the cut. Begin on its renewal.
  [.413,.254], [.703,.353], [.941,.552], [1.585,.284], [1.806,.342], [2.038,.418], [2.34,.276],
  [2.619,.302], [2.897,.483], [3.199,.319], [3.42,.371], [3.745,.421], [4.569,.297], [4.848,.313],
  [5.08,.448], [5.393,.346],
  // High F-sharp, F and D, with the octave change on the quieter side of the drum.
  [6.531,.489], [7.019,.279], [7.576,.322], [8.133,.563], [8.714,.461], [8.969,.292],
  [9.376,.304], [9.77,.394], [10.084,.312], [10.618,.344], [10.838,.299], [11.14,.358],
  [11.396,.252], [12.243,.641], [12.766,.32],
  // C4 over spare drum punctuation. The answering A-sharp occurs twice.
  [13.033,.921], [13.602,.512], [14.693,.723], [15.32,.224], [15.796,.537], [16.493,.181],
  [16.899,.625], [17.143,.461], [17.433,.676], [17.99,.489], [19.082,.711], [19.383,.316], [19.72,.235],
  [20.185,.526], [21.287,.656], [21.81,.702], [21.949,.213], [22.379,.521], [23.47,.689], [23.76,.308],
  [24.097,.229], [24.573,.508], [25.281,.184], [25.676,.673], [25.931,.447], [26.21,.743],
  [26.767,.497], [27.87,.737], [28.091,.277],
  // Exposed call: let the two interior renewals answer the firmer pitched starts.
  [28.695,.475], [28.996,.394], [29.298,.352], [29.542,.284], [29.832,.354], [30.053,.279], [30.355,.423],
  // Word across the return. Each short drum pickup leads into a softer second stroke.
  [30.599,.984], [30.901,.298], [31.017,.391], [31.156,.361], [31.702,.572], [32.247,.679], [32.793,.657],
  [33.211,.43], [33.35,.374], [33.896,.554], [34.442,.632], [34.72,.503], [34.999,.72],
  [35.289,.292], [35.405,.422], [35.545,.373], [36.09,.597], [36.636,.834], [37.182,.717],
  [37.599,.414], [37.739,.382], [38.284,.58], [38.83,.641], [39.144,.269], [39.376,.676],
  [39.678,.282], [39.794,.421], [39.933,.379], [40.479,.598], [41.024,.684], [41.57,.651],
  [41.988,.39], [42.139,.352], [42.673,.566], [43.219,.629], [43.497,.487], [43.776,.696],
  [44.066,.288], [44.182,.404], [44.333,.355], [44.867,.498], [45.425,.901], [45.97,.714],
  [46.388,.422], [46.528,.351], [47.073,.586], [47.619,.639],
  // Final word hangs into the last drum figure. Its offbeat is still sounding at the cut.
  [47.932,.386], [48.165,.664], [48.583,.445], [48.722,.382], [49.268,.58], [49.546,.447],
];

const spec: Spec = {
  duration: 49.778, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.68], [6.45, 0.62], [13.04, 0.56], [28.68, 0.81], [30.6, 0.6], [43.776, .62], [44.867, .79], [45.425, .82], [46.388, .62], [48.16, 0.51]]),
    speed: curve([[0, 0.52], [6.45, 0.72], [13.04, 0.78], [28.68, 0.74], [30.355, 0.94], [30.6, 0.9], [43.776, .91], [45.425, .98], [47.932, .86], [48.16, 0.8]]),
  },
};
export default spec;
