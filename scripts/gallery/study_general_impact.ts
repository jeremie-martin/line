/** Compare general impact definitions on declared complete development rides
 * and the original felt-label tracks. No compilation or reserved-data access. */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync, gzipSync} from 'node:zlib';
import {detect, extractRawTrajectory} from '../lib/detector.ts';
import {contactRedirArcPxAtLanding} from '../v0/core/substrate.ts';
import {candidateImpacts, type ImpactObservation, type CandidateOptions} from './general_impact_candidates.ts';
import {matchInteractions} from './interaction_candidates.ts';
import {CONTACT_IMPACT_CONTRACT, observeContactImpacts, detectContactImpacts, accountContactImpacts, contactSpeedGains} from '../lib/contact_impact.ts';
const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const out = arg('out', 'generated/general-impact-20261002/definition-study');
mkdirSync(out, {recursive: true});
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const checked = (p: string) => {const b = readFileSync(p); assert.equal(sha(b), readFileSync(p + '.sha256', 'utf8').trim(), p); return b;};
const read = (p: string) => JSON.parse((p.endsWith('.gz') ? gunzipSync(checked(p)) : checked(p)).toString());
const panelPath = 'docs/evidence/general-impact-campaign-panel-20261002.json', panel = read(panelPath);
const rawPath = 'generated/beat-salience-20261001/frames.json.gz', raw = read(rawPath), audit = read(panel.development.audit);
assert.equal(panel.development.auditSha256, sha(checked(panel.development.audit)));
const owner = read(panel.development.ownerPanel);
const variants: Array<CandidateOptions & {id: string}> = [];
for (const grouping of ['engagement', 'pulse', 'surface'] as const) for (const signal of ['visible', 'solver', 'stored', 'path'] as const)
  for (const window of [3, 5, 6, 7, 9]) for (const strength of ['sum', 'net', 'concentrated'] as const)
    variants.push({id: `${grouping}-${signal}-${window}-${strength}`, grouping, signal, window, strength, valley: .4});
const primaryIds = ['engagement-visible-7-sum', 'pulse-visible-7-sum', 'engagement-solver-7-sum', 'engagement-visible-7-net', 'engagement-visible-7-concentrated',
  'surface-visible-7-sum', 'surface-path-6-sum', 'surface-path-7-sum'];
for (const grouping of ['engagement', 'surface'] as const) for (const signal of ['visible', 'path', 'stored'] as const)
  for (const window of [6, 7]) for (const onsetFraction of [.1, .2, .3]) {
    const id = `${grouping}-${signal}-${window}-onset${onsetFraction}`;
    variants.push({id, grouping, signal, window, strength: 'sum', valley: .4, onsetFraction});
    if (grouping === 'engagement' && onsetFraction === .2) primaryIds.push(id);
  }
