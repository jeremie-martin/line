/** Read-only audit of saved musical rides. Diagnostics are NOT a new score. */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {detect, extractRawTrajectory} from '../lib/detector.ts';
import {contactRedirArcPxAtLanding} from '../v0/core/substrate.ts';
import {normImpact} from '../v0/types.ts';
import {evaluateDetection} from '../../benchmark/v4/evaluator.ts';
import {scoreObservations} from '../../benchmark/v3/evaluator.ts';
import {inspectRailContacts} from './contacts.ts';
const {LineRiderEngine: Engine, disposeAllWasmEnginesForStudy: dispose} =
  await import(new URL('../lib/_lr_engine_wasm.ts?beat-salience-study', import.meta.url).href);
const arg = (name: string, fallback: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const collectionPath = arg('collection', 'generated/intentional-motion/library-candidate-8/collection.json');
const out = arg('out', 'generated/beat-salience-20261001');
mkdirSync(out, {recursive: true});
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const read = (path: string) => {
  const data = readFileSync(path);
  assert.equal(sha(data), readFileSync(path + '.sha256', 'utf8').trim(), path);
  return JSON.parse(data.toString());
};
const save = (name: string, value: unknown, gzip = false) => {
  const text = JSON.stringify(value) + '\n', bytes = gzip ? gzipSync(text) : Buffer.from(text);
  writeFileSync(join(out, name), bytes); writeFileSync(join(out, name + '.sha256'), sha(bytes) + '\n');
};
const body = ['BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT'];
const norm = (v: number[]) => Math.hypot(...v);
const minus = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
const avg = (vs: number[][]) => [0, 1].map(i => vs.reduce((s, v) => s + v[i], 0) / vs.length);
const turn = (a: number[], b: number[]) => norm(a) < 1e-9 || norm(b) < 1e-9 ? 0 :
  .5 * (norm(a) + norm(b)) * Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return null;
  const ordered = [...xs].sort((a, b) => a - b); return ordered[Math.max(0, Math.ceil(q * ordered.length) - 1)];
};
const distribution = (xs: number[]) => ({n: xs.length, mean: xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null,
  p10: quantile(xs, .1), median: quantile(xs, .5), p90: quantile(xs, .9), max: xs.length ? Math.max(...xs) : null});
