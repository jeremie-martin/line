/** Start inside the faint upper clock. Its calls grow distinct, then divide into
 * four close strokes and the repeating upper tune. Two drum fills surround a
 * brief singer/drum dialogue. From 17.776 the low pulse carries the entire
 * ride through the cut, briefly hollowing at 26.809. Leave its rebounds and
 * all high offbeats in the accompaniment. The tiny word after the 14.932
 * reply and the first ticks are the least certain accents.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';

const music = {"title": "FUNK ESTRANHO (Super Slowed)", "audio": "productions/short_funk_estranho_super_slowed/audio.mp3", "beats": "productions/short_funk_estranho_super_slowed/audio.json", "spectrogram": {"image": "productions/short_funk_estranho_super_slowed/spectrogram.png", "metadata": "productions/short_funk_estranho_super_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Astora", phases: [
  {"name": "Faint upper clock", "t0": 0, "t1": 4.18, "color": "#426582"},
  {"name": "Calls and echoes", "t0": 4.18, "t1": 8.71, "color": "#a45643"},
  {"name": "Upper notes and fill", "t0": 8.71, "t1": 13.26, "color": "#448078"},
  {"name": "Words and drum replies", "t0": 13.26, "t1": 17.77, "color": "#826488"},
  {"name": "Low motor", "t0": 17.77, "t1": 45.434, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // Quiet ticks. The upper stem is faint even where the attack begins to sharpen.
  [.233,.111],[.802,.105],[1.360,.128],[1.928,.142],[2.497,.137],[3.055,.153],[3.624,.184],
  [4.181,.514],[4.761,.129],[5.319,.431],[5.887,.144],[6.445,.458],[7.014,.446],[7.583,.483],
  [7.873,.336],[8.151,.369],[8.291,.278],[8.430,.309],[8.581,.348],
  // Four heads of the upper figure, each with its own inner notes.
  [8.720,.584],[8.999,.397],[9.278,.298],[9.556,.368],
  [9.846,.558],[10.125,.427],[10.404,.459],[10.694,.385],
  [10.973,.566],[11.263,.408],[11.542,.312],[11.820,.432],
  [12.099,.597],[12.389,.401],[12.668,.452],
  [12.830,.348],[12.970,.362],[13.120,.323],
  // Separate words and drum replies, including the small word between the two replies.
  [13.248,.505],[13.422,.287],[13.655,.394],[14.084,.351],
  [14.374,.486],[14.560,.283],[14.653,.418],[14.932,.399],[15.059,.186],[15.512,.462],
  [15.918,.473],[16.069,.337],[16.348,.402],[16.638,.493],[16.905,.468],
  [17.196,.646],[17.358,.312],[17.497,.365],[17.637,.381],
  // One motor. The 26.809 bass attack has about a third of its neighbours' stem rise.
  [17.776,.957],[18.333,.657],[18.902,.742],[19.471,.759],[20.028,.753],[20.597,.641],
  [21.166,.766],[21.723,.813],[22.304,.712],[22.861,.623],[23.430,.724],[23.999,.775],
  [24.556,.752],[25.125,.647],[25.682,.739],[26.251,.839],[26.809,.341],[27.378,.651],
  [27.958,.691],[28.527,.741],[29.096,.738],[29.641,.668],[30.222,.773],[30.779,.785],
  [31.360,.706],[31.917,.725],[32.486,.762],[33.043,.774],[33.612,.769],[34.169,.658],
  [34.738,.748],[35.307,.801],[35.876,.714],[36.457,.613],[37.002,.732],[37.583,.746],
  [38.140,.743],[38.686,.639],[39.266,.738],[39.835,.749],[40.404,.682],[40.950,.631],
  [41.542,.698],[42.099,.735],[42.668,.782],[43.214,.657],[43.794,.761],[44.363,.748],[44.932,.716],
];

const spec: Spec = {
  duration: 45.434, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.52],[3.624,.52],[4.181,.64],[7.014,.64],[7.583,.42],[8.581,.30],[8.720,.40],[12.668,.40],[12.830,.24],[13.120,.24],[13.248,.38],[16.638,.38],[16.905,.53],[17.196,.51],[17.358,.34],[17.497,.54],[17.637,.76],[17.776,.76],[26.251,.76],[26.809,.44],[27.378,.76]]),
    speed: curve([[0,.26],[3.624,.26],[4.181,.48],[7.014,.48],[7.583,.64],[8.581,.74],[8.720,.70],[12.668,.70],[12.830,.76],[13.120,.76],[13.248,.68],[16.638,.68],[16.905,.86],[17.196,.98],[26.251,.98],[26.809,.78],[27.378,.98]]),
  },
};
export default spec;
