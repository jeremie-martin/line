/** Enter on the end of a sung turn, with its clipped first syllable in motion.
 * Fourteen roll strokes lead to the bass and its short double. Leave the
 * higher counterline alone until the suspended pickup and three little calls.
 * The drum then walks alone, acquiring a high answer just behind every step.
 * That answer becomes the broad tune with six bass replies. At the low double
 * the first bass stroke also carries the treble. Their relative weight needs
 * listening. The cut ends inside an active upper figure, on its answering note.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "FUNK DO BOUNCE (Super Slowed)", "audio": "productions/short_funk_do_bounce_super_slowed/audio.mp3", "beats": "productions/short_funk_do_bounce_super_slowed/audio.json", "spectrogram": {"image": "productions/short_funk_do_bounce_super_slowed/spectrogram.png", "metadata": "productions/short_funk_do_bounce_super_slowed/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Ariis", phases: [
  {"name": "Last words", "t0": 0, "t1": 1.28, "color": "#426582"},
  {"name": "Roll", "t0": 1.28, "t1": 3.73, "color": "#a45643"},
  {"name": "Bass restart", "t0": 3.73, "t1": 11.96, "color": "#448078"},
  {"name": "Exposed little calls", "t0": 11.96, "t1": 13.47, "color": "#826488"},
  {"name": "Broad drum stride", "t0": 13.47, "t1": 22.192, "color": "#426582"},
  {"name": "High offbeats enter", "t0": 22.192, "t1": 32.688, "color": "#a45643"},
  {"name": "Upper phrase and low double", "t0": 32.688, "t1": 43.078, "color": "#448078"},
  {"name": "Treble still ticking", "t0": 43.078, "t1": 45.979, "color": "#826488"},
]};

const strikes: [number, number][] = [
  [.342,.389],[.957,.351],
  // The rattle changes colour stroke by stroke. It does not build uniformly.
  [1.283,.462],[1.445,.346],[1.596,.283],[1.747,.306],[1.898,.371],[2.060,.238],[2.211,.268],
  [2.362,.254],[2.513,.276],[2.664,.294],[2.815,.333],[2.966,.362],[3.117,.375],[3.419,.497],
  // Low restart. The little 6.333 answer belongs to the same bass phrase.
  [3.721,.844],[4.348,.527],[4.951,.546],[5.555,.568],[6.170,.623],[6.333,.459],[6.786,.551],
  [7.389,.697],[7.993,.681],[8.608,.785],[9.224,.536],[9.816,.714],[10.431,.582],[11.047,.703],[11.662,.675],
  [11.975,.392],[12.254,.305],[12.567,.379],[13.171,.405],
  // The first stride has no high answer. Leave the voice and secondary ticks above it.
  [13.473,.982],[14.088,.632],[14.692,.842],[15.307,.819],[15.911,.771],[16.526,.686],[17.130,.821],
  [17.745,.753],[18.349,.797],[18.965,.647],[19.568,.892],[20.184,.828],[20.787,.759],[21.403,.681],
  // Kick then upper reply. Even the very small reply at 27.684 completes the pair.
  [22.006,.746],[22.192,.439], [22.622,.698],[22.807,.415], [23.225,.712],[23.411,.408],
  [23.841,.593],[24.026,.432], [24.444,.732],[24.630,.403], [25.060,.678],[25.246,.398],
  [25.663,.661],[25.849,.419], [26.279,.568],[26.465,.383], [26.883,.735],[27.068,.431],
  [27.498,.689],[27.684,.271], [28.102,.769],[28.287,.452], [28.717,.552],[28.903,.407],
  [29.321,.734],[29.518,.412], [29.936,.649],[30.110,.376], [30.540,.678],[30.725,.395],
  [31.155,.559],[31.352,.357], [31.759,.715],[31.956,.428], [32.374,.642],[32.560,.328],
  // Broader upper arcs. Low replies tuck into them at 33.616, 34.835 and 36.054.
  [32.688,.506],[33.001,.594],[33.512,.483],[33.616,.442],[33.907,.568],[34.220,.552],[34.731,.519],[34.835,.487],
  [35.126,.523],[35.427,.695],[35.927,.379],[36.054,.518],[36.345,.579],[36.658,.617],
  [37.262,.813],[37.436,.695],[37.564,.532],[37.877,.619],[38.388,.458],[38.493,.411],
  [38.794,.537],[39.096,.556],[39.607,.487],[40.304,.716],[40.814,.381],[41.534,.587],[42.068,.582],
  // The crop cuts off the little upper figure in stride.
  [43.078,.321],[43.276,.439],[43.694,.477],[44.007,.346],[44.297,.428],
  [44.623,.291],[44.901,.525],[45.238,.316],[45.528,.274],[45.679,.448],
];

const spec: Spec = {
  duration: 45.979, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.44],[.342,.44],[.957,.30],[3.419,.30],[3.721,.62],[11.662,.62],[11.975,.76],[13.171,.58],[13.473,.68],[21.403,.68],[22.006,.46],[32.374,.46],[32.688,.62],[36.658,.62],[37.262,.58],[37.564,.62],[42.068,.62],[43.078,.38]]),
    speed: curve([[0,.56],[.342,.56],[.957,.86],[3.419,.86],[3.721,.78],[11.662,.78],[11.975,.48],[12.567,.54],[13.171,.88],[13.473,.92],[21.403,.92],[22.006,.96],[32.374,.96],[32.688,.78],[36.983,.78],[37.262,.90],[37.564,.78],[42.068,.78],[43.078,.54]]),
  },
};
export default spec;
