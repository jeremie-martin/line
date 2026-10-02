/** Controlled geometry perturbations on declared saved incoming states. Every
 * trial replays the unchanged prefix AND the complete existing continuation.
 * Failed suffixes remain results, never successful local repairs. */
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {detect, extractRawTrajectory} from '../lib/detector.ts';
import {evaluateDetection} from '../../benchmark/v4/evaluator.ts';
import {CONTACT_IMPACT_CONTRACT, observeContactImpacts, detectContactImpacts, accountContactImpacts, contactSpeedGains} from '../lib/contact_impact.ts';
import {effectiveBodyVelocity} from '../v0/optimizer/motion_quality.ts';
import {inspectRailContacts} from './contacts.ts';
const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const out = arg('out', 'generated/general-impact-20261002/construction-assays'); mkdirSync(out, {recursive: true});
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const read = (p: string) => {const b = readFileSync(p); assert.equal(sha(b), readFileSync(p + '.sha256', 'utf8').trim(), p); return JSON.parse(b.toString());};
const save = (name: string, value: unknown) => {const text = JSON.stringify(value) + '\n', b = name.endsWith('.gz') ? gzipSync(text) : Buffer.from(text);
  writeFileSync(`${out}/${name}`, b); writeFileSync(`${out}/${name}.sha256`, sha(b) + '\n'); return sha(b);};
const audit = read('generated/beat-salience-20261001/audit.json'), panel = read('docs/evidence/interaction-panel-20261002.json');
const sources: Array<{id: string; path: string; section: number; reason: string}> = [];
for (const id of ['upper-rival', 'merged-hits', 'open-transfer', 'clean-landing', 'amor-strong', 'luna-strong', 'sustained-guidance', 'amour-contrast', 'luna-opening', 'tiki-opening']) {
  const c = panel.clips.find((c: any) => c.id === id), r = read(c.record);
  const time = id.endsWith('opening') ? r.case.contacts[0].frame / 40 : (c.focus[0] + c.focus[1]) / 2;
  const section = r.production.plan.requests.find((p: any) => p.frame / 40 <= time && p.next / 40 > time)?.section;
  assert.ok(section !== undefined); sources.push({id, path: c.record, section, reason: 'Named owner development passage; construction containing its focus midpoint (first requested beat for openings).'});
}
for (const construction of ['arcs', 'fold', 'serpentine', 'scallops', 'terraces', 'scattered']) {
  const source = audit.runs.find((r: any) => r.version === 'current' && r.seed === 101), r = read(source.path);
  const request = r.production.plan.requests.find((p: any) => p.section && p.construction === construction);
  if (!request) continue;
  if (!sources.some(s => s.path === source.path && s.section === request.section)) sources.push({id: `first-${construction}`, path: source.path,
    section: request.section, reason: 'First non-startup occurrence in the first declared seed-101 complete production ride, independent of measured outcome.'});
}
const perturbations = [{id: 'baseline', rail: 'all', dx: 0, dy: 0, angle: 0},
  ...(['main', 'guide'] as const).flatMap(rail => [
    ...[-2, -1, -.5, .5, 1, 2].map(dy => ({id: `${rail}-y${dy}`, rail, dx: 0, dy, angle: 0})),
    ...[-3, -1, 1, 3].map(angle => ({id: `${rail}-angle${angle}`, rail, dx: 0, dy: 0, angle})),
    ...[-3, 3].map(dx => ({id: `${rail}-x${dx}`, rail, dx, dy: 0, angle: 0})),
  ])];
const plan = {schema: 'line.contact-construction-assay-plan.v1', contract: CONTACT_IMPACT_CONTRACT,
  contractSourceSha256: sha(readFileSync('scripts/lib/contact_impact.ts')), harnessSha256: sha(readFileSync(import.meta.filename)), sources, perturbations,
  scope: 'Known development states; controlled geometry perturbations, not a production policy. All complete continuations are replayed, including failures.'};
const planSha256 = save('plan.json', plan);
const {LineRiderEngine: Engine, disposeAllWasmEnginesForStudy: dispose} =
  await import(new URL('../lib/_lr_engine_wasm.ts?contact-construction-assay', import.meta.url).href);
