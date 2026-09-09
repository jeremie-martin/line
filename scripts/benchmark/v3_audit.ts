import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { developmentCases } from '../../benchmark/v2/catalog.ts';
import { loadCases, caseSpec, caseGaps, targets, sha } from '../../benchmark/v3/model.ts';
import { policy } from '../../benchmark/v3/policy.ts';
import { applyJolt } from '../produce/seed.ts';
import { effectiveAxes, validateSpec } from '../v0/core/substrate.ts';

const cases = loadCases(), seen = new Set<string>();
assert.equal(cases.length, 88);
let intervals = 0, tailSeconds = 0, maximumTargetDiscrepancy = 0;
for (const c of cases) {
  const spec = caseSpec(c), gaps = caseGaps(c);
  validateSpec(spec);
  assert.ok(!seen.has(c.id)); seen.add(c.id);
  assert.ok(policy.strata.find(s => s.id === c.stratum)?.groups.some(g => g.id === c.group));
  assert.equal(c.air.length, gaps.length);
  assert.ok(c.contacts[0].frame >= 6 && c.contacts.at(-1)!.frame < c.durationFrames);
  assert.equal(new Set(c.contacts.map(x => x.frame)).size, c.contacts.length);
  for (const samples of Object.values(c.samples)) {
    assert.equal(samples.length, c.durationFrames + 1);
    assert.ok(samples.every(x => x === null || Number.isFinite(x) && x >= 0 && x <= 1));
  }
  for (const g of gaps) {
    intervals++;
    if (!g.endsWithContact) tailSeconds += (g.endFrame - g.startFrame) / 40;
    const a = c.air[g.index], n = g.endFrame - g.startFrame + 1;
    assert.equal(a.samples, n); assert.ok(Number.isInteger(a.airborneFrames));
    assert.equal(a.target, a.airborneFrames / n);
    assert.ok(a.airborneFrames >= (g.endsWithContact ? n - 1 > 6 ? 6 : 1 : 0));
    assert.ok(a.airborneFrames <= n - 2);
    const actual = effectiveAxes(g, spec), frozen = targets(c, g);
    for (const axis of ['air', 'speed', 'amplitude'] as const) {
      if (frozen[axis] === undefined) { assert.equal(actual[axis], undefined); continue; }
      const delta = Math.abs(actual[axis]! - frozen[axis]!);
      maximumTargetDiscrepancy = Math.max(maximumTargetDiscrepancy, delta); assert.ok(delta < 1e-10);
    }
    if (!g.endsWithContact) assert.equal(frozen.impact, undefined);
  }
  if (c.provenance.kind === 'v2_bridge') {
    const entry = developmentCases.find(e => c.id === 'bridge_' + e.case.metadata.id)!;
    const original = applyJolt(entry.case.spec, -15);
    assert.equal(c.durationFrames, Math.round(original.duration * 40));
    assert.deepEqual(c.contacts, original.contacts.map(x => ({ frame: Math.round(x.t * 40), ...(x.impact === undefined ? {} : { impact: x.impact }) })));
    for (const axis of ['speed', 'amplitude'] as const) {
      if (!original.axes[axis]) assert.equal(c.samples[axis], undefined);
      else assert.deepEqual(c.samples[axis], Array.from({ length: c.durationFrames + 1 }, (_, f) => original.axes[axis]!(f / 40) ?? null));
    }
  }
}
const identities = cases.map(c => sha(JSON.stringify({ duration: c.durationFrames, contacts: c.contacts, samples: c.samples, air: c.air.map(a => a.target) })));
assert.equal(new Set(identities).size, 88);
for (const stratum of policy.strata) {
  assert.ok(Math.abs(stratum.groups.reduce((s, g) => s + g.weight, 0) - 1) < 1e-10);
  for (const group of stratum.groups) assert.ok(cases.some(c => c.group === group.id));
}
const result = { schema: 'line.benchmark-v3.static-audit.v1', compilerOutcomesConsulted: false,
  inputSha256: JSON.parse(readFileSync('benchmark/v3/catalog.lock.json', 'utf8')).specificationsSha256,
  cases: cases.length, parents: new Set(cases.map(c => c.parentId)).size, distinctInputs: 88,
  intervals, tailSeconds, maximumTargetDiscrepancy, contradictoryAirRequests: 0,
  bridgeUnchangedContactsImpactsSpeedAmplitudeDuration: 44,
  origins: Object.fromEntries(['v2_bridge', 'new_program', 'exposed_music_reference'].map(kind => [kind, cases.filter(c => c.provenance.kind === kind).length])),
  spanWeighting: 'Elapsed frames for air, speed and amplitude; one observation per authored impact. No extra ending impact.',
  limits: ['Discrete airtime requests pass necessary contact/sample constraints; this does not establish joint physical feasibility.', '39 new programs share 13 family grammars; 65 aggregation parents do not imply 65 independent musical works.', 'No new owner audiovisual approval or fresh real-music holdout is claimed.'] };
const body = JSON.stringify(result, null, 2) + '\n';
writeFileSync('benchmark/v3/static-audit.json', body); writeFileSync('benchmark/v3/static-audit.json.sha256', sha(body) + '\n');
console.log(body);
