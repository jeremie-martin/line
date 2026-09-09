import { describe, expect, test } from 'vitest';
import { scoreObservations, summarize, type Observation } from '../benchmark/v3/evaluator.ts';
import { loadCases, caseGaps, caseSpec, targets } from '../benchmark/v3/model.ts';
import { effectiveAxes, validateSpec } from '../scripts/v0/core/substrate.ts';

const observation = (axis: Observation['axis'], frames: number, error: number, tail = false): Observation => ({ gap: tail ? 1 : 0, startFrame: 0, endFrame: frames, tail, axis, target: 0, achieved: error, error });
describe('V3 explicit scoring contract', () => {
  test('a long authored ending changes the span score without creating an impact target', () => {
    const rows = [observation('air', 40, 0), observation('air', 160, .5, true), observation('impact', 40, 0)];
    const full = scoreObservations(rows, []), beat = scoreObservations(rows, [], 'contact_equal');
    expect(beat.score).toBe(1000);
    expect(full.components.air!.weightSum).toBe(200);
    expect(full.components.impact!.observations).toBe(1);
    expect(full.weightedAxisRms).toBeCloseTo(Math.sqrt(.5 * .2));
    expect(full.score).toBeLessThan(beat.score);
  });
  test('span subdivision preserves time influence; impact remains event-weighted', () => {
    const a = scoreObservations([observation('speed', 200, .2), observation('speed', 40, .1)], []);
    const b = scoreObservations([...Array.from({ length: 5 }, () => observation('speed', 40, .2)), observation('speed', 40, .1)], []);
    expect(a.score).toBe(b.score);
    const impact = scoreObservations([observation('impact', 200, .2), observation('impact', 40, .1)], []);
    expect(impact.components.impact!.weightSum).toBe(2);
  });
  test('missing tail measurements and physical failures invalidate the run', () => {
    expect(scoreObservations([{ ...observation('air', 200, 0, true), achieved: null, error: null }], []).valid).toBe(false);
    expect(scoreObservations([observation('air', 40, 0)], ['off_beat_landings:1']).score).toBe(0);
  });
  test('undefined axes carry no weight', () => {
    const s = scoreObservations([observation('speed', 40, .1)], []);
    expect(s.components.speed!.weight).toBe(1);
    expect(s.components.amplitude).toBeUndefined();
    expect(s.score).toBeCloseTo(1000 * Math.exp(-.4), 3);
  });
  test('catalog targets agree with the unchanged compiler input API, including tails', () => {
    const cases = loadCases(); expect(cases).toHaveLength(88);
    for (const c of cases) {
      const spec = caseSpec(c);
      expect(() => validateSpec(spec)).not.toThrow();
      for (const gap of caseGaps(c)) {
        expect(effectiveAxes(gap, spec).air).toBeCloseTo(targets(c, gap).air!, 10);
        if (!gap.endsWithContact) expect(targets(c, gap).impact).toBeUndefined();
      }
    }
  });
  test('incomplete panels and duplicate seed records cannot become headlines', () => {
    const cases = loadCases();
    expect(() => summarize([], cases, [16, 17])).toThrow(/incomplete/);
    const score = scoreObservations([observation('air', 40, 0)], []);
    const rows = cases.flatMap(c => [16, 17].map(seed => ({ sourceId: c.id, seed, score, trackHash: c.id })));
    expect(summarize(rows, cases, [16, 17]).headline).toBe(1000);
    rows[1].seed = 16;
    expect(() => summarize(rows, cases, [16, 17])).toThrow(/duplicate/);
  });
});
