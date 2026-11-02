/** Curated experiments, opt-in through studyLook. The approved production recipe stays separate. */
import {LOCKED_FX} from '../../../scripts/fx_recipe';
import type {FXConfig} from '../fx';
import type {ImpactContact} from '../impact';
import {contactAccent, contactKick, phraseAt, recentContacts, type TargetAxis} from './signals';

export const STUDY_LOOKS = {
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
  'motion-only': {label: 'Elastic motion only', description: 'Only the current oscillating shake is replaced by an onset-relative kick; the other approved effects remain.'},
  'ink-only': {label: 'Ink accent only', description: 'Only the RGB split is replaced by short cyan/coral ink edges; the other approved effects remain.'},
  'ribbon-only': {label: 'Spectrum ribbon only', description: 'Only the bars become a continuous frequency silhouette; the approved ride effects and palette remain.'},
} as const;
export type StudyLook = keyof typeof STUDY_LOOKS;
export type StudyData = {contacts: ImpactContact[]; axes: TargetAxis[]};
export type StudyFrame = {
  id: StudyLook; fx: FXConfig; background: string; dark: boolean; palette?: string[];
  ribbon: boolean; reflection: number; glow: number; accent: number;
  scale: number; y: number; ink: number;
  spectrumForm?: 'contours' | 'memory' | 'stems' | 'blocks' | 'dots' | 'fan' | 'rails';
  surface?: {core: string; shadow?: string; offset?: number; shadowBlur?: number; halo?: string; haloRadius?: number; weight?: number};
  atmosphere?: {color: string; second: string; amount: number; position: number};
  backgroundRgb?: string; ripples: {age: number; strength: number}[];
};

export function studyFrame(id: string | undefined, t: number, data: StudyData): StudyFrame | null {
  if (!id || id === 'approved') return null;
  if (!(id in STUDY_LOOKS)) throw new Error(`Unknown style study look: ${id}`);
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
  return frame;
}
