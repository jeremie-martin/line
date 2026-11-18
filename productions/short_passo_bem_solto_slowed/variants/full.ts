/**
 * Start inside the sentence. The little voice attacks at .31, .70 and .93 give the word its shape. Let a
 * held vowel carry the quieter counts. In the second sentence the low pair at 7.94 and 8.20 interrupts
 * the voice. The centre has two short vocal bursts on alternate drum strokes. Ride the two attacks as a
 * pair, letting the drum answer after every second burst. Follow the exposed link right across the low onset at 28.921 and into the returning
 * drum. A last little succession of words around 45 s precedes the upper replies. Their exact consonants
 * are uncertain.
 
 * The fuller reading, as the music has it. On 18 November 2026 its seed-101 ride did not complete (or was judged
 * invalid), so the last version that rides stays the spec (spec.ts) and this one waits for the compiler. */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';

const music = {"title": "PASSO BEM SOLTO (Slowed)", "audio": "productions/short_passo_bem_solto_slowed/audio.mp3", "beats": "productions/short_passo_bem_solto_slowed/audio.json", "spectrogram": {"image": "productions/short_passo_bem_solto_slowed/spectrogram.png", "metadata": "productions/short_passo_bem_solto_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "ATLXS", phases: [
  {"name": "Middle of the sentence", "t0": 0, "t1": 6.12, "color": "#426582"},
  {"name": "Low punctuation in the reply", "t0": 6.12, "t1": 12.34, "color": "#a45643"},
  {"name": "Two syllables across each measure", "t0": 12.34, "t1": 26.85, "color": "#448078"},
  {"name": "Exposed link", "t0": 26.85, "t1": 29.32, "color": "#826488"},
  {"name": "Broken drums", "t0": 29.32, "t1": 44.47, "color": "#426582"},
  {"name": "Last word and upper reply", "t0": 44.47, "t1": 47.029, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // The cut opens on a sounding word. Its answer crosses the vocals and other stems.
  [.128,.31], [.308,.364], [.564,.245], [.697,.309], [.929,.455], [1.214,.348], [1.463,.324], [1.725,.272],
  [1.98,.382], [2.224,.328], [2.386,.407], [2.52,.298], [2.758,.416], [3.054,.306], [3.269,.338],
  [3.53,.361], [4.052,.405], [4.348,.12], [4.435,.329], [4.621,.28], [4.824,.382], [5.12,.255], [5.625,.571],
  // The second sentence opens out, then two low drum strokes cut across the words.
  [6.136,.488], [6.531,.573], [6.914,.606], [7.187,.377], [7.437,.559], [7.692,.554],
  [7.942,.965], [8.197,.788], [8.598,.512], [8.969,.438], [9.254,.337], [9.503,.414],
  [9.759,.283], [10.043,.307], [10.275,.359], [10.542,.302], [10.653,.251], [10.821,.329],
  [11.065,.287], [11.576,.651], [11.825,.383], [12.075,.13],
  // The alternating strong syllable and lighter answer, with the bar drum between bursts.
  [12.342,.936], [12.864,.463], [13.126,.275], [13.903,.682], [14.159,.289], [14.414,.628],
  [14.942,.487], [15.198,.263], [15.982,.624], [16.121,.235], [16.231,.49], [16.382,.193], [16.487,.578],
  [17.003,.476], [17.27,.306], [18.054,.659], [18.309,.281], [18.559,.606],
  [19.081,.459], [19.348,.256], [20.121,.638], [20.376,.285], [20.631,.627],
  [21.154,.471], [21.409,.294], [22.187,.653], [22.443,.278], [22.704,.695],
  [23.22,.498], [23.482,.302], [24.265,.672], [24.37,.243], [24.521,.48], [24.579,.204], [24.776,.583],
  [25.293,.469], [25.554,.315], [26.332,.69], [26.593,.277],
  // Separate the actual renewed vowels; let the little shoulders carry into the next word.
  [27.063,.27], [27.394,.16], [27.679,.10], [27.911,.21], [28.184,.07], [28.398,.13],
  [28.683,.22], [28.921,.932], [29.182,.265],
  // Drum answers with a light pickup, two close notes, and a heavier bar head.
  [29.316,.492], [29.705,.374], [29.96,.578], [30.227,.421], [30.477,.682], [30.993,.758],
  [31.394,.338], [31.516,.299], [31.783,.407], [32.032,.543], [32.299,.438], [32.549,.641], [32.81,.472], [33.066,.687],
  [33.46,.351], [33.582,.274], [33.849,.376], [34.105,.565], [34.372,.431], [34.621,.71], [35.138,.847],
  [35.533,.351], [35.66,.293], [35.922,.389], [36.177,.542], [36.444,.426], [36.694,.673], [37.21,.74],
  [37.605,.409], [37.733,.286], [37.994,.372], [38.249,.55], [38.517,.432], [38.766,.706], [39.283,.79],
  [39.678,.364], [39.805,.306], [40.066,.393], [40.322,.554], [40.589,.42], [40.839,.635], [41.1,.482], [41.355,.67],
  [41.75,.369], [41.872,.318], [42.139,.372], [42.394,.562], [42.661,.441], [42.911,.699], [43.428,.776],
  [43.822,.378], [43.95,.314], [44.211,.388], [44.467,.549], [44.734,.414],
  // Three clear words, a little pickup, then the upper reply after the singer releases.
  [45.018,.439], [45.279,.348], [45.535,.314], [45.767,.277], [45.895,.417], [46.284,.383], [46.852,.155],
];

const spec: Spec = {
  duration: 47.029, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.47], [6.12, 0.64], [12.34, 0.54], [26.85, 0.72], [29.32, 0.56], [44.47, 0.53]]),
    speed: curve([[0, 0.66], [6.12, 0.73], [12.34, 0.84], [26.85, 0.83], [29.32, 0.89], [44.47, 0.77]]),
  },
};
export default spec;