const runs: any[] = [], rawRuns: any[] = [], localGuideAssays: any[] = [];
// Contract assay, deliberately synthetic: not a claim these are realizable tracks.
const contractAssay = ['immediate', 'spread', 'late', 'extra-later-turn'].map(name => {
  const turns = Array(31).fill(0);
  if (name === 'spread') for (let f = 11; f <= 16; f++) turns[f] = .755 / 6;
  else turns[name === 'late' ? 16 : 11] = .755;
  if (name === 'extra-later-turn') turns[23] = 1;
  let heading = 0;
  const velocity = turns.map(a => {heading += a; return {x: 5 * Math.cos(heading), y: 5 * Math.sin(heading)};});
  const det = {frameOffset: 0, measurements: {velocity, airborne: turns.map((_, f) => f < 10)}} as any;
  const raw = contactRedirArcPxAtLanding(det, 10)!, impact = normImpact(raw);
  const score = scoreObservations([{axis: 'impact', gap: 0, startFrame: 0, endFrame: 10, tail: false,
    target: .5, achieved: impact, error: Math.abs(impact - .5)}], []);
  assert.ok(Math.abs(impact - .5) < 1e-12); assert.equal(score.score, 1000);
  return {name, landingFrame: 10, turns, raw, impact, impactOnlyScore: score.score};
});
const collection = read(collectionPath);
for (const entry of collection.entries) {
  const currentPath = entry.manifest.replace(/^\//, ''), current = read(currentPath);
  const previousPath = entry.priorManifest.replace(/^\//, ''), previous = read(previousPath);
  assert.equal(current.plan.jolt, previous.plan.jolt);
  for (const [version, manifestPath, manifest, method] of [
    ['current', currentPath, current, 'production'], ['previous', previousPath, previous, 'production'],
    ['ordinary', currentPath, current, 'baseline'],
  ] as const) {
    const cell = manifest.cells.find((c: any) => c.method === method), path = join(dirname(manifestPath), cell.path), r = read(path);
    assert.equal(sha(readFileSync(path)), cell.sha256);
    assert.ok(r.track.lines.every((l: any) => l.type === 0));
    const source = (await import(pathToFileURL(resolve(r.case.source)).href)).default;
    assert.equal(sha(readFileSync(r.case.source)), r.case.specSha256);
    assert.equal(source.contacts.length, r.contacts.length);
    assert.equal(sha(readFileSync(r.case.audioPath)), r.case.audioSha256);
    const audioAnalysisPath = join(dirname(r.case.source), 'audio.json');
    assert.equal(sha(readFileSync(audioAnalysisPath)), r.case.analysisSha256);
    const audio = JSON.parse(readFileSync(audioAnalysisPath, 'utf8'));
    try {
      const engine = new Engine().setStart(r.track.startPosition, r.track.riders[0].startVelocity).addLine(r.track.lines);
      const det = detect(extractRawTrajectory(engine, r.case.durationFrames + 20));
      const grade = evaluateDetection(r.case, det);
      assert.deepEqual(grade.score, r.score); assert.deepEqual(grade.contacts, r.contacts);
      const roles = inspectRailContacts(r, []).guideIds;
      let maxTraceError = 0, maxIntegratorError = 0;
      const frames: any[] = [];
      for (let f = 0; f <= r.case.durationFrames + 20; f++) {
        const state = engine.getRider(f).ballisticState().points;
        for (const [i, id] of r.trace.pointIds.entries()) for (const [j, k] of ['x', 'y'].entries()) {
          maxTraceError = Math.max(maxTraceError, Math.abs(state[id][k] - r.trace.frames[f][2 * i + j]));
        }
        const position = avg(body.map(id => [state[id].x, state[id].y]));
        const incoming = avg(body.map(id => [state[id].vx, state[id].vy]));
        const effective = avg(body.map(id => [state[id].x - state[id].prevX, state[id].y - state[id].prevY]));
        assert.ok(norm(minus(incoming, [det.measurements.velocity[f].x, det.measurements.velocity[f].y])) < 1e-8);
        const peg = [state.PEG.x, state.PEG.y], screenBody = minus(position, peg);
        const prior = frames[f - 1], visible = prior ? minus(position, prior.position) : incoming;
        const screenVelocity = prior ? minus(screenBody, prior.screenBody) : [0, 0];
        if (prior) maxIntegratorError = Math.max(maxIntegratorError, norm(minus(incoming, [prior.effective[0], prior.effective[1] + .175])));
        const collisions = engine.getUpdatesAtFrame(f).filter((u: any) => u.type === 'CollisionUpdate');
        const contacts = [...new Set<string>(collisions.map((u: any) => `${roles.has(u.id) ? 'guide' : 'main'}:${u.updated[0].id}`))];
        frames.push({f, position, peg, screenBody, screenVelocity, incoming, effective, visible,
          // Exact production step: incoming velocities, gated by this frame's sled contact.
          scoredStep: prior && !det.measurements.airborne[f] ? turn(prior.incoming, incoming) : 0,
          solverTurn: f ? turn(incoming, effective) : 0,
          solverImpulse: f ? norm(minus(effective, incoming)) : 0,
          // Independent position-based bend; no detector contact gating or stored-velocity lag.
          visibleTurn: prior ? turn(prior.visible, visible) : 0,
          visibleImpulse: prior ? norm(minus(visible, [prior.visible[0], prior.visible[1] + .175])) : 0,
          airborne: det.measurements.airborne[f], contacts,
          lineIds: [...new Set(collisions.map((u: any) => u.id))]});
      }
      assert.ok(maxTraceError < 1e-8); assert.ok(maxIntegratorError < 1e-8);
      const beats = r.contacts.map((contact: any, i: number) => {
        assert.notEqual(contact.actualFrame, null);
        const f = contact.actualFrame, t = source.contacts[i].t, authoredFrame = t * 40;
        const window = frames.slice(f, f + 7), sum = window.reduce((s: number, v: any) => s + v.scoredStep, 0);
        assert.ok(Math.abs(sum - contactRedirArcPxAtLanding(det, f)!) < 1e-8);
        const scored = grade.observations.find((o: any) => o.axis === 'impact' && o.gap === i)!;
        assert.ok(Math.abs(normImpact(sum) - scored.achieved!) < 1e-8);
        const physicalWindow = frames.slice(f, f + 7);
        const halfStart = i ? (source.contacts[i - 1].t + t) * 20 : 0;
        const halfEnd = i + 1 < r.contacts.length ? (source.contacts[i + 1].t + t) * 20 : r.case.durationFrames;
        const neighborhood = frames.filter(x => x.f >= halfStart && x.f < halfEnd);
        const peaks = Object.fromEntries(['scoredStep', 'solverTurn', 'solverImpulse', 'visibleTurn', 'visibleImpulse'].map(key => {
          const w = key === 'scoredStep' ? window : physicalWindow, peak = w.reduce((best: any, x: any) => x[key] > best[key] ? x : best);
          const whole = neighborhood.reduce((best: any, x: any) => x[key] > best[key] ? x : best);
          const on = neighborhood.filter(x => Math.abs(x.f - authoredFrame) <= 3);
          const off = neighborhood.filter(x => Math.abs(x.f - authoredFrame) > 3);
          const onMax = Math.max(0, ...on.map(x => x[key])), offMax = Math.max(0, ...off.map(x => x[key]));
          return [key, {landingPeakFrame: peak.f, landingPeak: peak[key], landingPeakOffsetMs: (peak.f - authoredFrame) * 25,
            strongestFrame: whole.f, strongest: whole[key], strongestOffsetMs: (whole.f - authoredFrame) * 25,
            onMax, offMax, offToOn: onMax > 1e-9 ? offMax / onMax : null, strongestContacts: whole.contacts}];
        }));
        const request = r.production?.plan.requests[i + 1];
        const section = r.sections[i + 1];
        const attacks = audio.frames ? audio.frames.times.map((x: number, j: number) => ({t: x, strength: audio.frames.onset_strength[j]})) :
          audio.transients.map((x: any) => ({t: x.t, strength: x.percussive_strength}));
        const localOnsets = attacks
          .filter((x: any) => Math.abs(x.t - t) <= .1);
        const onset = localOnsets.reduce((best: any, x: any) => !best || x.strength > best.strength ? x : best, null);
        return {index: i, t, targetImpact: source.contacts[i].impact, targetFrame: contact.targetFrame, actualFrame: f,
          compiledShiftMs: contact.targetFrame * 25 - t * 1000, landingOffsetMs: f * 25 - t * 1000,
          impact: scored.achieved, impactError: scored.error, rawImpact: sum,
          firstTwoShare: sum > 1e-9 ? (window[0].scoredStep + window[1].scoredStep) / sum : null,
          scoredCentroidOffsetMs: sum > 1e-9 ? window.reduce((s: number, x: any) => s + x.scoredStep * (x.f - authoredFrame) * 25, 0) / sum : null,
          scoredPeakShare: sum > 1e-9 ? peaks.scoredStep.landingPeak / sum : null,
          construction: request?.construction ?? section?.shape ?? 'arcs', guidance: request?.guidance ?? 'optional', layout: request?.railLayout ?? 'paired',
          guideAtLanding: frames[f].contacts.some((c: string) => c.startsWith('guide:')),
          landingContacts: frames[f].contacts, peaks, nearestAnalysisAttack: onset,
          localEvents: det.events.filter(e => e.frame >= halfStart && e.frame < halfEnd),
          // Separate a second local impulse from the intended landing; relative thresholds are descriptive only.
          secondaryPeaks: neighborhood.filter((x, j, xs) => x.solverImpulse >= 1 && x.solverImpulse >= (xs[j - 1]?.solverImpulse ?? 0) &&
            x.solverImpulse > (xs[j + 1]?.solverImpulse ?? 0) && Math.abs(x.f - authoredFrame) > 3)
            .map(x => ({frame: x.f, impulse: x.solverImpulse, contacts: x.contacts})),
        };
      });
      // Selected mechanism checks. Change only an in-memory copy; these are not
      // replacement tracks and are not qualified past the short replay horizon.
      const assayTime = version === 'current' ? ({'tiki_tiki_48s-101': 8.7, 'amour_de_ma_vie_44s-101': 7.88,
        'tiki_tiki_48s-202': 41.74} as Record<string, number>)[`${r.case.id}-${r.seed}`] : undefined;
      if (assayTime !== undefined) {
        const beat = beats.reduce((best: any, b: any) => Math.abs(b.t - assayTime) < Math.abs(best.t - assayTime) ? b : best);
        const removedIds = new Set<number>(r.track.lines.filter((l: any) => roles.has(l.id) && Math.floor((l.id - 1000) / 10000) === beat.index + 1).map((l: any) => l.id));
        assert.ok(removedIds.size);
        const altered = new Engine().setStart(r.track.startPosition, r.track.riders[0].startVelocity)
          .addLine(r.track.lines.filter((l: any) => !removedIds.has(l.id)));
        const horizon = Math.min(r.case.durationFrames, beat.actualFrame + 18);
        const alternative = detect(extractRawTrajectory(altered, horizon));
        let firstDivergence: number | null = null, firstRemovedContact: number | null = null, prefixError = 0;
        const compared = [];
        for (let f = 0; f <= Math.min(horizon, alternative.terminus.frame); f++) {
          if (firstRemovedContact === null && frames[f].lineIds.some((id: number) => removedIds.has(id))) firstRemovedContact = f;
          const a = altered.getRider(f).ballisticState().points;
          const pointError = Math.max(...r.trace.pointIds.flatMap((id: string, i: number) => [Math.abs(a[id].x - r.trace.frames[f][2 * i]), Math.abs(a[id].y - r.trace.frames[f][2 * i + 1])]));
          if (firstRemovedContact === null) prefixError = Math.max(prefixError, pointError);
          if (pointError > 1e-8 && firstDivergence === null) firstDivergence = f;
          if (f >= beat.actualFrame - 1) {
            const vin = avg(body.map(id => [a[id].vx, a[id].vy]));
            const vout = avg(body.map(id => [a[id].x - a[id].prevX, a[id].y - a[id].prevY]));
            compared.push({frame: f, originalImpulse: frames[f].solverImpulse, withoutGuideImpulse: norm(minus(vout, vin)), pointError});
          }
        }
        assert.ok(prefixError < 1e-8);
        localGuideAssays.push({song: r.case.id, seed: r.seed, time: beat.t, section: beat.index + 1, trackHash: r.trackHash,
          removedIds: [...removedIds], horizon, firstRemovedContact, firstDivergence, prefixError,
          originalImpact: beat.impact, withoutGuideImpactAtSameFrame: normImpact(contactRedirArcPxAtLanding(alternative, beat.actualFrame)!),
          alternativeTerminus: alternative.terminus, compared,
          limitation: 'Local causal probe only: no claim of complete-track validity, construction fulfillment or desirability.'});
      }
      const run = {song: r.case.id, seed: r.seed, version, path, artifactSha256: cell.sha256, trackHash: r.trackHash,
        audioSha256: r.case.audioSha256, specSha256: r.case.specSha256, analysisSha256: r.case.analysisSha256,
        jolt: manifest.plan.jolt, durationFrames: r.case.durationFrames, score: r.score, maxTraceError, maxIntegratorError,
        events: Object.fromEntries(['landing', 'bounce', 'flyThrough', 'kick'].map(type => [type, det.events.filter(e => e.frame <= r.case.durationFrames && e.type === type).length])), beats};
      runs.push(run); rawRuns.push({song: r.case.id, seed: r.seed, version, trackHash: r.trackHash, frames});
      console.log(JSON.stringify({song: r.case.id, seed: r.seed, version, beats: beats.length, maxTraceError}));
    } finally {dispose();}
  }
}
function summarize(selected: any[]) {
  return {beats: selected.length,
    landingOffsetMs: distribution(selected.map(b => b.landingOffsetMs)), compiledShiftMs: distribution(selected.map(b => b.compiledShiftMs)),
    impactError: distribution(selected.map(b => b.impactError)), firstTwoShare: distribution(selected.flatMap(b => b.firstTwoShare === null ? [] : [b.firstTwoShare])),
    scoredCentroidOffsetMs: distribution(selected.flatMap(b => b.scoredCentroidOffsetMs === null ? [] : [b.scoredCentroidOffsetMs])),
    peaks: Object.fromEntries(['scoredStep', 'solverTurn', 'solverImpulse', 'visibleTurn', 'visibleImpulse'].map(k => [k, {
      landingPeakOffsetMs: distribution(selected.map(b => b.peaks[k].landingPeakOffsetMs)),
      strongestOffsetMs: distribution(selected.map(b => b.peaks[k].strongestOffsetMs)),
      strongerBeyond75ms: selected.filter(b => b.peaks[k].offMax > b.peaks[k].onMax).length,
      twiceAsStrongBeyond75ms: selected.filter(b => b.peaks[k].onMax > 1e-9 && b.peaks[k].offMax > 2 * b.peaks[k].onMax).length,
      offToOn: distribution(selected.flatMap(b => b.peaks[k].offToOn === null ? [] : [b.peaks[k].offToOn])),
    }])), secondaryPeakBeats: selected.filter(b => b.secondaryPeaks.length).length};
}
const summaries: any[] = [];
for (const version of ['current', 'previous', 'ordinary']) for (const song of ['all', ...new Set(runs.map(r => r.song))]) {
  const selected = runs.filter(r => r.version === version && (song === 'all' || song === r.song));
  const beats = selected.flatMap(r => r.beats);
  summaries.push({version, song, tracks: selected.length, all: summarize(beats),
    strong: summarize(beats.filter(b => b.targetImpact >= .5)), veryStrong: summarize(beats.filter(b => b.targetImpact >= .8)),
    quiet: summarize(beats.filter(b => b.targetImpact <= .2))});
}
save('audit.json', {schema: 'line.beat-salience-audit.v1', collectionPath, collectionSha256: sha(readFileSync(collectionPath)),
  harnessSha256: sha(readFileSync(import.meta.filename)), notes: [
    '36 saved rides: all four songs, three seeds, current/previous/ordinary. No recompilation or changes to score, compiler, player or inputs.',
    'Beat salience proxies are descriptive, not calibrated perceptual scores. Strong means authored impact >=0.5; quiet <=0.2.',
    'Offsets are relative to authored audio times BEFORE the production jolt and frame rounding.',
    'Neighborhoods split halfway between adjacent authored contacts. Beyond75ms counts may include legitimate control/turning; they are not automatically wrong.',
    'ScoredStep uses stored incoming velocity. Solver diagnostics use this frame\'s post-solver effective velocity; visible diagnostics use actual center-of-mass position differences.',
    'Audio analysis attack maxima within ±100 ms are context, not ground-truth perceived beat annotations.',
  ], contractAssay, localGuideAssays, summaries, runs});
save('frames.json.gz', {schema: 'line.beat-salience-frames.v1', runs: rawRuns}, true);
console.log(JSON.stringify(summaries.filter(s => s.song === 'all'), null, 2));
