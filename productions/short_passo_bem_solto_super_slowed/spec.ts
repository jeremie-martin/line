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
  // The opening the owner mapped by hand on the slowed entry, carried here onto this cut's own notes: the voice
  // syllable by syllable, the low strokes under it, and the three strong strokes (drum and bass together) at 6.45,
  // 8.37 and 10.84 (with the answer at 8.64).
  [.273,.364], [.552,.245], [.691,.309], [.941,.455], [1.231,.348], [1.504,.324], [1.789,.272], [2.061,.382],
  [2.317,.328], [2.474,.407], [2.619,.298], [2.88,.416], [3.176,.306], [3.426,.338], [3.71,.361], [4.256,.405],
  [4.662,.329], [4.836,.28], [5.074,.382], [5.37,.255], [5.91,.571],
  [6.45,.66], [6.868,.573], [7.28,.606], [7.553,.377], [7.826,.559], [8.104,.554], [8.371,.965],
  [8.644,.788], [9.062,.512], [9.463,.438], [9.759,.337], [10.026,.414], [10.293,.283], [10.6,.307],
  [10.838,.88], [11.123,.302], [11.245,.251], [11.413,.329], [11.657,.287], [12.22,.651], [12.481,.383], [12.748,.13],
  // C4 over spare drum punctuation. The answering A-sharp occurs twice.
  [13.033,.921], [13.602,.512], [13.869,.17], [14.136,.5], [14.693,.723], [14.954,.22], [15.233,.68], [15.796,.537], [16.057,.19], [16.33,.5], [16.493,.181],
  [16.899,.625], [17.143,.461], [17.433,.676], [17.99,.489], [18.257,.17], [18.524,.5], [19.082,.711], [19.383,.316], [19.621,.68],
  [20.185,.526], [20.452,.18], [20.724,.5], [21.287,.656], [21.543,.18], [21.81,.702], [21.949,.213], [22.379,.521], [22.640,.16], [22.919,.5], [23.47,.689], [23.76,.308],
  [24.016,.68], [24.573,.508], [24.834,.20], [25.113,.5], [25.281,.184], [25.676,.673], [25.931,.447], [26.21,.743],
  [26.767,.497], [27.034,.19], [27.307,.5], [27.87,.737], [28.091,.277],
  // Exposed call: let the two interior renewals answer the firmer pitched starts.
  [28.695,.25], [28.996,.16], [29.298,.12], [29.542,.07], [29.832,.14], [30.053,.08], [30.355,.23],
  // Word across the return. Each short drum pickup leads into a softer second stroke.
  [30.599,.984], [30.901,.298], [31.017,.391], [31.156,.361], [31.702,.572], [32.247,.679], [32.793,.657],
  [33.211,.43], [33.35,.374], [33.896,.554], [34.442,.632], [34.72,.503], [34.999,.72],
  [35.289,.292], [35.405,.422], [35.545,.373], [36.09,.597], [36.636,.834], [37.182,.717],
  [37.599,.414], [37.739,.382], [38.284,.58], [38.83,.641], [39.144,.269], [39.376,.676],
  [39.678,.282], [39.794,.421], [39.933,.379], [40.479,.598], [41.024,.684], [41.57,.651],
  [41.988,.39], [42.139,.352], [42.673,.566], [43.219,.629], [43.497,.487], [43.776,.696],
  [44.066,.288], [44.182,.404], [44.333,.355], [44.867,.56], [45.425,.862], [45.97,.714],
  [46.388,.422], [46.528,.351], [47.073,.586], [47.619,.639],
  // Final word hangs into the last drum figure. Its offbeat is still sounding at the cut.
  [47.932,.386], [48.165,.664], [48.583,.445], [48.722,.382], [49.268,.58], [49.546,.447],
];

const spec: Spec = {
  duration: 49.778, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.68], [6.45, 0.62], [13.04, 0.56], [28.68, 0.81], [30.6, 0.6], [48.16, 0.51]]),
    speed: curve([[0, 0.52], [6.45, 0.72], [13.04, 0.78], [28.68, 0.74], [30.355, 0.94], [30.6, 0.9], [48.16, .73]]),
  },
};
export default spec;
