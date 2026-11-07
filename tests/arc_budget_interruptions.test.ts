import { expect, it } from 'vitest';
import { compileArcMotion } from '../scripts/v0/optimizer/arc_motion.ts';
import type { Spec } from '../scripts/v0/types.ts';

const spec: Spec = { duration: 4, preroll: 5,
  contacts: [.6, 1.2, 1.8, 2.4, 3, 3.6].map(t => ({t, impact: .4})),
  axes: {air: () => .5, speed: () => .5} };
const options = { samples: 32, channel: 12, radius: 24, 
  impactWeight: 1, amplitudeWeight: 1 / 3, 
  arrivalWeight: .3, headingWeight: .3, };

it('keeps the physically validated final curve when another proposal hits the frame limit', () => {
  // 1850: the allowance that runs out while the last support is being searched, after a valid curve was found
  // (re-derived when local search began judging like ranking, 2026-11-07: 1750-1950 hold; it was 2000 after the
  // prediction was halved, 3400 after the forced flight before a catch was removed, and 3100 before).
  const result = compileArcMotion(spec, 17, {...options, budget: 1850});
  expect(result.searchBudgetExhausted).toBe(true);
  expect(result.budgetInterruptions.at(-1)).toMatchObject({index: 6, retained: true});
  expect(result.budgetInterruptions.at(-1)!.viable).toBeGreaterThan(0);
  expect(result.failure).toBeNull();
  expect(result.impactEvaluation.valid).toBe(true);
  expect(result.report.terminus.reason).toBe('endOfSpec');
  expect(result.track.lines.every(l => l.type === 0)).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(1850);
});

it('does not invent a usable curve when the first proposal cannot finish', () => {
  const result = compileArcMotion(spec, 17, {...options, budget: 372});
  expect(result.failure?.reason).toBe('budget');
  expect(result.budgetInterruptions.at(-1)).toMatchObject({viable: 0, retained: false});
  expect(result.report.contacts.some(c => c.status !== 'hit')).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(372);
});

it('commits a validated final curve without spending another frame to remember its arrival', () => {
  // 1925: re-derived when local search began judging like ranking, 2026-11-07 (1850-2025 hold; it was 2100).
  const result = compileArcMotion(spec, 17, {...options, memorySamples: 4, budget: 1925});
  expect(result.failure).toBeNull();
  expect(result.rows).toHaveLength(spec.contacts.length + 1);
  expect(result.budgetInterruptions.at(-1)).toMatchObject({index: 6, retained: true});
  expect(result.impactEvaluation.valid).toBe(true);
  expect(result.report.terminus.reason).toBe('endOfSpec');
  expect(result.stats.sim_frames).toBeLessThanOrEqual(1925);
});

it('propagates non-budget evaluation errors', () => {
  expect(() => compileArcMotion(spec, 17, {...options, budget: 10000,
    futureValueModel: {featureSchema: 'invalid'}})).toThrow('arc future-value feature mismatch');
});
