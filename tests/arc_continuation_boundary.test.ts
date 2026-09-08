import { expect, it } from 'vitest';
import { compileArcMotion } from '../scripts/v0/optimizer/arc_motion.ts';
import { connectedArcOptions } from '../scripts/v0/optimizer/connected_arcs.ts';
import type { Spec } from '../scripts/v0/types.ts';

const spec: Spec = { duration: 4, preroll: 5, jitter: 0,
  contacts: [.6, 1.2, 1.8, 2.4, 3, 3.6].map(t => ({t, impact: .4})),
  axes: {air: () => .5, speed: () => .5} };

it('treats zero as omitted and meters physically valid learned boundary search', () => {
  const options = {...connectedArcOptions(spec, 75000), continuationValueWeight: undefined};
  const reference = compileArcMotion(spec, 17, options);
  const disabled = compileArcMotion(spec, 17, {...options, continuationValueWeight: 0});
  expect(disabled.track).toEqual(reference.track);
  expect(disabled.report).toEqual(reference.report);
  expect(disabled.stats).toEqual(reference.stats);
  const result = compileArcMotion(spec, 17, {...options, continuationValueWeight: .25});
  expect(result.lookaheadStats.probes).toBeGreaterThan(0);
  expect(result.stats.sim_frames).toBeLessThanOrEqual(options.budget);
  expect(result.failure).toBeNull();
  expect(result.report.terminus.reason).toBe('endOfSpec');
  expect(result.report.contacts.every(c => c.status === 'hit')).toBe(true);
  expect(result.report.off_beat_landings).toHaveLength(0);
  expect(result.track.lines.every(l => l.type === 0)).toBe(true);
});
