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
  'motion-only': {label: 'Elastic motion only', description: 'Only the current oscillating shake is replaced by an onset-relative kick; the other approved effects remain.'},
  'ink-only': {label: 'Ink accent only', description: 'Only the RGB split is replaced by short cyan/coral ink edges; the other approved effects remain.'},
  'ribbon-only': {label: 'Spectrum ribbon only', description: 'Only the bars become a continuous frequency silhouette; the approved ride effects and palette remain.'},
} as const;
export type StudyLook = keyof typeof STUDY_LOOKS;
export type StudyData = {contacts: ImpactContact[]; axes: TargetAxis[]};
export type StudyFrame = {
  id: StudyLook; fx: FXConfig; background: string; dark: boolean; palette?: string[];
  ribbon: boolean; reflection: number; glow: number; accent: number;
  scale: number; y: number; ink: number; ripples: {age: number; strength: number}[];
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
  return frame;
}
