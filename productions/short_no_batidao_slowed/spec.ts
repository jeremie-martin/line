/**
 * Bare drums with quiet words in the spaces. The bright upper signal at 4.79
 * stands alone before the first bass catch. From there the low pulse carries
 * a whole beat on each landing; the swell after the kick stays in the arc.
 * One small pickup at 13.939 interrupts it. At 22.565 the low D/F/G voice
 * becomes the moving line over sparse drums. It keeps answering when the full
 * beat returns. The 31.168 vowel carries into the return. The last four strokes are the roll itself. Listen for whether
 * the small syllable before 38.087 reads inside its drum catch.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "NO BATIDÃO (Slowed)", "audio": "productions/short_no_batidao_slowed/audio.mp3", "beats": "productions/short_no_batidao_slowed/audio.json", "spectrogram": {"image": "productions/short_no_batidao_slowed/spectrogram.png", "metadata": "productions/short_no_batidao_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "ZXKAI & slxughter", phases: [
  {"name": "Bare drummer and words", "t0": 0, "t1": 4.78, "color": "#426582"},
  {"name": "Bright signal and low pulse", "t0": 4.78, "t1": 22.55, "color": "#a45643"},
  {"name": "Lower singer", "t0": 22.55, "t1": 31.43, "color": "#448078"},
  {"name": "Lower voice over returning drums", "t0": 31.43, "t1": 39.75, "color": "#826488"},
  {"name": "Roll into the cut", "t0": 39.75, "t1": 40.783, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // Start inside the preceding word. Weight the little 3.687 reply where
  // the vocal rise is sharpest, keeping the shorter drum intervals audible.
  [.343,.764],[.657,.10],[.889,.784],[1.446,.791],[1.783,.09],[2.004,.752],[2.317,.16],
  [2.561,.713],[2.712,.10],[3.118,.809],[3.269,.11],[3.536,.747],[3.687,.24],
  [3.954,.732],[4.268,.09],[4.79,.716],
  // Held low recovery on every beat. The raised attack at 14.217 is real
  // (5.9 mix rise) and has one little measured drum stroke leading into it.
  [5.336,.934],[5.893,.756],[6.45,.654],[7.008,.763],[7.553,.795],[8.11,.721],[8.668,.641],
  [9.225,.715],[9.782,.748],[10.328,.754],[10.885,.619],[11.443,.683],[12,.779],[12.557,.651],
  [13.114,.712],[13.672,.767],[13.939,.343],[14.217,.919],[14.775,.738],[15.332,.608],
  [15.889,.751],[16.435,.792],[16.992,.703],[17.549,.626],[18.107,.743],[18.664,.751],
  [19.21,.741],[19.767,.672],[20.324,.694],[20.881,.781],[21.439,.687],[21.996,.704],
  // The exposed low singer turns on F and G. Leave the repeating upper
  // figure underneath; the isolated low drums are still whole notes here.
  [22.565,.536],[22.82,.193],[23.099,.838],[23.261,.416],[23.714,.452],[24.283,.552],
  [24.84,.474],[25.316,.815],[25.63,.497],[25.932,.426],[26.501,.455],[26.988,.776],
  [27.546,.758],[28.149,.479],[28.44,.327],[28.648,.558],[29.264,.304],[29.543,.516],
  [29.763,.747],[29.949,.458],[30.344,.489],[30.912,.22],[31.168,.15],
  // Voice and drums together, including the quick cluster before the roll.
  // The word at 38.018 leans into the coincident drum rather than doubling it.
  [31.423,.947],[31.69,.608],[31.981,.856],[32.538,.701],[32.677,.288],[32.898,.444],
  [33.095,.776],[33.652,.789],[33.792,.308],[34.198,.805],[34.488,.461],[34.755,.646],
  [34.906,.373],[35.313,.633],[35.475,.394],[35.87,.752],[36.125,.354],[36.427,.771],
  [36.578,.314],[36.973,.718],[37.228,.279],[37.53,.762],[37.693,.452],
  [38.087,.692],[38.227,.447],[38.633,.719],[38.912,.297],[39.202,.713],[39.341,.264],
  [39.481,.506],[39.759,.725],[39.899,.453],
  // Four small rolls on the drum stem, the last with a stronger mix rise.
  [40.038,.294],[40.177,.328],[40.317,.356],[40.589,.469],
];

const spec: Spec = {
  duration: 40.783, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.64],[4.268,.64],[4.79,.78],[5.336,.64],[21.996,.64],[22.275,.48],[24.283,.62],[25.63,.44],[26.501,.58],[28.648,.66],[29.264,.48],[30.912,.48],[31.168,.56],[39.899,.56],[40.038,.32],[40.589,.32],[40.783,.36]]),
    speed: curve([[0,.94],[4.268,.94],[4.79,.90],[5.336,.94],[21.996,.94],[22.275,.68],[28.648,.78],[30.912,.78],[31.168,.94],[39.899,.94],[40.038,.70],[40.589,.86],[40.783,.91]]),
  },
};
export default spec;
