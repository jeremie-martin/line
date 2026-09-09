import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { Spec, Gap, AxisValues } from '../../scripts/v0/types.ts';
import { sliceTimeline } from '../../scripts/v0/core/substrate.ts';

export type SpanAxis = 'air' | 'speed' | 'amplitude';
export type Axis = SpanAxis | 'impact';
export type Case = {
  id: string; title: string; parentId: string; group: string; stratum: string;
  provenance: { kind: 'v2_bridge' | 'new_program' | 'exposed_music_reference'; source: string; grammar?: string; brief: string };
  phases: Array<{ id: string; start: number; end: number; intent: string }>;
  durationFrames: number; preroll: number; start?: Spec['start'];
  contacts: Array<{ frame: number; impact?: number }>;
  samples: Partial<Record<'speed' | 'amplitude', Array<number | null>>>;
  air: Array<{ gap: number; airborneFrames: number; samples: number; requested: number; target: number; adjustment: 'quantization' | 'landing_floor' | 'contact_support_ceiling' }>;
};
export const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
export function loadCases(): Case[] {
  const bytes = readFileSync(new URL('./specifications.json.gz', import.meta.url));
  const lock = JSON.parse(readFileSync(new URL('./catalog.lock.json', import.meta.url), 'utf8'));
  assert.equal(sha(bytes), lock.compressedSha256);
  const raw = gunzipSync(bytes); assert.equal(sha(raw), lock.specificationsSha256);
  return JSON.parse(raw.toString());
}
export function caseGaps(c: Case): Gap[] { return sliceTimeline(c.contacts.map(x => x.frame), c.durationFrames); }
export function sampledCurve(values: Array<number | null>): (t: number) => number | undefined {
  return t => {
    const p = Math.max(0, Math.min(values.length - 1, t * 40));
    const nearest = Math.round(p);
    if (Math.abs(p - nearest) < 1e-9) return values[nearest] ?? undefined;
    const lo = Math.floor(p), hi = Math.ceil(p), a = values[lo], b = values[hi];
    return a === null || b === null ? undefined : a + (b - a) * (p - lo);
  };
}
export function caseSpec(c: Case): Spec {
  // Counts are already authored and frozen in the catalog. No target repair
  // occurs in the evaluator or compiler. Boundary samples are grounded; the
  // interior encodes the requested interval mean in the existing Spec API.
  const air = Array<number | null>(c.durationFrames + 1).fill(0), gaps = caseGaps(c);
  for (const request of c.air) {
    const gap = gaps[request.gap], interior = gap.endFrame - gap.startFrame - 1;
    const value = request.airborneFrames / interior;
    assert.ok(interior > 0 && value >= 0 && value <= 1);
    for (let f = gap.startFrame + 1; f < gap.endFrame; f++) air[f] = value;
  }
  return { duration: c.durationFrames / 40, contacts: c.contacts.map(x => ({ t: x.frame / 40, ...(x.impact === undefined ? {} : { impact: x.impact }) })),
    axes: { air: sampledCurve(air), ...Object.fromEntries(Object.entries(c.samples).map(([a, v]) => [a, sampledCurve(v)])) },
    jitter: 0, preroll: c.preroll, ...(c.start ? { start: c.start } : {}) };
}
export function targets(c: Case, gap: Gap): AxisValues {
  const out: AxisValues = { air: c.air[gap.index].target };
  for (const a of ['speed', 'amplitude'] as const) {
    const samples = c.samples[a]; if (!samples) continue;
    const values = samples.slice(gap.startFrame, gap.endFrame + 1).filter((v): v is number => v !== null);
    if (values.length) out[a] = values.reduce((s, v) => s + v, 0) / values.length;
  }
  if (gap.endsWithContact && c.contacts[gap.index].impact !== undefined) out.impact = c.contacts[gap.index].impact;
  return out;
}
