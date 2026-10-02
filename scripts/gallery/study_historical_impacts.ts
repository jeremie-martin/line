/** Read-only historical comparison. No compiler, benchmark, or scoring changes.
 * Replay saved geometry on one engine; keep historical scores out of comparisons.
 */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {detect, extractRawTrajectory} from '../lib/detector.ts';
import {findAuthoredContactNearFrame, contactRedirArcPxAtLanding} from '../v0/core/substrate.ts';
import {normImpact} from '../v0/types.ts';
const {LineRiderEngine: Engine, disposeAllWasmEnginesForStudy: dispose} =
  await import(new URL('../lib/_lr_engine_wasm.ts?historical-impacts', import.meta.url).href);
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'generated/beat-salience-history-20261002';
mkdirSync(out, {recursive: true});
const sha = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const checked = (p: string) => {
  assert.equal(sha(readFileSync(p)), readFileSync(p + '.sha256', 'utf8').trim(), p);
  return read(p);
};
const auditPath = 'generated/beat-salience-20261001/audit.json', audit = checked(auditPath);
type Input = {id: string; song: string; era: string; seed: number; track: any; report: any;
  path: string; sourceSha256: string; jolt: number; provenance: any; reference?: any; trace?: any};
const inputs: Input[] = [];
for (const [era, songs] of [
  ['arc-850-852', ['luna_bala_44s', 'amor_na_praia_46s', 'tiki_tiki_48s']],
  ['arc-v3-910', ['luna_bala_44s']],
] as const) for (const song of songs) {
  const base = `archives/${era}/${song}`, dir = `${base}/inputs/${song}`, record = checked(`${dir}/compile.json`);
  for (const name of ['track.json', 'report.json']) assert.equal(sha(readFileSync(`${dir}/${name}`)), record.outputs[name]);
  assert.equal(sha(readFileSync(`productions/${song}/spec.ts`)), record.specSha256);
  assert.equal(sha(readFileSync(`productions/${song}/audio.mp3`)), record.audioSha256);
  assert.equal(sha(readFileSync(`${base}/production-inputs/audio.json`)), sha(readFileSync(`productions/${song}/audio.json`)));
  inputs.push({id: `${era}-${song}`, song, era, seed: record.seed, track: read(`${dir}/track.json`), report: read(`${dir}/report.json`),
    path: `${dir}/track.json`, sourceSha256: record.outputs['track.json'], jolt: record.jolt,
    provenance: {compilePath: `${dir}/compile.json`, compileSha256: sha(readFileSync(`${dir}/compile.json`)), gitSha: record.gitSha,
      historicalProductionScore: record.metrics.score, specSha256: record.specSha256, audioSha256: record.audioSha256,
      analysisSha256: sha(readFileSync(`productions/${song}/audio.json`)), identity: 'Archived compile hashes match saved geometry, report, current spec and audio.'}});
}
const julyTrack = 'generated/produce/_paritycheck/s946078916.track.json';
inputs.push({id: 'july-06-amor', song: 'amor_na_praia_46s', era: 'july-06', seed: 946078916,
  track: read(julyTrack), report: read('generated/produce/_paritycheck/s946078916.report.json'), path: julyTrack,
  sourceSha256: sha(readFileSync(julyTrack)), jolt: -15,
  provenance: {uploadPath: 'generated/_parity_inbox/amor_na_praia_46s/amor_na_praia_46s-s946078916/upload.json',
    upload: read('generated/_parity_inbox/amor_na_praia_46s/amor_na_praia_46s-s946078916/upload.json'),
    renderLogPath: 'generated/produce/_paritycheck/amor_na_praia_46s-s946078916.render.log',
    reportSha256: sha(readFileSync('generated/produce/_paritycheck/s946078916.report.json')),
    identity: 'Render log names this saved track; upload date July 6 and seed agree. Historical git marker is paritytest, not a compiler hash; no original audio hash or full trace survives here. All authored target times and replayed contact frames are checked below.'}});
