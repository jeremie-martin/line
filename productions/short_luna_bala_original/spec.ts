/**
 * The faster cut begins inside a vocal pickup. Take the vowel turn and the first upper swell before the low
 * beat. The last swell hangs over the approach. The three-and-short-answer drum figure carries the first body. The bass begins answering in
 * longer, uneven phrases around 18.45. Leave the treble doubling alone and take the little drum fills
 * where the bass pauses. The four uncovered drums lead into three sung calls. Keep even the tiny pitched turns and the
 * last C before the tail. Its pitch is clearer than its attack.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LUNA BALA", "audio": "productions/short_luna_bala_original/audio.mp3", "beats": "productions/short_luna_bala_original/audio.json", "spectrogram": {"image": "productions/short_luna_bala_original/spectrogram.png", "metadata": "productions/short_luna_bala_original/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Ariis & Yb Wasg'ood", phases: [
  {"name": "End of the sung pickup", "t0": 0, "t1": 3.69, "color": "#426582"},
  {"name": "Broken percussion", "t0": 3.69, "t1": 18.45, "color": "#a45643"},
  {"name": "Low answering sentences", "t0": 18.45, "t1": 31.375, "color": "#448078"},
  {"name": "Uncovered drum tail", "t0": 31.375, "t1": 33.23, "color": "#826488"},
  {"name": "A-sharp and C-sharp answer", "t0": 33.23, "t1": 39.373, "color": "#426582"},
]};

const strikes: [number, number][] = [
  // Two vocal stresses, a pitched turn, then the upper swell leading the drummer.
  [0.336,.402], [.969,.229], [1.41,.371], [1.851,.267], [2.414,.302], [2.757,.358], [3.024,.253],
  // Broken percussion. Each bar leans into a different last stroke.
  [3.685,.968], [4.034,.601], [4.376,.567], [4.835,.652],
  [5.531,.823], [5.88,.666], [6.222,.592], [6.681,.643], [7.145,.689],
  [7.377,.781], [7.726,.649], [8.068,.564], [8.527,.627],
  [9.223,.88], [9.572,.663], [9.914,.615], [10.146,.727], [10.605,.57],
  [11.069,.754], [11.418,.652], [11.76,.53], [12.225,.595],
  [12.915,.915], [13.264,.694], [13.606,.55], [14.071,.621], [14.529,.542],
  [14.761,.891], [15.11,.647], [15.452,.488], [15.917,.64],
  [16.607,.642], [16.956,.831], [17.298,.543], [17.53,.607], [17.762,.741], [17.989,.697],
  // Bass attacks fall ahead of the coincident backbeat. Two three-stroke drum fills.
  [18.459,.889], [18.674,.392], [19.156,.492], [19.62,.51],
  [19.846,.411], [20.079,.572], [20.311,.814], [20.52,.412], [20.926,.276],
  [21.321,.331], [21.692,.493], [22.145,.714], [22.354,.352], [22.714,.318],
  [23.179,.289], [23.73,.425], [23.991,.824], [24.218,.381], [24.624,.294],
  [25.146,.453], [25.617,.316], [25.837,.721], [26.069,.426], [26.418,.338], [26.847,.348],
  [27.23,.41], [27.463,.567], [27.695,.812], [27.904,.381], [28.299,.307],
  [28.699,.324], [29.163,.349], [29.529,.737], [29.744,.384], [30.139,.305], [30.551,.354], [31.108,.375],
  // Four bare drums. Then the three calls and the little pitched answers.
  [31.375,.746], [31.84,.658], [32.304,.617], [32.757,.728],
  [33.233,.446], [33.709,.249], [34.394,.149], [35.079,.541], [35.613,.211],
  [36.182,.174], [36.321,.128], [36.925,.568], [37.633,.241], [37.877,.184], [37.993,.139], [38.666,.121],
];

const spec: Spec = {
  duration: 39.373, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.6], [3.69, 0.53], [18.45, 0.68], [31.375, 0.65], [33.23, 0.77]]),
    speed: curve([[0, 0.58], [3.69, 0.86], [18.45, 0.83], [31.375, 0.7], [33.23, 0.47]]),
  },
};
export default spec;
