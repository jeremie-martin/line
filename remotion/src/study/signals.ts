/** Deterministic presentation signals. Time is in seconds; strengths/asks are [0,1]. */
import type {ImpactContact} from '../impact';
export type TargetAxis = {axis: string; target: {t: number; v: number}[]};
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Sample an authored lane, not instantaneous realized motion. */
export function targetAt(axes: readonly TargetAxis[], axis: string, t: number): number | null {
  const points = axes.find(a => a.axis === axis)?.target;
  if (!points?.length) return null;
  let lo = 0, hi = points.length - 1;
  while (lo < hi) {const mid = Math.ceil((lo + hi) / 2); if (points[mid].t <= t) lo = mid; else hi = mid - 1;}
  const a = points[lo], b = points[Math.min(lo + 1, points.length - 1)];
  const f = a.t === b.t ? 0 : clamp01((t - a.t) / (b.t - a.t));
  return clamp01(a.v + (b.v - a.v) * f);
}

/** Causal 0.7s moving average: no anticipation of a future authored transition. */
export function phraseAt(axes: readonly TargetAxis[], axis: string, t: number): number {
  const values = Array.from({length: 8}, (_, i) => targetAt(axes, axis, Math.max(0, t - i * .1))).filter((v): v is number => v !== null);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : .5;
}

export function recentContacts(t: number, contacts: readonly ImpactContact[], duration = .65) {
  return contacts.flatMap(c => {
    const strength = c.impactMeasured, onset = c.actualTime ?? c.t, age = t - onset;
    return strength !== null && Number.isFinite(strength) && strength > 0 && age >= 0 && age < duration
      ? [{age, strength: clamp01(strength)}] : [];
  });
}

/** Smooth local-onset accent. Max composition keeps dense runs bounded without auto-normalizing a song. */
export function contactAccent(t: number, contacts: readonly ImpactContact[]): number {
  return clamp01(Math.max(0, ...recentContacts(t, contacts).map(({age, strength}) =>
    Math.pow(strength, 1.25) * (1 - Math.exp(-age / .012)) * Math.exp(-age / .14) * 1.35)));
}

/** One kick and a small rebound, always phase-locked to the measured contact. */
export function contactKick(t: number, contacts: readonly ImpactContact[]): number {
  let result = 0;
  for (const {age, strength} of recentContacts(t, contacts, .5)) {
    const v = Math.pow(strength, 1.25) * Math.exp(-age / .11) * Math.sin(age * Math.PI * 2 * 5) * 1.7;
    result += v;
  }
  // A continuous signed sum avoids flipping between opposite overlapping kicks.
  return Math.tanh(1.2 * result);
}