for (const run of audit.runs.filter((r: any) => r.version !== 'previous')) {
  const cell = checked(run.path);
  assert.equal(sha(readFileSync(run.path)), run.artifactSha256);
  assert.equal(sha(JSON.stringify(cell.track)), run.trackHash);
  assert.equal(sha(readFileSync(`productions/${run.song}/spec.ts`)), run.specSha256);
  assert.equal(sha(readFileSync(`productions/${run.song}/audio.mp3`)), run.audioSha256);
  inputs.push({id: `${run.version}-${run.song}-${run.seed}`, song: run.song, era: run.version, seed: run.seed,
    track: cell.track, report: {contacts: cell.contacts.map((c: any) => ({t_actual: c.actualFrame / 40}))},
    path: run.path, sourceSha256: run.artifactSha256, jolt: run.jolt, reference: run, trace: cell.trace,
    provenance: {specSha256: run.specSha256, audioSha256: run.audioSha256, analysisSha256: run.analysisSha256}});
}
const body = ['BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT'];
const avg = (vs: number[][]) => [0, 1].map(i => vs.reduce((s, v) => s + v[i], 0) / vs.length);
const norm = (v: number[]) => Math.hypot(...v);
const turn = (a: number[], b: number[]) => norm(a) < 1e-9 || norm(b) < 1e-9 ? 0 :
  .5 * (norm(a) + norm(b)) * Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));
const percentile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * q) - 1)] ?? null;
const dist = (xs: number[]) => ({n: xs.length, median: percentile(xs, .5), p90: percentile(xs, .9)});
const summarize = (beats: any[]) => ({n: beats.length, landingOffsetMs: dist(beats.map(b => b.landingOffsetMs)),
  peakOffsetMs: dist(beats.map(b => b.peakOffsetMs)), firstTwoPhysicalShare: dist(beats.map(b => b.firstTwoPhysicalShare)),
  impactBelow80Percent: beats.filter(b => b.impact < .8 * b.target).length,
  impactBelow50Percent: beats.filter(b => b.impact < .5 * b.target).length,
  bounceNeighborhoods: beats.filter(b => b.events.some((e: any) => e.type === 'bounce')).length,
  strongerLaterAccent: beats.filter(b => b.laterPeak > b.peak).length,
  lateToLandingRatio: dist(beats.filter(b => b.peak > 1e-9).map(b => b.laterPeak / b.peak))});
