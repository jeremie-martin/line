/**
 * The cut starts inside the light upper figure. The singer answers over isolated drum accents before the
 * first full burst. Separate the hard doubles from their soft pickups. At the hole around 16.5 s let the
 * rapid words continue the rhythm across the missing drums. The next long passage follows the
 * B/A/G-sharp vocal descent, with one short drum reply in the withdrawal. Return to percussion for the
 * last burst, breaking for the little vocal bridge. Let the last bass and word answer the final stroke.
 * The last syllable before 8.094 carries into the drum. Check whether the
 * quick words at 28.6–29.3 stay distinct as their intervals shorten.
 */
import type {Spec} from '../../../scripts/v0/types.ts';
import {curve} from '../../../scripts/v0/core/measured.ts';

const music = {"title": "MONTAGEM COMA", "audio": "productions/short_montagem_coma/audio.mp3", "beats": "productions/short_montagem_coma/audio.json", "spectrogram": {"image": "productions/short_montagem_coma/spectrogram.png", "metadata": "productions/short_montagem_coma/spectrogram.json"}};
export const overlayMeta = {title: music.title, artist: "Andromeda", phases: [
  {"name": "Light upper figure", "t0": 0, "t1": 4.1, "color": "#426582"},
  {"name": "Sung answers", "t0": 4.1, "t1": 8.09, "color": "#a45643"},
  {"name": "Heavy drum bursts", "t0": 8.09, "t1": 16.47, "color": "#448078"},
  {"name": "Rap in the gap", "t0": 16.47, "t1": 22.59, "color": "#826488"},
  {"name": "Long descending voice", "t0": 22.59, "t1": 32.09, "color": "#426582"},
  {"name": "Final burst and short vocal bridge", "t0": 32.09, "t1": 48.019, "color": "#a45643"},
]};

const strikes: [number, number][] = [
  // The first upper attack is already sounding at the cut. Its next small
  // reply leads into four drum taps, threaded through the brighter notes.
  [.478,.151],[.861,.139],[1.349,.224],[1.604,.174],[1.848,.289],[2.138,.267],
  [2.475,.305],[2.846,.251],[3.114,.198],[3.601,.361],
  [4.1,.614],[4.588,.377],[5.087,.431],[5.586,.462],[5.83,.563],[6.097,.687],
  [6.597,.393],[7.096,.228],[7.595,.316],
  // The slams carry the half-second pulse. The low, different-sounding
  // strokes at 10.091 and 14.097 sit inside that pulse. Keep the double.
  [8.094,.959],[8.593,.803],[9.093,.858],[9.592,.749],[10.091,.664],[10.602,.811],
  [11.09,.854],[11.589,.828],[11.844,.591],[12.1,.713],[12.599,.806],[13.098,.862],
  [13.586,.753],[14.097,.672],[14.596,.787],[15.095,.849],[15.594,.742],[16.093,.681],
  // Seven quick sounds inside the hole. Their small steps leave the
  // continuing drum at 18.09 a full half-second of approach.
  [16.616,.246],[16.744,.208],[16.871,.283],[16.987,.252],[17.115,.294],[17.359,.337],[17.591,.226],
  [18.09,.726],[18.59,.794],[19.089,.813],[19.588,.841],[19.832,.602],[20.099,.706],
  [20.598,.822],[21.097,.848],[21.597,.766],[22.096,.662],
  // C-sharps into the held B/A/G-sharp. Renew the articulation at 24.894,
  // carry 25.138 almost a second, then follow the shorter pitch turns.
  [22.607,.386],[22.99,.268],[23.106,.493],[23.605,.472],[23.977,.595],
  [24.36,.442],[24.604,.321],[24.894,.297],[25.138,.467],[26.101,.426],[26.31,.286],
  [26.624,.368],[26.81,.451],[26.972,.251],[27.158,.474],
  // The voice withdraws for just two drums, then shortens the words.
  [27.843,.689],[28.098,.627],[28.354,.408],[28.632,.602],[28.888,.475],[29.12,.528],
  [29.259,.379],[29.654,.438],[30.107,.413],[30.304,.309],[30.467,.269],[30.629,.432],
  [30.966,.312],[31.152,.471],[31.326,.323],[31.511,.364],[31.662,.423],[31.813,.295],
  // Four calls against the burst. The bridge starts at 39.116. Drums
  // under those words share their catches until the pickup at 39.975.
  [32.092,.987],[32.359,.368],[32.464,.416],[32.603,.801],[33.09,.847],[33.59,.748],
  [34.089,.681],[34.356,.431],[34.6,.808],[35.099,.852],[35.598,.829],[35.842,.654],
  [36.097,.713],[36.353,.406],[36.469,.387],[36.597,.792],[37.096,.848],[37.595,.751],
  [38.094,.672],[38.361,.424],[38.605,.804],[39.116,.337],[39.371,.292],[39.604,.315],
  [39.859,.403],[39.975,.391],[40.103,.795],[40.463,.362],[40.602,.816],[41.09,.841],
  [41.589,.752],[42.1,.675],[42.599,.792],[43.098,.813],[43.598,.825],[43.841,.596],
  [44.097,.707],[44.468,.351],[44.596,.802],[45.095,.839],[45.594,.743],[46.094,.668],
  [46.593,.787],[47.092,.812],[47.591,.798],[47.719,.335],[47.858,.372],
];

const spec: Spec = {
  duration: 48.019, preroll: 2, music,
  contacts: strikes.map(([t, impact]) => ({t, impact})),
  axes: {
    air: curve([[0,.46],[3.601,.46],[4.1,.52],[7.595,.68],[8.094,.74],[16.093,.74],[16.616,.26],[17.591,.26],[18.09,.74],[22.096,.74],[22.607,.60],[24.604,.46],[24.894,.46],[25.138,.88],[26.101,.46],[26.972,.46],[27.158,.80],[27.843,.48],[28.098,.48],[28.354,.60],[28.632,.48],[28.888,.52],[29.12,.58],[29.259,.32],[31.326,.30],[31.662,.72],[32.092,.74],[38.605,.74],[39.116,.38],[39.975,.38],[40.103,.74],[47.591,.74],[47.719,.52],[48.019,.52]]),
    speed: curve([[0,.34],[3.601,.34],[4.1,.62],[7.85,.78],[8.094,.94],[16.093,.94],[16.616,.82],[17.591,.82],[18.09,.94],[22.096,.94],[22.607,.60],[24.36,.60],[24.604,.82],[27.158,.82],[27.843,.72],[28.354,.80],[29.12,1],[38.605,1],[39.116,.70],[39.975,.90],[40.103,1],[47.591,1],[47.719,.96],[48.019,.96]]),
  },
};
export default spec;
