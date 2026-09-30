/** Small matched research passages, separate from every frozen benchmark catalog. */
import {sliceTimeline} from '../v0/core/substrate.ts';
import type {Case} from '../../benchmark/v3/model.ts';

// The last two passages were defined after the initial controller/shape probes.
export type GalleryCaseDefinition={id:string;title:string;duration:number;beats:number[];air:number[];speed:number[];amplitude:number[];impact:number[]};
const definitions:GalleryCaseDefinition[] = [
  {id: 'even-catches', title: 'Even catches', duration: 6, beats: [.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6],
    air: [.5], speed: [.55], amplitude: [.14], impact: [.45]},
  {id: 'alternating-lift', title: 'Alternating lift', duration: 6.4, beats: [.55, 1.35, 2.05, 2.9, 3.5, 4.4, 5.15, 5.9],
    air: [.3, .65], speed: [.42, .66], amplitude: [.08, .2], impact: [.3, .65]},
  {id: 'quick-pickups', title: 'Quick pickups', duration: 5, beats: [.5, .8, 1.4, 1.7, 2.3, 2.6, 3.2, 3.5, 4.1, 4.4],
    air: [.4], speed: [.6], amplitude: [.08], impact: [.4]},
  {id: 'quiet-tail', title: 'Quiet tail', duration: 9, beats: [.75, 1.5, 2.4, 3.2],
    air: [.4], speed: [.5], amplitude: [.13], impact: [.5]},
  {id: 'slow-swell', title: 'Slow swell', duration: 8, beats: [.9, 2, 3.3, 4.45, 5.4, 6.6, 7.5],
    air: [.4, .6], speed: [.38, .6], amplitude: [.09, .18], impact: [.25, .55]},
  {id: 'staccato-release', title: 'Staccato release', duration: 7.8, beats: [.55, .9, 1.7, 2.05, 2.85, 3.2, 4.2, 4.55],
    air: [.35], speed: [.5], amplitude: [.07], impact: [.35]},
];
export function makeGalleryCase(d:GalleryCaseDefinition,source='scripts/gallery/cases.ts'):Case {
  const durationFrames = Math.round(d.duration * 40), frames = d.beats.map(t => Math.round(t * 40));
  const gaps = sliceTimeline(frames, durationFrames);
  const values = (axis: 'speed' | 'amplitude') => Array.from({length: durationFrames + 1}, (_, f) => {
    const i = gaps.findIndex(g => f <= g.endFrame);
    return d[axis][i % d[axis].length];
  });
  return {id: d.id, title: d.title, parentId: d.id, group: 'gallery', stratum: 'gallery',
    provenance: {kind: 'new_program', source, brief: 'Matched geometry research; outside the canonical catalog.'},
    phases: [], durationFrames, preroll: 5,
    contacts: frames.map((frame, i) => ({frame, impact: d.impact[i % d.impact.length]})),
    samples: {speed: values('speed'), amplitude: values('amplitude')},
    air: gaps.map((g, i) => {
      const samples = g.endFrame - g.startFrame + 1, requested = d.air[i % d.air.length];
      const airborneFrames = Math.round(samples * requested);
      return {gap: i, samples, requested, airborneFrames, target: airborneFrames / samples, adjustment: 'quantization'};
    })};
}
export const galleryCases: Case[] = definitions.map(d=>makeGalleryCase(d));
