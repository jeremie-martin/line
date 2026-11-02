/** Curated experiments, opt-in through studyLook. The approved production recipe stays separate. */
import {LOCKED_FX} from '../../../scripts/fx_recipe';
import type {FXConfig} from '../fx';
import type {ImpactContact} from '../impact';
import type {SpectrumForm} from './SpectrumForms';
import {contactAccent, contactKick, phraseAt, recentContacts, type TargetAxis} from './signals';

export const STUDY_LOOKS = {
  'cobalt-clear': {label: 'Cobalt architecture', description: 'Near-black geometry, cobalt brackets and a short contact zoom. Clean between accents.'},
  'mint-clear': {label: 'Mint percussion', description: 'Almost-white mint, dark ink and solid frequency blocks. A small contact weight accent; no shadow.'},
  'silver-tuning': {label: 'Silver tuning', description: 'Neutral paper, graphite geometry and blue-violet frequency stems, with a steady camera.'},
  'iris-terraces': {label: 'Iris terraces', description: 'Separated lavender frequency contours and real receding history in a shallow lower band.'},
  'graphite-mirror': {label: 'Graphite mirror', description: 'Crisp white geometry, a luminous reflected spectrum and a brief contact rebound. No halo or rings.'},
  'porcelain-mirror': {label: 'Porcelain mirror', description: 'A soft reflected spectrum on white, dark geometry and a brief teal contact edge.'},
  'electric-registration': {label: 'Electric registration', description: 'Violet and cyan frequency blocks with two short-lived contact underprints. Quiet ink between hits.'},
  'iris-continuous': {label: 'Iris · continuous', description: 'The same lower Iris composition with continuous frequency contours. A shape comparison, not a verdict against the earlier flowing animation.'},
  'iris-terraces-high': {label: 'Iris terraces · higher', description: 'The identical Iris treatment at the earlier spectrum position. Only vertical placement changes.'},
  'mint-unshaded': {label: 'Mint · no vignette', description: 'The previous Mint relief, changing only the vignette. A diagnostic control, not a new complete treatment.'},
  'cobalt-poster': {label: 'Cobalt poster', description: 'Open cobalt frequency brackets, crisp blue geometry and a concise contact zoom.'},
  'mint-relief': {label: 'Mint relief', description: 'Plum ink and lilac relief on cool mint; the material gathers on contact while the camera rests.'},
  'iris-weave': {label: 'Iris weave', description: 'Seven real past frequency contours recede beneath a confident current line, with slow authored-air framing.'},
  'magenta-signal': {label: 'Magenta signal', description: 'One bold magenta frequency contour and a brief matching contact edge on near-white.'},
  approved: {label: 'Approved', description: 'The approved full-width spectrum, impact effects and static soft-base vignette.'},
  elastic: {label: 'Elastic print', description: 'A deliberate contact kick and rebound, crisp colour accents, and a warmer spectrum.'},
  electric: {label: 'Electric paper', description: 'Cyan and coral ink edges, a luminous spectrum and graphic contact ripples; very little camera movement.'},
  suspension: {label: 'Suspension', description: 'A flowing frequency ribbon and slow camera breathing from the authored air lane, punctuated by measured contacts.'},
  graphite: {label: 'Graphite', description: 'A consistently dark canvas, bright geometry and an electric spectrum. No flashing inversions.'},
  'arc-light': {label: 'Arc light', description: 'A stronger contact kick and cyan light edge, with crisp warm-white geometry and confident spectrum bars.'},
  'cut-paper': {label: 'Cut paper', description: 'Charcoal cut-outs with a small warm shadow, cream paper and stepped spectrum blocks.'},
  edges: {label: 'Edge currents', description: 'Frequency side rails leave the lower centre open; the ride remains the focus.'},
  atlas: {label: 'Contour atlas', description: 'Open nested frequency contours and dark teal linework; space and geometry lead.'},
  memory: {label: 'Spectral memory', description: 'A bright current frequency contour with faint real past contours; no rider trails.'},
  filament: {label: 'Light filament', description: 'A crisp luminous line with a restrained halo and fine frequency stems on plum-black.'},
  stamps: {label: 'Impact stamps', description: 'Measured contacts briefly strengthen the ink weight instead of shaking the camera.'},
  tuning: {label: 'Tuning forks', description: 'Fine frequency stems with contact-responsive caps, cool ink and a stable camera.'},
  aurora: {label: 'Aurora', description: 'Slow atmospheric colour behind crisp geometry, with a flowing frequency ribbon.'},
  risograph: {label: 'Two-colour print', description: 'Offset coral print beneath blue-black geometry; compact stepped frequencies.'},
  phosphor: {label: 'Phosphor', description: 'A dot-matrix frequency display beneath precise luminous geometry, without flicker or scanlines.'},
  fan: {label: 'Resonance fan', description: 'Frequency stems open into a shallow fan below the ride; warm ink and a quiet camera.'},
  registration: {label: 'Registration lock', description: 'Two coloured underprints gather into the crisp dark line on contact, then relax outward.'},
  'press-porcelain': {label: 'Press · Porcelain', description: 'The same Press Pop motion and folded spectrum, in porcelain, blue and teal.'},
  'press-mint': {label: 'Press · Mint', description: 'The same Press Pop motion and folded spectrum, on pale mint with plum ink.'},
  'press-lilac': {label: 'Press · Lilac', description: 'The same Press Pop motion and folded spectrum, in lilac, navy and teal.'},
  daybreak: {label: 'Daybreak', description: 'Pastel light behind dark teal geometry, open frequency contours and slow breathing room.'},
  'press-pop': {label: 'Press pop', description: 'A single contact zoom pulse and ink accent on warm yellow paper, with folded spectrum faces.'},
  'side-glide': {label: 'Side glide', description: 'A small horizontal kick and gentle roll, with clear spectrum peaks on a pale mint canvas.'},
  'living-ink': {label: 'Living ink', description: 'Measured contacts briefly warm the dark ink from teal to plum; the camera stays steady.'},
  letterpress: {label: 'Letterpress', description: 'Opposite light and shadow edges give the ink a pressed-paper finish, with folded frequencies.'},
  sunprint: {label: 'Sunprint', description: 'Confident blue ink on bright yellow paper, with warm and teal frequency dots.'},
  'motion-only': {label: 'Elastic motion only', description: 'Only the current oscillating shake is replaced by an onset-relative kick; the other approved effects remain.'},
  'ink-only': {label: 'Ink accent only', description: 'Only the RGB split is replaced by short cyan/coral ink edges; the other approved effects remain.'},
  'ribbon-only': {label: 'Spectrum ribbon only', description: 'Only the bars become a continuous frequency silhouette; the approved ride effects and palette remain.'},
} as const;
export type StudyLook = keyof typeof STUDY_LOOKS;
export type StudyData = {contacts: ImpactContact[]; axes: TargetAxis[]};
export type StudyFrame = {
  id: StudyLook; fx: FXConfig; background: string; dark: boolean; palette?: string[];
  ribbon: boolean; reflection: number; glow: number; accent: number;
  scale: number; y: number; ink: number; x?: number; rotation?: number;
  spectrumForm?: SpectrumForm;
  spectrumLayout?: {center: number; height: number};
  spectrumShadow?: {color: string; offset: number};
  surface?: {core: string; shadow?: string; highlight?: string; offset?: number; shadowBlur?: number; halo?: string; haloRadius?: number; weight?: number};
  atmosphere?: {color: string; second: string; amount: number; position: number};
  backgroundRgb?: string; ripples: {age: number; strength: number}[];
};