for (const window of [5, 6, 7]) for (const onsetFraction of [0, .1, .2, .3]) {
  const id = `engagement-effective-${window}-onset${onsetFraction}`;
  variants.push({id, grouping: 'engagement', signal: 'effective', window, strength: 'sum', valley: .4, onsetFraction});
  primaryIds.push(id);
}
const lineNormal = (l: any) => {const dx = l.x2 - l.x1, dy = l.y2 - l.y1, n = Math.hypot(dx, dy) * (l.flipped ? -1 : 1); return [-dy / n, dx / n] as const;};
const distributions = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return {n: s.length, mean: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length),
    median: s[Math.floor(s.length / 2)] ?? null, p90: s[Math.floor(s.length * .9)] ?? null, max: s.at(-1) ?? null};
};
const runs: any[] = [], historical: any[] = [];
const evaluate = (frames: ImpactObservation[], beats: any[]) => variants.map(v => {
  const events = candidateImpacts(frames, v), matching = matchInteractions(events, beats.map(b => b.frame), 4);
  const paired = matching.pairs.map(p => ({...p, strength: events[p.event].raw / 7.55, old: beats[p.beat].raw / 7.55}));
  return {id: v.id, events, matching, summary: {events: events.length, matched: paired.length,
    extras: matching.unmatchedEvents.length, extraRaw: distributions(matching.unmatchedEvents.map(i => events[i].raw)),
    oldDifference: distributions(paired.map(p => p.strength - p.old))}};
});
const working = (frames: ImpactObservation[], beats: any[], through = Infinity) => {
  const from = frames[0].frame;
  const observed = observeContactImpacts(frames.map(f => ({frame: f.frame, velocity: {x: f.incoming[0], y: f.incoming[1]}})),
    f => frames[f - from].contact, {x: frames.at(-1)!.effective[0], y: frames.at(-1)!.effective[1]});
  const events = detectContactImpacts(observed).filter(e => e.onset <= through);
  return {events, account: accountContactImpacts(events, beats.map(b => ({frame: b.requestedFrame ?? b.frame, impact: b.target}))), gains: contactSpeedGains(observed)};
};
for (const r of audit.runs) {
  const source = raw.runs.find((x: any) => x.version === r.version && x.song === r.song && x.seed === r.seed);
  assert.equal(source.trackHash, r.trackHash);
  const record = read(r.path), normals = new Map<number, readonly [number, number]>(record.track.lines.map((l: any) => [l.id, lineNormal(l)]));
  const frames: ImpactObservation[] = source.frames.map((f: any) => ({frame: f.f, contact: !!f.contacts.length,
    incoming: f.incoming, effective: f.effective, visible: f.visible, position: f.position,
    normals: f.lineIds.map((id: number) => normals.get(id)!)}));
  const beats = r.beats.map((b: any) => ({frame: b.actualFrame, requestedFrame: record.case.contacts[b.index].frame, audioFrame: b.t * 40,
    raw: source.frames.slice(b.actualFrame, b.actualFrame + 7).reduce((s: number, f: any) => s + f.scoredStep, 0), target: b.targetImpact}));
  const results = evaluate(frames, beats);
  const clips = owner.clips.filter((c: any) => r.version === 'current' && c.song === r.song && c.seed === r.seed).map((c: any) => ({id: c.id,
    methods: results.filter(v => primaryIds.includes(v.id)).map(v => ({id: v.id, events: v.events.filter(e => e.end >= c.focus[0] * 40 && e.start <= c.focus[1] * 40)}))}));
  runs.push({id: `${r.version}-${r.song}-${r.seed}`, trackHash: r.trackHash, beats, clips, working: working(frames, beats, r.durationFrames),
    variants: results.map(v => primaryIds.includes(v.id) ? v : {id: v.id, summary: v.summary})});
}
const {LineRiderEngine: Engine, disposeAllWasmEnginesForStudy: dispose} =
  await import(new URL('../lib/_lr_engine_wasm.ts?general-impact-calibration', import.meta.url).href);
const ordinal: Record<string, number> = {soft: 1, soft_medium: 1.5, medium: 2, medium_strong: 2.5,
  strong: 3, strong_very_strong: 3.5, very_strong: 4};
