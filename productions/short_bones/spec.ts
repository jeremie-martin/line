/**
 * Enter on the quiet spoken bridge and carry the held vowel. The lower D-sharp/E/F words stand above
 * three bass entries. Sharpen the pickups into the chorus, where the heavy stroke and its low answer get
 * the floor before the singer returns between beats. In the second chorus follow the long lower notes
 * into clipped C turns. Leave the intervening guitar edges alone. The final drum fill answers the last
 * sung line, with room for its closing resonance. The early chorus bass accent is the choice to check.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "Bones", "audio": "productions/short_bones/audio.mp3", "beats": "productions/short_bones/audio.json", "spectrogram": {"image": "productions/short_bones/spectrogram.png", "metadata": "productions/short_bones/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Imagine Dragons", phases: [
  {"name": "Spoken bridge", "t0": 0, "t1": 4.62, "color": "#426582"},
  {"name": "Lower register", "t0": 4.62, "t1": 11.22, "color": "#a45643"},
  {"name": "Sharpening pickup", "t0": 11.22, "t1": 13.3, "color": "#448078"},
  {"name": "Chorus beat and bass answer", "t0": 13.3, "t1": 30.14, "color": "#826488"},
  {"name": "Held lower voice and clipped turns", "t0": 30.14, "t1": 38.56, "color": "#426582"},
  {"name": "Last vocal over broad lows", "t0": 38.56, "t1": 48.423, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // Already inside the consonant at the cut. Start on its vowel.
  [.299,.209],[.543,.279],[.856,.187],[1.088,.163],[1.611,.251],[2.122,.203],[2.632,.245],
  [2.957,.174],[4.107,.113],
  // The low sustained entries share the singer. The two bright interior words
  // at 7.68 and 7.99 remain light, even over the rising bass.
  [4.583,.158],[4.885,.334],[5.14,.196],[5.918,.217],[6.986,.386],[7.369,.153],
  [7.683,.214],[7.985,.237],[8.449,.216],[9.087,.417],[9.32,.183],[10.214,.179],[10.922,.306],
  [11.224,.374],[11.595,.351],[11.978,.458],[12.234,.495],[12.501,.539],[12.768,.653],[13.058,.427],
  // Crash, pickup, backbeat and second heavy. Catch the two bass replies with
  // different weights. The word at 15.14 carries through the low exchange.
  [13.302,.992],[13.569,.27],[13.824,.714],[14.091,.812],[14.364,.50],[14.846,.73],[15.403,.782],
  [15.705,.493],[15.914,.403],[16.204,.799],[16.471,.584],[16.947,.57],[17.075,.463],
  [17.505,.821],[17.807,.477],[18.016,.414],[18.306,.804],[18.515,.453],[19.049,.392],
  [19.351,.512],[19.618,.913],[19.873,.831],[20.407,.952],[20.663,.541],[20.93,.447],[21.173,.329],
  // Second drum sentence. The pickup into the backbeat is small. Low replies fit
  // between the larger catches. Keep the third heavy in the fill at 28.824.
  [21.719,.824],[21.986,.24],[22.23,.92],[22.52,.59],[22.77,.48],[23.263,.81],[23.588,.241],
  [23.832,.754],[24.099,.55],[24.331,.412],[24.622,.806],[24.889,.489],[25.411,.60],[25.934,.758],
  [26.468,.394],[26.723,.826],[26.978,.497],[27.478,.428],[27.78,.492],[28.035,.902],
  [28.302,.856],[28.546,.451],[28.824,.929],[29.045,.548],[29.347,.437],[29.718,.409],
  // Held lower notes, clipped C's. The singer crosses the drum at 34.351
  // and takes a separate short step at 34.502.
  [30.136,.745],[30.409,.31],[30.659,.78],[30.937,.70],[31.193,.59],[31.715,.71],[31.994,.248],[32.249,.833],[32.522,.57],
  [32.76,.391],[32.876,.414],[33.039,.817],[33.526,.562],[33.794,.56],[34.095,.542],
  [34.351,.838],[34.502,.461],[34.862,.409],[35.152,.803],[35.616,.371],[35.941,.421],
  [36.232,.236],[36.452,.927],[36.719,.871],[36.951,.462],[37.253,.951],[37.474,.513],[38.02,.369],
  // Final line winds through the broad strokes and the fill; two small
  // release strokes follow the closing word before the recorded decay.
  [38.565,.792],[38.832,.32],[39.088,.80],[39.366,.70],[39.622,.57],[40.144,.70],[40.423,.225],[40.667,.809],[40.939,.57],
  [41.177,.412],[41.468,.818],[41.688,.381],[41.967,.589],[42.234,.59],[42.524,.473],
  [42.768,.788],[43.128,.519],[43.29,.416],[43.569,.823],[43.929,.379],[44.359,.424],
  [44.614,.537],[44.869,.931],[45.136,.859],[45.671,.982],[45.926,.506],[46.205,.297],[46.425,.373],
];

const spec: Spec = {
  duration: 48.423, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.36],[2.632,.43],[2.957,.73],[4.107,.39],[4.885,.61],[5.918,.80],[6.986,.49],[10.214,.77],[10.922,.47],[12.501,.75],[13.302,.77],[14.091,.78],[14.382,.63],[15.403,.80],[16.204,.72],[19.618,.79],[20.663,.57],[21.719,.73],[28.035,.81],[29.045,.61],[30.136,.75],[32.76,.48],[34.862,.76],[36.232,.64],[36.452,.70],[36.719,.49],[36.951,.59],[37.253,.79],[37.474,.60],[38.565,.79],[41.468,.55],[44.869,.82],[45.926,.53],[46.425,.30],[48.423,.09]]),
    speed: curve([[0,.30],[4.107,.30],[4.885,.46],[10.214,.46],[10.922,.61],[11.224,.76],[12.234,.94],[12.501,1],[45.671,1],[45.926,.82],[46.425,.56],[47.345,.30],[48.423,.22]]),
  },
};
export default spec;
