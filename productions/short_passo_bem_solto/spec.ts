/**
 * The first phrase begins mid-word. Catch the short renewals around the long G-sharp, letting the
 * drums under its held notes pass. The high voice at nine seconds starts a second sentence. Give the
 * syncopated treble answer the next seven bars, reserving the largest catches for the two drum
 * entrances. Voice alone bridges the gap into the final broken drum pattern. Keep its last uneven
 * strokes. The distinction between the voice and its doubled treble note is least clear at 18–22 s.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "PASSO BEM SOLTO", "audio": "productions/short_passo_bem_solto/audio.mp3", "beats": "productions/short_passo_bem_solto/audio.json", "spectrogram": {"image": "productions/short_passo_bem_solto/spectrogram.png", "metadata": "productions/short_passo_bem_solto/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "ATLXS", phases: [
  {"name": "Held G-sharp and its renewals", "t0": 0, "t1": 9.04, "color": "#426582"},
  {"name": "High answer", "t0": 9.04, "t1": 14.59, "color": "#a45643"},
  {"name": "Upper dance", "t0": 14.59, "t1": 27.3, "color": "#448078"},
  {"name": "Naked call", "t0": 27.3, "t1": 29.35, "color": "#826488"},
  {"name": "Drum return", "t0": 29.35, "t1": 45.05, "color": "#426582"},
  {"name": "Fraying drum figure", "t0": 45.05, "t1": 46.501, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // The phrase is already sounding. Give the held G-sharp a single small renewal.
  [.311,.335], [.579,.291], [.758,.381], [1.031,.283], [1.194,.406], [1.461,.394],
  [2.39,.543], [3.249,.238], [3.701,.597], [4.212,.376], [4.433,.564],
  [4.955,.299], [5.141,.361], [5.339,.444], [5.594,.285], [5.826,.273], [6.058,.531],
  [6.325,.318], [6.494,.395], [6.778,.423], [7.463,.263], [7.707,.283], [7.904,.469], [8.16,.326],
  // High A and falling reply; the low A catches the low pulse under it.
  [9.112,.413], [9.53,.269], [9.994,.302], [10.447,.504], [10.946,.485], [11.178,.251],
  [11.318,.243], [11.527,.391], [11.84,.403], [12.107,.304], [12.548,.368], [12.804,.254],
  [13.001,.36], [13.21,.267], [13.918,.724],
  // Four-bar treble question and answer, crossed by two drum triples.
  [14.58,.932], [14.952,.568], [15.288,.327], [15.973,.662], [16.519,.276], [16.798,.433],
  [17.134,.344], [17.506,.214], [17.819,.533], [18.051,.475], [18.284,.666],
  [18.644,.572], [18.98,.321], [19.665,.654], [20.211,.26], [20.49,.464], [20.826,.334],
  [21.198,.208], [21.511,.55], [22.057,.274], [22.336,.559], [22.672,.322],
  [23.357,.633], [23.903,.266], [24.182,.46], [24.53,.339], [24.89,.222],
  [25.203,.569], [25.435,.461], [25.668,.648], [26.028,.552], [26.364,.352], [27.049,.662],
  // Naked vowels, with two softer renewals. The word continues over the return.
  [27.699,.467], [28.001,.421], [28.257,.364], [28.466,.318], [28.709,.361], [28.907,.239], [29.139,.503],
  [29.348,.985], [29.603,.279], [29.824,.361], [30.277,.534], [30.741,.616], [31.194,.663],
  [31.554,.44], [31.67,.328], [32.123,.524], [32.587,.592], [32.819,.493], [33.052,.671],
  [33.295,.257], [33.516,.357], [33.969,.547], [34.433,.794], [34.886,.689], [35.246,.419], [35.362,.376],
  [35.815,.518], [36.279,.633], [36.535,.269], [36.744,.598], [37.092,.458], [37.208,.357],
  [37.661,.562], [38.125,.648], [38.59,.679], [38.938,.45], [39.054,.366], [39.507,.537],
  [39.971,.616], [40.203,.501], [40.436,.682], [40.679,.284], [40.9,.369], [41.353,.538], [41.817,.81],
  [42.281,.675], [42.63,.426], [42.746,.372], [43.199,.512], [43.663,.656],
  // Last word interlocks with the diminishing drum pair right to the cut.
  [43.93,.295], [44.127,.584], [44.476,.449], [44.592,.344], [45.045,.458],
  [45.509,.523], [45.973,.492], [46.322,.337], [46.438,.249],
];

const spec: Spec = {
  duration: 46.501, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0, 0.56], [9.04, 0.64], [14.59, 0.48], [27.3, 0.78], [29.35, 0.59], [45.05, 0.46]]),
    speed: curve([[0, 0.65], [9.04, 0.76], [14.59, 0.84], [27.3, 0.81], [29.35, 0.91], [45.05, 0.75]]),
  },
};
export default spec;
