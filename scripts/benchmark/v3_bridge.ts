/** Isolate target/scoring changes on the exact 44 original V2 tracks. No compiler runs. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { evaluateTrack, scoreObservations } from '../../benchmark/v3/evaluator.ts';
import { loadCases, sha } from '../../benchmark/v3/model.ts';
import { summarizeDevelopmentBudget } from '../v0/benchmark_v2/evaluator.ts';

const cases = loadCases().filter(c => c.provenance.kind === 'v2_bridge');
const suite = JSON.parse(readFileSync('benchmark/v2/compat/suite-manifest.json', 'utf8'));
const rows: any[] = [];
for (const c of cases) {
  const id = c.id.slice('bridge_'.length), path = `generated/benchmark-v2/arc-850/integrated-public-750k/${id}.json`;
  const bytes = readFileSync(path); assert.equal(sha(bytes), readFileSync(path + '.sha256', 'utf8').trim());
  const original = JSON.parse(bytes.toString()), observed = evaluateTrack(c, original.track);
  const oldTargets = observed.observations.map(o => o.axis === 'air' ? { ...o,
    target: c.air[o.gap].requested, error: o.achieved === null ? null : Math.abs(o.achieved - c.air[o.gap].requested) } : o);
  const originalScore = scoreObservations(oldTargets, observed.score.hardFailures, 'contact_equal').score;
  assert.equal(originalScore, original.score.score, `${id}: original V2 reproduction`);
  rows.push({ id, trackHash: sha(JSON.stringify(original.track)), originalV2: originalScore,
    frozenAirCounts: observed.diagnostics.contactEqual,
    elapsedSpanWeights: observed.diagnostics.contactTime, authoredEndings: observed.score.score,
    observations: observed.observations, valid: observed.score.valid });
  (globalThis as any).gc?.();
}
const views = ['originalV2', 'frozenAirCounts', 'elapsedSpanWeights', 'authoredEndings'];
const summaries = Object.fromEntries(views.map(view => [view, summarizeDevelopmentBudget(rows.map(r => ({ sourceId: r.id, budget: 750000, actualSeed: 16, seedSlot: 0, score: { score: r[view], valid: r.valid } as any })), 750000, suite)]));
assert.equal(summaries.originalV2.score, 852.1248);
const result = { schema: 'line.benchmark-v3.fixed-track-bridge.v1', researchOnly: true,
  note: 'Same 44 original V2 geometries, original V2 hierarchy. Successive target/scoring changes isolated without recompilation. Only originalV2 is the historical V2 headline; none of the other views is the 88-case V3 headline.',
  inputSha256: JSON.parse(readFileSync('benchmark/v3/catalog.lock.json', 'utf8')).specificationsSha256,
  scriptSha256: sha(readFileSync(import.meta.filename)), summaries, rows };
mkdirSync('generated/benchmark-v3', { recursive: true });
const p = 'generated/benchmark-v3/fixed-track-bridge.json', body = JSON.stringify(result) + '\n';
writeFileSync(p, body); writeFileSync(p + '.sha256', sha(body) + '\n');
console.log(JSON.stringify(Object.fromEntries(views.map(v => [v, summaries[v].score]))));
