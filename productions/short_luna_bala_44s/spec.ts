/**
 * Carry the cut-in vowel, catch its turn and let the breath at 3.5 s hang. The next words gather over
 * a quicker pulse into the drop. Keep the drum and its syncopated bass answer distinct, thinning the
 * doubling treble. When bass vanishes the four toms get quiet upper answers. In the return let the later
 * snare strokes interrupt the low line. The last kick cuts to residual sound. The strength of the second
 * bass reply in a pair is the uncertain part.
 */
import type {Spec} from '../../scripts/v0/types.ts';
import {curve} from '../../scripts/v0/core/measured.ts';

const music = {"title": "LUNA BALA (Slowed)", "audio": "productions/short_luna_bala_44s/audio.mp3", "beats": "productions/short_luna_bala_44s/audio.json", "spectrogram": {"image": "productions/short_luna_bala_44s/spectrogram.png", "metadata": "productions/short_luna_bala_44s/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Yb Wasg'ood & Ariis", phases: [
  {"name": "Solo voice", "t0": 0, "t1": 8.615, "color": "#426582"},
  {"name": "Kick and crooked bass answer", "t0": 8.615, "t1": 23.88, "color": "#a45643"},
  {"name": "Four toms", "t0": 23.88, "t1": 26.05, "color": "#448078"},
  {"name": "Bass and snare answers", "t0": 26.05, "t1": 44, "color": "#826488"},
]};

// Time and impact in the short.
const strikes: [number, number][] = [
  // Enter on the turn of the held G. The second sentence articulates more
  // quickly; the quieter words keep their size right up to the drop.
  [.441,.281], [1.033,.262], [1.579,.312], [2.078,.275], [2.659,.239], [3.216,.254],
  [4.493,.321], [4.667,.264], [5.074,.248], [5.387,.228], [5.944,.299],
  [6.444,.283], [6.989,.253], [7.523,.286], [8.069,.251],
  // Follow the leading edge of the bass. Its answers start at different
  // distances from the kick, especially the two before the first fill.
  [8.615,1], [9.172,.652], [9.300,.337], [9.706,.676], [10.008,.516],
  [10.252,.658], [10.437,.587], [10.786,.814], [11.355,.645], [11.494,.472],
  [11.889,.672], [12.249,.507], [12.434,.687], [12.585,.441], [12.701,.66], [12.980,.781],
  [13.526,.664], [13.665,.349], [14.071,.673], [14.362,.512], [14.605,.658], [14.814,.586],
  [15.151,.791], [15.708,.684], [15.964,.432], [16.242,.706], [16.533,.424], [16.788,.699],
  [17.009,.438], [17.334,.788], [17.891,.669], [18.077,.419], [18.425,.678], [18.971,.667],
  [19.122,.525], [19.505,.776], [20.062,.662], [20.201,.434], [20.608,.682],
  [20.968,.513], [21.153,.689], [21.293,.471], [21.420,.694], [21.699,.796],
  [22.245,.675], [22.442,.429], [22.790,.681], [23.081,.517], [23.336,.667], [23.487,.53],
  // The low answer disappears. Each tom exposes a small treble reply.
  [23.870,.809], [24.288,.285], [24.416,.694], [24.706,.28],
  [24.961,.698], [25.252,.273], [25.507,.709], [25.797,.229],
  // Bass returns on the same terms. Late snare attacks slip into the gaps
  // between kick and bass; keep the two replies before the last downstroke.
  [26.053,.822], [26.61,.674], [26.749,.389], [27.156,.67], [27.341,.353], [27.69,.667], [27.841,.488],
  [28.235,.813], [28.642,.329], [28.793,.675], [29.327,.682], [29.617,.356],
  [29.872,.691], [30.023,.43], [30.14,.65], [30.418,.776], [30.975,.665],
  [31.161,.383], [31.509,.669], [31.777,.351], [31.869,.464], [32.055,.681], [32.206,.473],
  [32.589,.802], [33.007,.388], [33.146,.698], [33.402,.392], [33.681,.704],
  [34.017,.394], [34.226,.701], [34.447,.38], [34.772,.784], [35.329,.668],
  [35.527,.371], [35.875,.683], [36.177,.344], [36.42,.677], [36.56,.463],
  [36.955,.811], [37.512,.678], [37.651,.352], [38.058,.667], [38.22,.355],
  [38.325,.197], [38.592,.682], [38.742,.465], [38.859,.642], [39.149,.782],
  [39.695,.661], [39.834,.391], [40.24,.655], [40.484,.417], [40.774,.676],
  [40.925,.494], [41.32,.824], [41.866,.687], [42.144,.472], [42.411,.698],
  [42.69,.451], [42.957,.675],
];

const spec: Spec = {
  duration: 44, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.62], [3.216,.62], [3.5,.86], [4.2,.86], [4.493,.48], [8.069,.48], [8.615,.68], [23.487,.68], [23.870,.76], [25.797,.76], [26.053,.68], [42.957,.68], [43.2,.32], [44,.32]]),
    speed: curve([[0,.36], [4.2,.36], [4.493,.46], [7.523,.56], [8.069,.98], [23.487,.98], [23.870,.74], [25.507,.74], [25.797,.86], [26.053,.98], [42.957,.98], [43.2,.40], [44,.40]]),
  },
};
export default spec;
