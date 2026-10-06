import {expect, it, vi} from 'vitest';
import type {ArcCompileContext} from '../scripts/v0/optimizer/arc_compile_context.ts';

// An exact finite search graph isolates recovery from geometry and random search.
// Only the 56th measured arrival can reach the final support.
const graph = vi.hoisted(() => ({frames: 0, finalAttempts: [] as number[]}));
vi.mock('../scripts/lib/native_motion/engine.ts', () => ({LineRiderEngine: {retainOnly() {}}}));
vi.mock('../scripts/lib/detector.ts', () => ({
  getPhysicsFrameCount: () => graph.frames,
  PhysicsFrameLimitExceeded: class extends Error {},
}));
vi.mock('../scripts/v0/optimizer/arc_interval.ts', () => ({
  searchInterval(_ctx: unknown, engine: {lines: {id: number}[]}, index: number) {
    graph.frames += 100;
    const arrival = engine.lines.at(-1)?.id ?? 0;
    if (index === 2) {
      graph.finalAttempts.push(arrival);
      if (arrival !== 55) return null;
    }
    const ids = index === 2 ? [64] : Array.from({length: 8}, (_, j) => (index ? arrival * 8 : 0) + j);
    const candidates = ids.map(id => ({lines: [{id}], c: {}, cost: id, localCost: id,
      heading: id * 5, endSpeed: 0, pose: 0, meta: {release: 0},
      terminalLoss: 0, measurement: {achieved: {}, actualImpact: 0, release: 0}}));
    return {best: candidates[0], candidates, failures: {}, frame: index * 10,
      next: (index + 1) * 10, horizon: (index + 1) * 10, span: 10, inputFeatures: [], incoming: {}};
  },
}));

import {runIntervalSequence, startSequence} from '../scripts/v0/optimizer/arc_sequence.ts';

it('can finish through a measured arrival beyond the first recovery batch', () => {
  graph.frames = 0;
  graph.finalAttempts.length = 0;
  const work = {backtracks: 0, planningDecisions: [] as {beamWidth: number}[], budgetInterruptions: []};
  const ctx = {contacts: [0, 10, 20].map(frame => ({frame})), end: 30,
    budget: 1_000_000, options: {samples: 80}, work,
    lineage: {rebuild: (lines: unknown[]) => ({lines}),
      add: (engine: {lines: unknown[]}, lines: unknown[]) => ({lines: [...engine.lines, ...lines]}),
      detach: (engine: unknown) => engine},
  } as unknown as ArcCompileContext;
  const seq = startSequence(ctx);
  runIntervalSequence(ctx, seq);
  expect(seq.failure).toBeNull();
  expect(seq.rows).toHaveLength(3);
  expect(seq.lines.at(-2)?.id).toBe(55);
  expect(work.backtracks).toBeGreaterThan(1);
  expect(work.planningDecisions.every(d => d.beamWidth <= 8)).toBe(true);
  // Consumed alternatives are not retried when another batch is reopened.
  expect(new Set(graph.finalAttempts).size).toBe(graph.finalAttempts.length);
});