const runs: any[] = [];
for (const input of inputs) {
  const {song, track} = input;
  const spec = (await import(pathToFileURL(resolve(`productions/${song}/spec.ts`)).href)).default;
  assert.equal(spec.contacts.length, input.report.contacts.length);
  assert.ok(track.lines.every((l: any) => l.type === 0));
  try {
    const engine = new Engine().setStart(track.startPosition, track.riders[0].startVelocity).addLine(track.lines);
    const end = Math.round(spec.duration * 40), det = detect(extractRawTrajectory(engine, end + 20));
    assert.equal(det.terminus.reason, 'endOfSpec'); assert.ok(det.terminus.frame >= end);
    let maxTraceError = 0, maxIntegratorError = 0;
    const frames: any[] = [];
    for (let f = 0; f <= end + 20; f++) {
      const state = engine.getRider(f).ballisticState().points;
      if (input.trace) for (const [i, id] of input.trace.pointIds.entries()) for (const [j, key] of ['x', 'y'].entries())
        maxTraceError = Math.max(maxTraceError, Math.abs(state[id][key] - input.trace.frames[f][2 * i + j]));
      const incoming = avg(body.map(id => [state[id].vx, state[id].vy]));
      const effective = avg(body.map(id => [state[id].x - state[id].prevX, state[id].y - state[id].prevY]));
      if (f) maxIntegratorError = Math.max(maxIntegratorError, Math.hypot(incoming[0] - frames[f - 1].effective[0], incoming[1] - frames[f - 1].effective[1] - .175));
      frames.push({f, incoming, effective, solverImpulse: f ? Math.hypot(effective[0] - incoming[0], effective[1] - incoming[1]) : 0,
        solverTurn: f ? turn(incoming, effective) : 0});
    }
    assert.ok(maxTraceError < 1e-8 && maxIntegratorError < 1e-8);
    const beats = spec.contacts.map((contact: any, i: number) => {
      const targetFrame = Math.round((contact.t - input.jolt / 1000) * 40);
      const previous = i ? Math.round((spec.contacts[i - 1].t - input.jolt / 1000) * 40) : 0;
      const event = findAuthoredContactNearFrame(det, targetFrame, 1, targetFrame - previous);
      assert.ok(event, `${input.id} missing contact ${i}`);
      assert.equal(event.frame, Math.round(input.report.contacts[i].t_actual * 40), `${input.id} saved contact ${i}`);
      if (input.report.contacts[i].t_target !== undefined)
        assert.ok(Math.abs(input.report.contacts[i].t_target - (contact.t - input.jolt / 1000)) < 1e-8);
      const f = event.frame, window = frames.slice(f, f + 7);
      const start = i ? (spec.contacts[i - 1].t + contact.t) * 20 : 0;
      const finish = i + 1 < spec.contacts.length ? (contact.t + spec.contacts[i + 1].t) * 20 : end;
      const neighborhood = frames.filter(x => x.f >= start && x.f < finish);
      const peak = window.reduce((a, b) => b.solverImpulse > a.solverImpulse ? b : a);
      const later = neighborhood.filter(x => x.f > f + 6);
      const laterPeak = later.length ? later.reduce((a, b) => b.solverImpulse > a.solverImpulse ? b : a) : null;
      const total = window.reduce((s, x) => s + x.solverImpulse, 0);
      const impact = normImpact(contactRedirArcPxAtLanding(det, f)!);
      if (input.era.startsWith('arc-'))
        assert.ok(Math.abs(impact - input.report.gaps[i].axes.impact.achieved) < 1e-10,
          `${input.id} historical scored impact ${i}`);
      const beat = {i, t: contact.t, target: contact.impact, frame: f, landingOffsetMs: (f / 40 - contact.t) * 1000,
        impact, peakFrame: peak.f, peak: peak.solverImpulse, peakOffsetMs: (peak.f / 40 - contact.t) * 1000,
        firstTwoPhysicalShare: total > 1e-9 ? (window[0].solverImpulse + window[1].solverImpulse) / total : 0,
        laterPeakFrame: laterPeak?.f ?? null, laterPeak: laterPeak?.solverImpulse ?? 0,
        events: det.events.filter(e => e.frame >= start && e.frame < finish),
        physicalWindow: window.map(x => ({frame: x.f, impulse: x.solverImpulse, turn: x.solverTurn}))};
      if (input.reference) {
        const old = input.reference.beats[i];
        assert.equal(f, old.actualFrame); assert.equal(impact, old.impact);
        assert.equal(peak.f, old.peaks.solverImpulse.landingPeakFrame);
        assert.equal(peak.solverImpulse, old.peaks.solverImpulse.landingPeak);
        assert.deepEqual(beat.events, old.localEvents);
      }
      return beat;
    });
    const {track: _, report: __, reference: ___, trace: ____, ...identity} = input;
    const run = {...identity, trackHash: sha(JSON.stringify(track)), replayChecks: {savedContactsMatched: beats.length,
      maxTraceError: input.trace ? maxTraceError : null, maxIntegratorError, terminus: det.terminus,
      limitation: input.trace ? 'Full saved trace exactly reproduced.' : 'Original full trace absent: contact-frame replay parity does not prove full historical trajectory parity.'},
      beats, all: summarize(beats), strong: summarize(beats.filter((b: any) => b.target >= .5))};
    runs.push(run); console.log(JSON.stringify({id: input.id, strong: run.strong}));
  } finally {dispose();}
}
const result = {schema: 'line.historical-impact-audit.v1', harnessSha256: sha(readFileSync(import.meta.filename)),
  engineSha256: sha(readFileSync('engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm')),
  priorAudit: {path: auditPath, sha256: sha(readFileSync(auditPath))},
  notes: ['All saved tracks are replayed unchanged on the same engine. No fresh compilation or track selection by diagnostic outcome.',
    'Seven samples cover contact through +150ms. Physical impulse is the six-body-point mean velocity change caused by that frame solver, excluding the already-applied gravity.',
    'A later accent is strictly after the seven-sample window and before the midpoint to the next authored beat.',
    'Strong means authored impact >= 0.5. These descriptive thresholds are not a new judge or perception calibration.',
    'July normalized impact uses today\'s unchanged measurement only for comparison; July\'s historical score used a different impact definition.',
    'One archived track per song/era, versus three current seeds; ordinary references may duplicate geometry. No statistical generalization from this historical sample.',
    'Physical measurements exclude camera/post-processing. A filmed July/September ride and the native dashboard have different presentation.'], runs};
for (const [name, bytes] of [['audit.json', Buffer.from(JSON.stringify(result) + '\n')],
  ['audit.json.gz', gzipSync(JSON.stringify(result) + '\n')]] as const) {
  writeFileSync(join(out, name), bytes); writeFileSync(join(out, name + '.sha256'), sha(bytes) + '\n');
}
