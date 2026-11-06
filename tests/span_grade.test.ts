import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { scoreObservations, type Observation } from '../scripts/lib/span_grade.ts';
import { caseGaps, caseSpec, targets, type Case } from '../scripts/lib/case.ts';
import { effectiveAxes, validateSpec } from '../scripts/v0/core/substrate.ts';

const observation = (axis: Observation['axis'], frames: number, error: number, tail = false): Observation => ({ gap: tail ? 1 : 0, startFrame: 0, endFrame: frames, tail, axis, target: 0, achieved: error, error });
describe('span scoring contract', () => {
  test('a long authored ending changes the span score without creating an impact target', () => {
    const rows = [observation('air', 40, 0), observation('air', 160, .5, true), observation('impact', 40, 0)];
    const full = scoreObservations(rows, []);
    expect(full.components.air!.weightSum).toBe(200);
    expect(full.components.impact!.observations).toBe(1);
    expect(full.weightedAxisRms).toBeCloseTo(Math.sqrt(.5 * .2));
    expect(full.score).toBeLessThan(1000);
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
  test('case targets agree with the compiler input API, including tails', () => {
    const fixture = JSON.parse(gunzipSync(readFileSync('tools/parity/cases.json.gz')).toString());
    for (const c of Object.values(fixture.music) as Case[]) {
      const spec = caseSpec(c);
      expect(() => validateSpec(spec)).not.toThrow();
      for (const gap of caseGaps(c)) {
        expect(effectiveAxes(gap, spec).air).toBeCloseTo(targets(c, gap).air!, 10);
        if (!gap.endsWithContact) expect(targets(c, gap).impact).toBeUndefined();
      }
    }
  });
});