const body = ['BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT'];
for (const name of ['impact_lab_v2', 'climb_terrace', 'rolling_drop', 'staircase', 'shelter_impact_2m', 'believer_impact_2m']) {
  const trackPath = `labels/impact/${name}.track.json`, track = JSON.parse(readFileSync(trackPath, 'utf8'));
  const labelPath = existsSync(`generated/impact-study/${name}.labels.json`) ? `generated/impact-study/${name}.labels.json` : `labels/impact/${name}.labels.json`;
  const labels = JSON.parse(readFileSync(labelPath, 'utf8')).labels;
  const levelsPath = `labels/impact/${name}.levels.json`, levels = existsSync(levelsPath) ? JSON.parse(readFileSync(levelsPath, 'utf8')).levels : {};
  try {
    const engine = new Engine().setStart(track.startPosition, track.riders[0].startVelocity).addLine(track.lines);
    const normals = new Map<number, readonly [number, number]>(track.lines.map((l: any) => [l.id, lineNormal(l)]));
    const trajectory = extractRawTrajectory(engine, track.duration), det = detect(trajectory);
    const frames: ImpactObservation[] = [];
    for (const f of trajectory.frames.slice(0, det.terminus.frame + 1)) {
      const points = engine.getRider(f.frame).ballisticState().points;
      const position = [f.position.x, f.position.y] as const, prior = frames.at(-1);
      const collisions = engine.getUpdatesAtFrame(f.frame).filter((u: any) => u.type === 'CollisionUpdate');
      frames.push({frame: f.frame, position, incoming: [f.velocity.x, f.velocity.y],
        effective: [body.reduce((s, id) => s + points[id].x - points[id].prevX, 0) / 6, body.reduce((s, id) => s + points[id].y - points[id].prevY, 0) / 6],
        visible: prior ? [position[0] - prior.position[0], position[1] - prior.position[1]] : [f.velocity.x, f.velocity.y], contact: !!collisions.length,
        normals: [...new Set<number>(collisions.map((u: any) => u.id))].map(id => normals.get(id)!)});
    }
    const beats: any[] = [], drift: any[] = [];
    for (const [key, value] of Object.entries(labels) as Array<[string, any]>) {
      const felt = ordinal[value.ordinal] ?? levels[key]?.felt;
      if (felt === undefined) continue;
      const target = Number(key), nearby = trajectory.frames.filter(f => f.frame >= target - 6 && f.frame <= target + 6 && f.sledContacts.length);
      const f = nearby.find(f => !trajectory.frames[f.frame - 1]?.sledContacts.length) ?? nearby[0];
      if (!f || f.frame > det.terminus.frame - 1) {drift.push({frame: target, felt}); continue;}
      beats.push({frame: f.frame, labelFrame: target, felt, raw: contactRedirArcPxAtLanding(det, f.frame) ?? 0});
    }
    const results = evaluate(frames, beats);
    historical.push({name, trackPath, trackSha256: sha(readFileSync(trackPath)), labelPath, labelsSha256: sha(readFileSync(labelPath)),
      levelsSha256: existsSync(levelsPath) ? sha(readFileSync(levelsPath)) : null, beats, drift, working: working(frames, beats),
      variants: results.map(v => ({id: v.id, matching: v.matching, values: v.matching.pairs.map(p => ({beat: p.beat, raw: v.events[p.event].raw})), summary: v.summary}))});
    console.log(JSON.stringify({historical: name, labels: beats.length, drift: drift.length}));
  } finally {dispose();}
}
const result = {schema: 'line.general-impact-definition-study.v1', panelSha256: sha(checked(panelPath)), sourceFramesSha256: sha(checked(rawPath)),
  sourceSha256: sha(readFileSync(import.meta.filename)), candidatesSha256: sha(readFileSync('scripts/gallery/general_impact_candidates.ts')),
  workingContract: CONTACT_IMPACT_CONTRACT, workingSourceSha256: sha(readFileSync('scripts/lib/contact_impact.ts')),
  variants, runs, historical, notes: ['All candidates are research definitions, not calibrated production metrics.',
    'Historical values pair event onset within four frames of the reproduced labeled contact; unmatched labels and source drift remain explicit.',
    'The original 7.55 ruler is displayed as a compatibility comparison, not assumed valid for every new formula.',
    'Whole complete saved rides are observed before selecting the known owner excerpts. Reserved arrangements are not read.']};
for (const [name, bytes] of [['audit.json.gz', gzipSync(JSON.stringify(result) + '\n')],
  ['summary.json', Buffer.from(JSON.stringify({...result, runs: runs.map(r => ({id: r.id, clips: r.clips, variants: r.variants.map((v: any) => ({id: v.id, summary: v.summary}))}))}) + '\n')]] as const) {
  writeFileSync(`${out}/${name}`, bytes); writeFileSync(`${out}/${name}.sha256`, sha(bytes) + '\n');
}
console.log(JSON.stringify({out, runs: runs.length, variants: variants.length, historicalLabels: historical.reduce((s, h) => s + h.beats.length, 0)}));