const trials: any[] = [], observations: any[] = [];
const stateError = (a: any, b: any) => Math.max(...Object.keys(a.points).flatMap(id => ['x', 'y', 'prevX', 'prevY', 'vx', 'vy'].map(key => Math.abs(a.points[id][key] - b.points[id][key]))));
for (const source of sources) {
  const record = read(source.path), request = record.production.plan.requests[source.section];
  assert.ok(record.track.lines.every((l: any) => l.type === 0)); assert.equal(sha(JSON.stringify(record.track)), record.trackHash);
  const roles = inspectRailContacts(record, []).guideIds, end = record.case.durationFrames + 20;
  const sectionLines = record.track.lines.filter((l: any) => Math.floor((l.id - 1000) / 10000) === source.section);
  const center = {x: sectionLines[0].x2, y: sectionLines[0].y2};
  try {
    const baseline = new Engine().setStart(record.track.startPosition, record.track.riders[0].startVelocity).addLine(record.track.lines);
    const prefixState = baseline.getRider(request.frame - 1).ballisticState();
    const expected = Array.from({length: request.frame}, (_, f) => baseline.getRider(f).ballisticState());
    for (const p of perturbations) {
      const selected = new Set<number>(sectionLines.filter((l: any) => p.rail === 'all' || (roles.has(l.id) ? 'guide' : 'main') === p.rail).map((l: any) => l.id));
      if (!selected.size) {trials.push({source: source.id, perturbation: p.id, skipped: 'requested rail absent'}); continue;}
      const angle = p.angle * Math.PI / 180, co = Math.cos(angle), si = Math.sin(angle);
      const moved = (x: number, y: number) => ({x: center.x + co * (x - center.x) - si * (y - center.y) + p.dx,
        y: center.y + si * (x - center.x) + co * (y - center.y) + p.dy});
      const lines = record.track.lines.map((l: any) => {
        if (!selected.has(l.id)) return l;
        const a = moved(l.x1, l.y1), b = moved(l.x2, l.y2); return {...l, x1: a.x, y1: a.y, x2: b.x, y2: b.y};
      });
      const engine = new Engine().setStart(record.track.startPosition, record.track.riders[0].startVelocity).addLine(lines);
      const raw = extractRawTrajectory(engine, end), det = detect(raw);
      let prefixMaxError = stateError(prefixState, engine.getRider(request.frame - 1).ballisticState());
      for (let f = 0; f < request.frame; f++) prefixMaxError = Math.max(prefixMaxError, stateError(expected[f], engine.getRider(f).ballisticState()));
      const observed = observeContactImpacts(raw.frames, f => engine.getUpdatesAtFrame(f).some((u: any) => u.type === 'CollisionUpdate'),
        effectiveBodyVelocity(engine.getRider(end).ballisticState()));
      const events = detectContactImpacts(observed), account = accountContactImpacts(events, record.case.contacts);
      const grade = evaluateDetection(record.case, det), gains = contactSpeedGains(observed);
      const local = events.filter(e => e.onset >= request.frame - 4 && e.onset < request.next);
      const targetIndex = source.section - 1, match = account.matches.find(m => m.target === targetIndex);
      const following = account.matches.filter(m => m.target >= targetIndex && m.target <= targetIndex + 2).map(m => ({...m, event: events[m.event]}));
      const trial = {source: source.id, perturbation: p.id, trackHash: sha(JSON.stringify({...record.track, lines})), prefixMaxError,
        unchangedPrefix: prefixMaxError < 1e-8, simulatedFrames: end + 1, physicalTerminus: det.terminus,
        validLegacyContinuation: grade.score.valid, legacyScore: grade.score.score, fullImpactAccount: {...account, matches: undefined},
        local, intended: match ? {match, event: events[match.event]} : null, following,
        gains: gains.filter(g => g.end >= request.frame && g.start < request.next), request};
      trials.push(trial);
      if (p.id === 'baseline') assert.equal(grade.score.score, record.score.score);
      // Preserve whole physical alternatives, even when they fail. Preview
      // selection later must cite its criterion and these complete outcomes.
      observations.push({source: source.id, perturbation: p.id, track: {...record.track, lines}, events, account, physicalTerminus: det.terminus});
    }
    console.log(JSON.stringify({source: source.id, section: source.section, construction: request.construction,
      trials: trials.filter(t => t.source === source.id && !t.skipped).length,
      continued: trials.filter(t => t.source === source.id && t.unchangedPrefix && t.validLegacyContinuation).length}));
  } finally {dispose();}
}
assert.equal(sha(readFileSync('scripts/lib/contact_impact.ts')), plan.contractSourceSha256, 'contract changed during assays');
save('trials.json.gz', {schema: 'line.contact-construction-assays.v1', planSha256, trials});
save('tracks.json.gz', {planSha256, observations});
console.log(JSON.stringify({out, scheduled: sources.length * perturbations.length, recorded: trials.length,
  simulatedFrames: trials.reduce((s, t) => s + (t.simulatedFrames ?? 0), 0)}));
