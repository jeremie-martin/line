import { expect, it } from 'vitest';
import { compileArcMotion } from '../scripts/v0/optimizer/arc_motion.ts';
import { compileConnectedArcs } from '../scripts/v0/optimizer/connected_arcs.ts';
import type { Spec } from '../scripts/v0/types.ts';

const spec: Spec = { duration: 4, preroll: 5, jitter: 0,
  contacts: [.6, 1.2, 1.8, 2.4, 3, 3.6].map(t => ({t, impact: .4})),
  axes: {air: () => .5, speed: () => .5} };
const options = { samples: 32, channel: 12, radius: 24, bidirectional: true,
  impactWeight: 1, amplitudeWeight: 1 / 3, arrivalMode: 'speed',
  arrivalWeight: .3, headingWeight: .3, lookaheadWidth: 0, pruneGuidance: true };

it('keeps the physically validated final curve when another proposal hits the frame limit', () => {
  const result = compileArcMotion(spec, 17, {...options, budget: 4800});
  expect(result.searchBudgetExhausted).toBe(true);
  expect(result.budgetInterruptions.at(-1)).toMatchObject({index: 6, retained: true});
  expect(result.budgetInterruptions.at(-1)!.viable).toBeGreaterThan(0);
  expect(result.failure).toBeNull();
  expect(result.report.contacts.every(c => c.status === 'hit')).toBe(true);
  expect(result.report.off_beat_landings).toHaveLength(0);
  expect(result.report.terminus.reason).toBe('endOfSpec');
  expect(result.track.lines.every(l => l.type === 0)).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(4800);
});

it('does not invent a usable curve when the first proposal cannot finish', () => {
  const result = compileArcMotion(spec, 17, {...options, budget: 372});
  expect(result.failure?.reason).toBe('budget');
  expect(result.budgetInterruptions.at(-1)).toMatchObject({viable: 0, retained: false});
  expect(result.report.contacts.some(c => c.status !== 'hit')).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(372);
});

it('commits a validated final curve without spending another frame to remember its arrival', () => {
  const result = compileArcMotion(spec, 17, {...options, memorySamples: 4, budget: 5050});
  expect(result.failure).toBeNull();
  expect(result.rows).toHaveLength(spec.contacts.length + 1);
  expect(result.budgetInterruptions.at(-1)).toMatchObject({index: 6, retained: true});
  expect(result.report.contacts.every(c => c.status === 'hit')).toBe(true);
  expect(result.report.off_beat_landings).toHaveLength(0);
  expect(result.report.terminus.reason).toBe('endOfSpec');
  expect(result.stats.sim_frames).toBeLessThanOrEqual(5050);
});

it('reports exhausted search truthfully even when its retained track completes', () => {
  const result = compileConnectedArcs(spec, 17, {budget: 2400});
  expect(result.report.contacts.every(c => c.status === 'hit')).toBe(true);
  expect(result.stats.budget_exhausted).toBe(true);
  expect(result.budgetTelemetry?.compile.budget_exhausted).toBe(true);
  expect(result.budgetTelemetry?.compile.hard_overrun_frames).toBe(0);
  expect(result.budgetTelemetry?.compile.total_spent_frames).toBe(result.stats.sim_frames);
});

it('propagates non-budget evaluation errors', () => {
  expect(() => compileArcMotion(spec, 17, {...options, budget: 10000,
    futureValueModel: {featureSchema: 'invalid'}})).toThrow('arc future-value feature mismatch');
});