const colourStudies: Record<string, {background: string; rgb: string; core: string; palette: string[]}> = {
  'press-porcelain': {background: '#f4f7fb', rgb: '244,247,251', core: '#243b62', palette: ['#236fa1', '#7e8ed4', '#288f8b']},
  'press-mint': {background: '#eef8f3', rgb: '238,248,243', core: '#43395c', palette: ['#1d9686', '#587db5', '#976ca8']},
  'press-lilac': {background: '#f5f1fc', rgb: '245,241,252', core: '#30455b', palette: ['#596bbb', '#9c66a0', '#3b9f9a']},
};

export function studyFrame(id: string | undefined, t: number, data: StudyData): StudyFrame | null {
  if (!id || id === 'approved') return null;
  if (!(id in STUDY_LOOKS)) throw new Error(`Unknown style study look: ${id}`);
  if (id === 'iris-continuous') return {...studyFrame('iris-terraces', t, data)!, id, spectrumForm: 'weave'};
  if (id === 'iris-terraces-high') return {...studyFrame('iris-terraces', t, data)!, id, spectrumLayout: {center: .73, height: .13}};
  if (id === 'mint-unshaded') return {...studyFrame('mint-relief', t, data)!, id, fx: {}};
  const colours = colourStudies[id];
  if (colours) {
    const base = studyFrame('press-pop', t, data)!;
    return {...base, id: id as StudyLook, background: colours.background, backgroundRgb: colours.rgb,
      surface: {...base.surface!, core: colours.core}, palette: colours.palette};
  }
  const accent = contactAccent(t, data.contacts), kick = contactKick(t, data.contacts);
  const air = phraseAt(data.axes, 'air', t), speed = phraseAt(data.axes, 'speed', t);
  const frame: StudyFrame = {id: id as StudyLook, fx: {...LOCKED_FX}, background: '#ffffff', dark: false,
    ribbon: false, reflection: .42, glow: 0, accent, scale: 1, y: 0, ink: 0, ripples: []};
  if (id === 'motion-only') {delete frame.fx.shake; frame.y = 15 * kick; frame.scale = 1.025 + .018 * kick; return frame;}
  if (id === 'ink-only') {delete frame.fx.chroma; frame.ink = 9 * accent; return frame;}
  if (id === 'ribbon-only') {frame.ribbon = true; return frame;}
  frame.fx = {vignette: LOCKED_FX.vignette};
  if (id === 'elastic') {
    frame.y = 17 * kick; frame.scale = 1.025 + .018 * kick;
    frame.fx.chroma = {...LOCKED_FX.chroma, maxPx: 9, decayPerSec: 12, minImpact: .12};
    frame.fx.flash = {...LOCKED_FX.flash, maxOpacity: .12};
    frame.palette = ['#17b6a6', '#e6ae31', '#f05b43']; frame.reflection = .3;
  }
  if (id === 'electric') {
    frame.ink = 11 * accent; frame.scale = 1.015 + .007 * kick;
    frame.palette = ['#00bfd1', '#8278e8', '#ff586f']; frame.reflection = .25; frame.glow = .3 + .7 * accent;
    frame.ripples = recentContacts(t, data.contacts, .48).slice(-3);
  }
  if (id === 'suspension') {
    frame.ink = 5 * accent; frame.scale = 1.035 - .025 * air + .009 * kick; frame.y = 7 * kick;
    frame.ribbon = true; frame.reflection = .24; frame.palette = ['#29bdb9', '#7686cc', '#ed9974'];
    frame.glow = .15 + .3 * speed;
  }
  if (id === 'graphite') {
    frame.dark = true; frame.background = '#101923'; frame.palette = ['#53e4db', '#71baff', '#ff8c9d'];
    frame.y = 12 * kick; frame.scale = 1.025 + .013 * kick; frame.reflection = .23; frame.glow = .4 + accent;
    frame.ripples = recentContacts(t, data.contacts, .48).slice(-3);
  }
  if (id === 'arc-light') {
    frame.dark = true; frame.background = '#111c2b'; frame.backgroundRgb = '17,28,43';
    frame.surface = {core: '#fff9e7', shadow: '#40d9ea', offset: 8 * accent, halo: '#69a9db', haloRadius: 1.5 + 4 * accent};
    frame.palette = ['#43d6ce', '#73aafa', '#f2be6a']; frame.reflection = .12;
    frame.y = 18 * kick; frame.scale = 1.03 + .025 * kick;
  }
  if (id === 'cut-paper') {
    frame.background = '#f8f1e5'; frame.backgroundRgb = '248,241,229';
    frame.surface = {core: '#243e42', shadow: '#c7a183', offset: 6, shadowBlur: 1.8};
    frame.spectrumForm = 'blocks'; frame.palette = ['#218f91', '#cf704c', '#d5a341'];
    frame.scale = 1.018 + .008 * kick; frame.y = 5 * kick; frame.reflection = 0;
  }
  if (id === 'edges') {
    frame.surface = {core: '#273f4b'}; frame.spectrumForm = 'rails';
    frame.palette = ['#169f9e', '#bf7b65', '#6578b6']; frame.reflection = 0;
    frame.scale = 1.018 + .008 * kick;
  }
  if (id === 'atlas') {
    frame.background = '#f7faf6'; frame.backgroundRgb = '247,250,246';
    frame.surface = {core: '#173f46'}; frame.spectrumForm = 'contours';
    frame.palette = ['#32928d', '#63849e', '#cf9767']; frame.reflection = 0;
  }
  if (id === 'memory') {
    frame.dark = true; frame.background = '#101b2a'; frame.backgroundRgb = '16,27,42';
    frame.surface = {core: '#e4f8fc', halo: '#59a8cb', haloRadius: 1.5};
    frame.spectrumForm = 'memory'; frame.palette = ['#69d5d5', '#9a9deb', '#f5a6b3']; frame.reflection = 0;
    frame.scale = 1.02 + .007 * kick;
  }
  if (id === 'filament') {
    frame.dark = true; frame.background = '#1c1425'; frame.backgroundRgb = '28,20,37';
    frame.surface = {core: '#fff8df', halo: '#c68cff', haloRadius: 3 + 4 * accent};
    frame.spectrumForm = 'stems'; frame.palette = ['#ffbd72', '#e7acdf', '#a4a4ff']; frame.reflection = .12;
    frame.scale = 1.018 + .009 * kick; frame.y = 5 * kick;
  }
  if (id === 'stamps') {
    frame.surface = {core: '#242638', weight: accent};
    frame.spectrumForm = 'blocks'; frame.palette = ['#1da9a8', '#e58532', '#d5486f']; frame.reflection = 0;
  }
  if (id === 'tuning') {
    frame.background = '#f4f8fb'; frame.backgroundRgb = '244,248,251';
    frame.surface = {core: '#293857'}; frame.spectrumForm = 'stems';
    frame.palette = ['#328ca0', '#7787b7', '#c47a85']; frame.reflection = 0;
  }
  if (id === 'aurora') {
    frame.dark = true; frame.background = '#101b26'; frame.backgroundRgb = '16,27,38';
    frame.surface = {core: '#edfbfa', halo: '#76cdd6', haloRadius: 2 + accent};
    frame.atmosphere = {color: '#278d9a', second: '#80549d', amount: .28 + .14 * air, position: 35 + 25 * air};
    frame.ribbon = true; frame.palette = ['#6addc4', '#8ebcf0', '#d49ae0']; frame.reflection = 0;
    frame.scale = 1.035 - .025 * air + .006 * kick;
  }
  if (id === 'risograph') {
    frame.background = '#fff1e9'; frame.backgroundRgb = '255,241,233';
    frame.surface = {core: '#273f62', shadow: '#ef796c', offset: 3 + 4 * accent};
    frame.spectrumForm = 'blocks'; frame.palette = ['#477992', '#b85561', '#df9060']; frame.reflection = 0;
  }
  if (id === 'phosphor') {
    frame.dark = true; frame.background = '#111f20'; frame.backgroundRgb = '17,31,32';
    frame.surface = {core: '#e2ffeb', halo: '#79e6ad', haloRadius: 2};
    frame.spectrumForm = 'dots'; frame.palette = ['#68e0b1', '#a8e3ac', '#e6d89d']; frame.reflection = 0;
    frame.scale = 1.018 + .008 * kick;
  }
  if (id === 'fan') {
    frame.background = '#fff7ef'; frame.backgroundRgb = '255,247,239';
    frame.surface = {core: '#543d3c'}; frame.spectrumForm = 'fan';
    frame.palette = ['#b36a55', '#b78e54', '#568d95']; frame.reflection = 0;
  }
  if (id === 'registration') {
    frame.background = '#fff5e8'; frame.backgroundRgb = '255,245,232';
    frame.surface = {core: '#2d3f52', shadow: '#df8b77', highlight: '#7cb9bb', offset: 3.5 * (1 - Math.min(1, accent * 1.8))};
    frame.spectrumForm = 'caps'; frame.palette = ['#409f9d', '#cd925a', '#b67585']; frame.reflection = 0;
  }
  if (id === 'daybreak') {
    frame.background = '#fbf6e9'; frame.backgroundRgb = '251,246,233';
    frame.surface = {core: '#264f5c'};
    frame.atmosphere = {color: '#77bcb5', second: '#efb574', amount: .14 + .1 * air, position: 35 + 25 * air};
    frame.spectrumForm = 'contours'; frame.palette = ['#259e9a', '#6987b1', '#c66c49']; frame.reflection = 0;
    frame.scale = 1.035 - .025 * air + .008 * accent;
  }
  if (id === 'press-pop') {
    frame.background = '#fff2ce'; frame.backgroundRgb = '255,242,206';
    frame.surface = {core: '#263c4c', weight: .5 * accent};
    frame.spectrumForm = 'pleats'; frame.palette = ['#169b96', '#dd9251', '#d26758']; frame.reflection = 0;
    frame.scale = 1.012 + .028 * accent;
  }
  if (id === 'side-glide') {
    frame.background = '#eff8f4'; frame.backgroundRgb = '239,248,244';
    frame.surface = {core: '#263f52'}; frame.spectrumForm = 'caps';
    frame.palette = ['#20a398', '#df9551', '#bd6888']; frame.reflection = 0;
    frame.x = 12 * kick; frame.rotation = .22 * kick; frame.scale = 1.045;
  }
  if (id === 'living-ink') {
    frame.background = '#fff7ed'; frame.backgroundRgb = '255,247,237';
    // Both endpoints stay dark. This is an artistic ink pulse, never a force ruler.
    const u = Math.min(1, accent * 1.6);
    frame.surface = {core: `rgb(${Math.round(28 + 87 * u)},${Math.round(79 - 34 * u)},${Math.round(83 - 17 * u)})`};
    frame.spectrumForm = 'caps'; frame.palette = ['#209e96', '#d78347', '#b05c83']; frame.reflection = 0;
  }
  if (id === 'letterpress') {
    frame.background = '#f6edcf'; frame.backgroundRgb = '246,237,207';
    frame.surface = {core: '#344d46', shadow: '#b89c6b', highlight: '#fffcef', offset: 2.5 + .7 * accent};
    frame.spectrumForm = 'pleats'; frame.palette = ['#4f9688', '#c6a257', '#c27558']; frame.reflection = 0;
  }
  if (id === 'sunprint') {
    frame.background = '#fff0b4'; frame.backgroundRgb = '255,240,180';
    frame.surface = {core: '#204d89'}; frame.spectrumForm = 'dots';
    frame.palette = ['#14958e', '#dd6637', '#b36a71']; frame.reflection = 0;
    frame.scale = 1.015 + .012 * accent;
  }
  if (id === 'cobalt-poster') {
    frame.background = '#f7f9fc'; frame.backgroundRgb = '247,249,252';
    frame.surface = {core: '#213859', shadow: '#2aa9b7', offset: 5 * accent};
    frame.spectrumForm = 'slits'; frame.palette = ['#2456a6', '#2456a6']; frame.reflection = 0;
    frame.scale = 1.014 + .02 * accent;
  }
  if (id === 'mint-relief') {
    frame.background = '#eef7f3'; frame.backgroundRgb = '238,247,243';
    const offset = 4 * (1 - .65 * accent);
    frame.surface = {core: '#493a5f', shadow: '#b3a4cb', offset};
    frame.spectrumShadow = {color: '#b3a4cb', offset};
    frame.spectrumForm = 'blocks'; frame.palette = ['#497c82', '#72638d', '#497c82']; frame.reflection = 0;
  }
  if (id === 'iris-weave') {
    frame.background = '#f6f4fb'; frame.backgroundRgb = '246,244,251';
    frame.surface = {core: '#293e59'};
    frame.spectrumForm = 'weave'; frame.palette = ['#485a91', '#817e9e']; frame.reflection = 0;
    frame.scale = 1.035 - .025 * air;
  }
  if (id === 'magenta-signal') {
    frame.background = '#f9fafc'; frame.backgroundRgb = '249,250,252';
    frame.surface = {core: '#26313d', shadow: '#bd3f86', offset: 4 * accent};
    frame.spectrumForm = 'crest'; frame.palette = ['#bd3f86', '#bd3f86']; frame.reflection = 0;
  }
  if (['cobalt-clear', 'mint-clear', 'silver-tuning', 'iris-terraces', 'graphite-mirror', 'porcelain-mirror', 'electric-registration'].includes(id)) {
    frame.fx = {}; frame.background = '#fafbfd'; frame.backgroundRgb = '250,251,253';
    frame.surface = {core: '#202631'}; frame.reflection = 0;
    frame.spectrumLayout = {center: .79, height: .15};
  }
  if (id === 'cobalt-clear') {
    frame.spectrumForm = 'slits'; frame.palette = ['#315ca4', '#315ca4'];
    frame.scale = 1 + .035 * accent;
  }
  if (id === 'mint-clear') {
    frame.background = '#f6faf8'; frame.backgroundRgb = '246,250,248';
    frame.surface = {core: '#24232b', weight: .25 * accent};
    frame.spectrumForm = 'blocks'; frame.palette = ['#488d91', '#75739b', '#488d91'];
  }
  if (id === 'silver-tuning') {
    frame.background = '#fcfcfd'; frame.backgroundRgb = '252,252,253';
    frame.spectrumForm = 'needles'; frame.palette = ['#66849c', '#6e75a3', '#8799ad'];
    frame.spectrumLayout = {center: .81, height: .14};
  }
  if (id === 'iris-terraces') {
    frame.background = '#f8f8fc'; frame.backgroundRgb = '248,248,252';
    frame.spectrumForm = 'terraces'; frame.palette = ['#65618f', '#807e98'];
    frame.spectrumLayout = {center: .82, height: .13};
    frame.scale = 1.02 - .02 * air;
  }
  if (id === 'graphite-mirror') {
    frame.dark = true; frame.background = '#111923'; frame.backgroundRgb = '17,25,35';
    frame.surface = {core: '#fafcff'}; frame.palette = ['#6dcac9', '#94bce5', '#c8b1db'];
    frame.reflection = .38; frame.y = 13 * kick; frame.scale = 1.025 + .016 * kick;
    frame.spectrumLayout = {center: .76, height: .16};
  }
  if (id === 'porcelain-mirror') {
    frame.background = '#ffffff'; frame.backgroundRgb = '255,255,255';
    frame.palette = ['#66a7ac', '#8b99be', '#c095a3']; frame.reflection = .32;
    if (accent > .015) frame.surface = {core: '#202631', shadow: '#489ca5', offset: 7 * accent};
    frame.spectrumLayout = {center: .77, height: .16};
  }
  if (id === 'electric-registration') {
    frame.background = '#ffffff'; frame.backgroundRgb = '255,255,255';
    frame.spectrumForm = 'blocks'; frame.palette = ['#489ca5', '#8376b5', '#b572a1'];
    if (accent > .015) frame.surface = {core: '#202631', shadow: '#28aab4', highlight: '#af5c94', offset: 11 * accent};
    frame.scale = 1 + .022 * accent;
  }
  return frame;
}
