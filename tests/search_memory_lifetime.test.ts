import {expect, it, vi} from 'vitest';
import * as finalization from '../scripts/v0/optimizer/arc_finalize.ts';
import {compileArcMotion} from '../scripts/v0/optimizer/arc_motion.ts';
import {withSequenceObserver} from '../scripts/v0/optimizer/arc_sequence.ts';
import type {Spec} from '../scripts/v0/types.ts';

const spec: Spec = {duration: 3, preroll: 0, contacts: [.6, 1.2, 1.8, 2.4].map(t => ({t, impact: .4})),
  axes: {air: () => .5, speed: () => .5}};
const options = {budget: 100000, samples: 24, channel: 12, radius: 24};

it.each([1000, 100000])('releases search memo before verification, including interrupted search (budget %i)', async budget => {
  let memoUsed = false;
  const retained: Array<{candidate: unknown; snapshot: unknown}> = [];
  const finalize = finalization.finalizeArcTrack;
  const spy = vi.spyOn(finalization, 'finalizeArcTrack').mockImplementation((ctx, track) => {
    expect(memoUsed).toBe(true);
    expect(ctx.lineage.memoContexts.size).toBe(0);
    for (const {candidate, snapshot} of retained) expect(candidate).toStrictEqual(snapshot);
    return finalize(ctx, track);
  });
  try {
    const result = await withSequenceObserver((_i, _offers, chosen, ctx) => {
      memoUsed ||= [...ctx.lineage.memoContexts.values()].some(m => m.size > 0);
      for (const {candidate} of chosen) retained.push({candidate, snapshot: structuredClone(candidate)});
    }, async () => compileArcMotion(spec, 17, {...options, budget}));
    expect(result.searchBudgetExhausted).toBe(budget === 1000);
    expect(retained.length).toBeGreaterThan(0);
    expect(spy).toHaveBeenCalledOnce();
    expect(result.track.lines.length).toBeGreaterThan(0);
  } finally {spy.mockRestore();}
});

it('can compile identically after final verification fails', () => {
  const baseline = compileArcMotion(spec, 17, options);
  const spy = vi.spyOn(finalization, 'finalizeArcTrack').mockImplementation(ctx => {
    expect(ctx.lineage.memoContexts.size).toBe(0);
    throw new Error('verification failed');
  });
  try {
    expect(() => compileArcMotion(spec, 17, options)).toThrow('verification failed');
  } finally {spy.mockRestore();}
  expect(compileArcMotion(spec, 17, options)).toStrictEqual(baseline);
});
