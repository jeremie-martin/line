import { expect, it } from 'vitest';
import { compileArcMotion } from '../scripts/v0/optimizer/arc_motion.ts';
import type { Spec } from '../scripts/v0/types.ts';

const spec: Spec = { duration: 4, preroll: 5, jitter: 0,
  contacts: [.6, 1.2, 1.8, 2.4, 3, 3.6].map(t => ({t, impact: .4})),
  axes: {air: () => .5, speed: () => .5} };
const options = { samples: 32, channel: 12, radius: 24, 
  impactWeight: 1, amplitudeWeight: 1 / 3, 
  arrivalWeight: .3, headingWeight: .3, };

it('keeps the physically validated final curve when another proposal hits the frame limit', () => {
  const result = compileArcMotion(spec, 17, {...options, budget: 4250});
  expect(result.searchBudgetExhausted).toBe(true);
  expect(result.budgetInterruptions.at(-1)).toMatchObject({index: 6, retained: true});
  expect(result.budgetInterruptions.at(-1)!.viable).toBeGreaterThan(0);
  expect(result.failure).toBeNull();
  expect(result.report.contacts.every(c => c.status === 'hit')).toBe(true);
  expect(result.report.off_beat_landings).toHaveLength(0);
  expect(result.report.terminus.reason).toBe('endOfSpec');
  expect(result.track.lines.every(l => l.type === 0)).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(4250);
});

it('does not invent a usable curve when the first proposal cannot finish', () => {
  const result = compileArcMotion(spec, 17, {...options, budget: 372});
  expect(result.failure?.reason).toBe('budget');
  expect(result.budgetInterruptions.at(-1)).toMatchObject({viable: 0, retained: false});
  expect(result.report.contacts.some(c => c.status !== 'hit')).toBe(true);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(372);
});

it('commits a validated final curve without spending another frame to remember its arrival', () => {
  const result = compileArcMotion(spec, 17, {...options, memorySamples: 4, budget: 2500});
  expect(result.failure).toBeNull();
  expect(result.rows).toHaveLength(spec.contacts.length + 1);
  expect(result.budgetInterruptions.at(-1)).toMatchObject({index: 6, retained: true});
  expect(result.report.contacts.every(c => c.status === 'hit')).toBe(true);
  expect(result.report.off_beat_landings).toHaveLength(0);
  expect(result.report.terminus.reason).toBe('endOfSpec');
  expect(result.stats.sim_frames).toBeLessThanOrEqual(2500);
});

it('propagates non-budget evaluation errors', () => {
  expect(() => compileArcMotion(spec, 17, {...options, budget: 10000,
    futureValueModel: {featureSchema: 'invalid'}})).toThrow('arc future-value feature mismatch');
});
