/** Read-only follow-up to owner feedback: separate physical interactions from
 * landing-window bookkeeping. No proposed aesthetic score or compiler change.
 * Run with LR_ENGINE=wasm node --import tsx scripts/gallery/study_interaction_roles.ts
 */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync, gzipSync} from 'node:zlib';
import {join} from 'node:path';
import {detect, extractRawTrajectory, type RawTrajectory} from '../lib/detector.ts';
import {contactRedirArcPxAtLanding} from '../v0/core/substrate.ts';
import {normImpact} from '../v0/types.ts';
import {inspectRailContacts} from './contacts.ts';
import {ACCENT_BODY_POINTS, riderCorrection} from './ride_accents.ts';

const {LineRiderEngine: Engine, disposeAllWasmEnginesForStudy: dispose} =
  await import(new URL('../lib/_lr_engine_wasm.ts?interaction-roles-study', import.meta.url).href);
const arg = (key: string, fallback: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const source = arg('source', 'generated/beat-salience-20261001');
const out = arg('out', 'generated/tiki-interactions-20261002');
mkdirSync(out, {recursive: true});
const sha = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
function checked(path: string) {
  const b = readFileSync(path);
  assert.equal(sha(b), readFileSync(path + '.sha256', 'utf8').trim(), path);
  return b;
}
const audit = JSON.parse(checked(join(source, 'audit.json')).toString());
const raw = JSON.parse(gunzipSync(checked(join(source, 'frames.json.gz'))).toString());

// Mechanical contact runs, NOT perceptual accents. Keep both zero-hole and
// one-hole views rather than silently choosing a segmentation threshold.
function runsOf(frames: number[], holes = 0) {
  const runs: number[][] = [];
  for (const f of frames) {
    const last = runs.at(-1);
    if (!last || f - last.at(-1)! > holes + 1) runs.push([f]);
    else last.push(f);
  }
  return runs;
}

const focused: any[] = [];
for (const seed of [101, 303]) {
  const run = audit.runs.find((r: any) => r.version === 'current' && r.song === 'tiki_tiki_48s' && r.seed === seed);
  const record = JSON.parse(checked(run.path).toString());
  assert.equal(sha(JSON.stringify(record.track)), run.trackHash);
  assert.ok(record.track.lines.every((l: any) => l.type === 0));
  const old = raw.runs.find((r: any) => r.version === run.version && r.song === run.song && r.seed === seed);
  assert.equal(old.trackHash, run.trackHash);
  const guides = inspectRailContacts(record, []).guideIds;
  const group = (id: number) => `${Math.floor((id - 1000) / 10000)}:${guides.has(id) ? 'guide' : 'main'}`;
  try {
    const engine = new Engine().setStart(record.track.startPosition, record.track.riders[0].startVelocity).addLine(record.track.lines);
    const det = detect(extractRawTrajectory(engine, run.durationFrames + 20));
    let maxTraceError = 0;
    const frames: any[] = [];
    for (let f = 0; f <= run.durationFrames; f++) {
      const points = engine.getRider(f).ballisticState().points;
      for (const [i, id] of record.trace.pointIds.entries()) for (const [j, key] of ['x', 'y'].entries()) {
        maxTraceError = Math.max(maxTraceError, Math.abs(points[id][key] - record.trace.frames[f][2 * i + j]));
      }
      if (f < 480 || f > 620) continue;
      const collisions = engine.getUpdatesAtFrame(f).filter((u: any) => u.type === 'CollisionUpdate');
      const contacts = [...new Map(collisions.map((u: any) => [`${u.id}:${u.updated[0].id}`,
        {line: u.id, point: u.updated[0].id, group: group(u.id)}])).values()];
      const correction = riderCorrection(points);
      assert.ok(Math.abs(correction.meanImpulse - old.frames[f].solverImpulse) < 1e-8);
      frames.push({frame: f, time: f / 40, ...correction, contacts, airborne: det.measurements.airborne[f],
        scoreStep: old.frames[f].scoredStep, scoreWindows: run.beats.filter((b: any) => f >= b.actualFrame && f <= b.actualFrame + 6).map((b: any) => b.index),
        pose: {bodyY: ACCENT_BODY_POINTS.reduce((s, id) => s + points[id].y, 0) / 6,
          tailY: points.TAIL.y, noseY: points.NOSE.y, shoulderY: points.SHOULDER.y, buttY: points.BUTT.y}});
    }
    assert.ok(maxTraceError < 1e-8);
    const beats = run.beats.filter((b: any) => b.actualFrame >= 480 && b.actualFrame <= 613).map((b: any) => {
      const steps = old.frames.slice(b.actualFrame, b.actualFrame + 7).map((f: any) => ({frame: f.f, value: f.scoredStep,
        airborne: f.airborne, previousSolverContacts: old.frames[f.f - 1].contacts}));
      const measured = normImpact(contactRedirArcPxAtLanding(det, b.actualFrame)!);
      assert.ok(Math.abs(measured - b.impact) < 1e-8);
      assert.ok(Math.abs(normImpact(steps.reduce((s: number, f: any) => s + f.value, 0)) - b.impact) < 1e-8);
      return {index: b.index, authoredTime: b.t, actualFrame: b.actualFrame, impact: measured, target: b.targetImpact, steps};
    });
    const groups = [...new Set<string>(frames.flatMap(f => f.contacts.map((c: any) => c.group)))];
    const episodes = [0, 1].flatMap(holes => groups.flatMap(g => runsOf(frames.filter(f => f.contacts.some((c: any) => c.group === g)).map(f => f.frame), holes).map(fs => ({
      group: g, holes, first: fs[0], last: fs.at(-1), contactFrames: fs,
      points: [...new Set(fs.flatMap(f => frames.find(x => x.frame === f).contacts.filter((c: any) => c.group === g).map((c: any) => c.point)))],
      peakCorrection: Math.max(...fs.map(f => frames.find(x => x.frame === f).meanImpulse)),
      maxFrameTurn: Math.max(...fs.map(f => Math.abs(frames.find(x => x.frame === f).headingDegrees))),
    }))));
    const assays = [];
    // Named examples selected by the owner, not by optimizing an outcome.
    for (const section of seed === 101 ? [19, 20] : [15]) {
      const removed = new Set<number>(record.track.lines.filter((l: any) => group(l.id) === `${section}:guide`).map((l: any) => l.id));
      assert.ok(removed.size);
      const first = old.frames.find((f: any) => f.lineIds.some((id: number) => removed.has(id))).f;
      const precedingBeat = [...run.beats].reverse().find((b: any) => b.actualFrame < first);
      const nextBeat = run.beats.find((b: any) => b.actualFrame > first);
      const end = Math.min(nextBeat.actualFrame - 1, first + 12);
      assert.ok(end >= precedingBeat.actualFrame + 6);
      const alternative = new Engine().setStart(record.track.startPosition, record.track.riders[0].startVelocity)
        .addLine(record.track.lines.filter((l: any) => !removed.has(l.id)));
      const altDet = detect(extractRawTrajectory(alternative, end));
      assert.ok(altDet.terminus.frame >= precedingBeat.actualFrame + 6, 'must observe the complete original landing window');
      let prefixMaxError = 0, firstDivergence: number | null = null;
      const compared = [];
      for (let f = 0; f <= end; f++) {
        const points = alternative.getRider(f).ballisticState().points;
        const error = Math.max(...record.trace.pointIds.flatMap((id: string, i: number) =>
          [Math.abs(points[id].x - record.trace.frames[f][2 * i]), Math.abs(points[id].y - record.trace.frames[f][2 * i + 1])]));
        if (f < first) prefixMaxError = Math.max(prefixMaxError, error);
        if (firstDivergence === null && error > 1e-8) firstDivergence = f;
        if (f >= first - 1) compared.push({frame: f, pointError: error, correction: riderCorrection(points)});
      }
      assert.ok(prefixMaxError < 1e-8); assert.equal(firstDivergence, first);
      const impact = normImpact(contactRedirArcPxAtLanding(altDet, precedingBeat.actualFrame)!);
      const rawBefore = contactRedirArcPxAtLanding(det, precedingBeat.actualFrame)!;
      const rawAfter = contactRedirArcPxAtLanding(altDet, precedingBeat.actualFrame)!;
      if (first > precedingBeat.actualFrame + 6) assert.ok(Math.abs(impact - precedingBeat.impact) < 1e-8);
      assays.push({section, removed: [...removed], first, end, firstDivergence, prefixMaxError,
        alternativeTerminus: altDet.terminus,
        precedingBeat: precedingBeat.index, originalImpact: precedingBeat.impact, withoutGuideImpact: impact,
        rawBefore, rawAfter, compared,
        limitation: 'Local guide deletion only. Same incoming state, full original landing window; no claim of a viable continuation or perceptual improvement.'});
    }
    focused.push({seed, path: run.path, trackHash: run.trackHash, artifactSha256: run.artifactSha256,
      maxTraceError, beats, episodes, frames, assays, events: det.events.filter(e => e.frame >= 480 && e.frame <= 620)});
    console.log(JSON.stringify({seed, maxTraceError, assays: assays.map(({compared, removed, ...a}) => a)}));
  } finally {dispose();}
}

// Screen all saved rides for a specific geometric pose, including actual ski
// contact. This is not a detector of sustained inverted riding: it can include
// a short pivot on one ski endpoint and simultaneous contacts elsewhere.
const poseScreen = audit.runs.map((run: any) => {
  const record = JSON.parse(checked(run.path).toString());
  assert.equal(sha(JSON.stringify(record.track)), run.trackHash);
  const prior = raw.runs.find((r: any) => r.version === run.version && r.song === run.song && r.seed === run.seed);
  assert.equal(prior.trackHash, run.trackHash);
  const selected: number[] = [];
  record.trace.frames.slice(0, run.durationFrames + 1).forEach((row: number[], f: number) => {
    const y = (id: string) => row[2 * record.trace.pointIds.indexOf(id) + 1];
    const bodyY = ACCENT_BODY_POINTS.reduce((s, id) => s + y(id), 0) / 6;
    if (bodyY > Math.max(y('TAIL'), y('NOSE')) && y('SHOULDER') > y('BUTT') &&
      prior.frames[f].contacts.some((c: string) => ['TAIL', 'NOSE'].includes(c.split(':')[1]))) selected.push(f);
  });
  return {id: `${run.version}-${run.song}-${run.seed}`, trackHash: run.trackHash,
    episodes: runsOf(selected).map(fs => ({first: fs[0], last: fs.at(-1), frames: fs.length,
      contacts: [...new Set(fs.flatMap(f => prior.frames[f].contacts))]}))};
});

// Contract check: the detector and scalar accept rotated sled contact. It does
// NOT prove the physics/search can construct that trajectory under gravity.
const contract = [1, -1].map(sign => {
  const raw: RawTrajectory = {duration: 25, frames: Array.from({length: 26}, (_, frame) => ({frame,
    position: {x: sign * frame * 5, y: sign * 10},
    velocity: {x: sign * 5 * Math.cos(frame >= 11 ? .4 : 0), y: sign * 5 * Math.sin(frame >= 11 ? .4 : 0)},
    sledContacts: frame >= 10 ? ['TAIL', 'NOSE'] : [], contactLineIds: frame >= 10 ? [1] : [], sledBroken: false, riderEjected: false}))};
  const det = detect(raw);
  assert.ok(det.events.some(e => e.type === 'landing' && e.frame === 10));
  return {sign, events: det.events, impact: normImpact(contactRedirArcPxAtLanding(det, 10)!)};
});
assert.ok(Math.abs(contract[0].impact - contract[1].impact) < 1e-12);
const result = {schema: 'line.interaction-roles-study.v1', harnessSha256: sha(readFileSync(import.meta.filename)),
  sourceAuditSha256: sha(checked(join(source, 'audit.json'))), sourceFramesSha256: sha(checked(join(source, 'frames.json.gz'))),
  engineSha256: sha(readFileSync('engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm')),
  notes: ['Owner confirmed Tiki 303 12.45 s as a distracting upper hit, and 13.95 s as a cleaner landing.',
    'Owner welcomes separate lower-to-upper transfers, including Tiki 101 around 14.2 s and 14.95 s; they should not be banned by these diagnostics.',
    'Episode groups use recorded construction section/rail ONLY as collision provenance. They do not define musical intent, an aesthetic primitive, or a perceptual event.',
    'Physical correction at f enters stored velocity at f+1 plus gravity. Score steps show their true stored-frame timestamp; score-window partitions are not independent physical force attribution.',
    'Pose screen requires body mean below BOTH ski endpoints, shoulder below butt, and actual TAIL/NOSE contact. This is a screen, not proof of sustained inverted sliding.',
    'The synthetic rotation contract establishes orientation-independent measurement, not physical realizability.'], focused, poseScreen, contract};
for (const [name, bytes] of [['audit.json', Buffer.from(JSON.stringify(result) + '\n')],
  ['audit.json.gz', gzipSync(JSON.stringify(result) + '\n')]] as const) {
  writeFileSync(join(out, name), bytes); writeFileSync(join(out, name + '.sha256'), sha(bytes) + '\n');
}
