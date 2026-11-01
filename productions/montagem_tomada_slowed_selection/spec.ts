/** Hand-authored listening draft. Source excerpt and intent: source.json.
 * Explicit gesture choices and omissions: composition.json. Detector timestamps
 * are evidence, not verified syllables; owner listening review is still pending.
 */
import {readFileSync} from 'node:fs';
import type {Spec} from '../../scripts/v0/types.ts';
import {keyframes} from '../../scripts/v0/core/curves.ts';

type Composition = {
  phases: {t: number; name: string; air: number; speed: number; ease: 'hold' | 'smooth'}[];
  groups: {source: string; impact: number; times: number[]; reason: string}[];
};
const composition = JSON.parse(readFileSync(new URL('./composition.json', import.meta.url), 'utf8')) as Composition;
export const evidence = composition.groups.flatMap(g => g.times.map(t => ({t, impact: g.impact, source: g.source, reason: g.reason})))
  .sort((a, b) => a.t - b.t);
const duration = 58.0;
export const overlayMeta = {title: "MONTAGEM TOMADA (Slowed)", artist: '', tempo: 'Tempo grid is an analysis hypothesis',
  phases: composition.phases.map((p, i, all) => ({name: p.name, t0: p.t, t1: all[i + 1]?.t ?? duration,
    color: ['#3a5f8a', '#d4843a', '#5f7892', '#c4483f'][i % 4]}))};
const lane = (axis: 'air' | 'speed') => keyframes(composition.phases.map(p => ({t: p.t, v: p[axis], ease: p.ease})));
const spec: Spec = {
  duration, preroll: 2,
  music: {audio: 'productions/montagem_tomada_slowed_selection/audio.mp3', title: "MONTAGEM TOMADA (Slowed)",
    beats: 'productions/montagem_tomada_slowed_selection/audio.json',
    spectrogram: {image: 'productions/montagem_tomada_slowed_selection/spectrogram.png', metadata: 'productions/montagem_tomada_slowed_selection/spectrogram.json'}},
  contacts: evidence.map(({t, impact}) => ({t, impact})),
  axes: {air: lane('air'), speed: lane('speed')},
  camera: {beatPunch: {threshold: .7, amp: .11, floor: .5, decay: 4, attack: 1, dir: 'in'}},
};
export default spec;
