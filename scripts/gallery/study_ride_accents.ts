/** Whole-ride accent investigation on preserved tracks, with local causal probes.
 * No benchmark, compiler, arrangement or rendering change.
 */
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync, gzipSync} from 'node:zlib';
import {riderCorrection, localPeaks} from './ride_accents.ts';
import {inspectRailContacts} from './contacts.ts';
import {detect, extractRawTrajectory} from '../lib/detector.ts';
import {contactRedirArcPxAtLanding} from '../v0/core/substrate.ts';
import {normImpact} from '../v0/types.ts';
const {LineRiderEngine: Engine, disposeAllWasmEnginesForStudy: dispose} =
  await import(new URL('../lib/_lr_engine_wasm.ts?ride-accents-study', import.meta.url).href);
const arg = (key: string, fallback: string) => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const source = arg('source', 'generated/beat-salience-20261001'), out = arg('out', 'generated/ride-accents-20261002');
mkdirSync(out, {recursive: true});
const sha = (b: string | Buffer) => createHash('sha256').update(b).digest('hex');
const checked = (p: string) => {const b = readFileSync(p); assert.equal(sha(b), readFileSync(p + '.sha256', 'utf8').trim()); return b;};
const audit = JSON.parse(checked(join(source, 'audit.json')).toString());
const raw = JSON.parse(gunzipSync(checked(join(source, 'frames.json.gz'))).toString());
const runs: any[] = [], causal: any[] = [], series: any[] = [];
const assayPeaks: Record<string, {frame: number; section: number; negativeControl?: boolean}> = {
  'current-luna_bala_44s-101': {frame: 1703, section: 75, negativeControl: true},
  'current-tiki_tiki_48s-303': {frame: 498, section: 15},
  'current-luna_bala_44s-303': {frame: 398, section: 15},
  'current-luna_bala_44s-202': {frame: 639, section: 26},
  'current-amour_de_ma_vie_44s-101': {frame: 309, section: 14},
  'ordinary-amor_na_praia_46s-101': {frame: 927, section: 40},
};
for (const run of audit.runs) {
  const id = `${run.version}-${run.song}-${run.seed}`, r = JSON.parse(checked(run.path).toString());
  assert.equal(sha(JSON.stringify(r.track)), run.trackHash);
  const original = raw.runs.find((x: any) => x.song === run.song && x.seed === run.seed && x.version === run.version);
  assert.equal(original.trackHash, run.trackHash);
  const roles = inspectRailContacts(r, []).guideIds;
  try {
    const engine = new Engine().setStart(r.track.startPosition, r.track.riders[0].startVelocity).addLine(r.track.lines);
    const frames = original.frames.slice(0, run.durationFrames + 1).map((old: any) => {
      const state = engine.getRider(old.f).ballisticState().points, observation = riderCorrection(state);
      if (old.f) assert.ok(Math.abs(observation.meanImpulse - old.solverImpulse) < 1e-8);
      const creditFrame = old.f + 1, scoreWindows = run.beats.filter((b: any) => creditFrame >= b.actualFrame && creditFrame <= b.actualFrame + 6).map((b: any) => b.index);
      const physicalWindows = run.beats.filter((b: any) => old.f >= b.actualFrame && old.f <= b.actualFrame + 6).map((b: any) => b.index);
      return {frame: old.f, ...observation, airborne: old.airborne, contacts: old.contacts, lineIds: old.lineIds,
        visibleImpulse: old.visibleImpulse, scoreWindows, physicalWindows,
        nextFrameAirborne: original.frames[creditFrame]?.airborne ?? null,
        nextFrameScoredStep: original.frames[creditFrame]?.scoredStep ?? null,
        directResponseInsideScoreGate: scoreWindows.length > 0 && original.frames[creditFrame]?.airborne === false};
    });
    const peakRows = (key: 'meanImpulse' | 'pointRmsImpulse') => localPeaks(frames.map((f: any) => f[key])).filter(p => p.value >= .5).map(peak => {
      const f = frames[peak.frame], beat = run.beats.reduce((a: any, b: any) => Math.abs(b.t * 40 - peak.frame) < Math.abs(a.t * 40 - peak.frame) ? b : a);
      const nearby = frames.slice(Math.max(0, peak.frame - 2), peak.frame + 1);
      const collisions = [...new Set<string>(nearby.flatMap((x: any) => x.contacts))];
      const guideSections = [...new Set<number>(nearby.flatMap((x: any) => x.lineIds.filter((line: number) => roles.has(line)).map((line: number) => Math.floor((line - 1000) / 10000))))];
      return {...peak, ...f, metric: key, time: peak.frame / 40, nearestBeat: beat.index, authoredTime: beat.t,
        offsetMs: (peak.frame / 40 - beat.t) * 1000, targetImpact: beat.targetImpact, achievedImpact: beat.impact,
        landingPeak: beat.peaks.solverImpulse.landingPeak, toLandingPeak: f.meanImpulse / Math.max(1e-9, beat.peaks.solverImpulse.landingPeak),
        neighboringContacts: collisions, guideSections,
        shapes: guideSections.map(section => ({section, shape: r.sections[section]?.shape, layout: r.sections[section]?.layout})),
        class: f.physicalWindows.length ? 'landing-window' : peak.frame < beat.t * 40 ? 'before-beat' : 'after-beat'};
    });
    const peaks = peakRows('meanImpulse'), pointPeaks = peakRows('pointRmsImpulse');
    runs.push({id, song: run.song, seed: run.seed, version: run.version, path: run.path, artifactSha256: run.artifactSha256,
      trackHash: run.trackHash, beats: run.beats.length, strongBeats: run.beats.filter((b: any) => b.targetImpact >= .5).length, peaks, pointPeaks});
    series.push({id, trackHash: run.trackHash, frames});
    const assay = assayPeaks[id];
    if (assay) {
      const removed = new Set<number>(r.track.lines.filter((l: any) => roles.has(l.id) && Math.floor((l.id - 1000) / 10000) === assay.section).map((l: any) => l.id));
      assert.ok(removed.size, `${id}: no guide in selected section`);
      const first = frames.find((f: any) => f.lineIds.some((line: number) => removed.has(line)))!.frame;
      if (assay.negativeControl) assert.ok(first > assay.frame + 2);
      else assert.ok(first <= assay.frame);
      const nextBeat = run.beats.find((b: any) => b.actualFrame > assay.frame);
      const horizon = Math.min(assay.frame + 2, (nextBeat?.actualFrame ?? run.durationFrames) - 1);
      const alternative = new Engine().setStart(r.track.startPosition, r.track.riders[0].startVelocity).addLine(r.track.lines.filter((l: any) => !removed.has(l.id)));
      let prefixMaxError = 0, firstDivergence: number | null = null;
      const compared = [];
      for (let f = 0; f <= horizon; f++) {
        const points = alternative.getRider(f).ballisticState().points;
        const error = Math.max(...r.trace.pointIds.flatMap((pid: string, i: number) => [Math.abs(points[pid].x - r.trace.frames[f][2 * i]), Math.abs(points[pid].y - r.trace.frames[f][2 * i + 1])]));
        if (f < first) prefixMaxError = Math.max(prefixMaxError, error);
        if (error > 1e-8 && firstDivergence === null) firstDivergence = f;
        if (f >= Math.min(first - 1, assay.frame - 1)) compared.push({frame: f, pointError: error, original: frames[f], withoutSelectedGuide: riderCorrection(points)});
      }
      assert.ok(prefixMaxError < 1e-8); assert.equal(firstDivergence, first <= horizon ? first : null);
      const det = detect(extractRawTrajectory(alternative, horizon));
      const previousBeat = [...run.beats].reverse().find((b: any) => b.actualFrame + 6 < first);
      const previousImpact = previousBeat ? normImpact(contactRedirArcPxAtLanding(det, previousBeat.actualFrame)!) : null;
      if (previousBeat) assert.ok(Math.abs(previousImpact! - previousBeat.impact) < 1e-8);
      causal.push({id, section: assay.section, frame: assay.frame, time: assay.frame / 40, negativeControl: Boolean(assay.negativeControl), removed: [...removed], firstRemovedContact: first,
        firstDivergence, prefixMaxError, horizon, previousCompleteImpact: previousBeat ? {t: previousBeat.t, original: previousBeat.impact, alternative: previousImpact} : null,
        nextAuthoredTime: nextBeat?.t, nextOriginalImpact: nextBeat?.impact, nextTarget: nextBeat?.targetImpact, compared,
        limitation: 'Guide deletion is a local causal assay, not a valid replacement or proof the next landing remains achievable. Later trajectory is intentionally not qualified.'});
    }
    console.log(JSON.stringify({id, meanPeaks: peaks.length, pointPeaks: pointPeaks.length, assay: Boolean(assay)}));
  } finally {dispose();}
}
const summaries = [];
for (const version of ['ordinary', 'previous', 'current']) for (const unique of [false, true]) {
  const seen = new Set<string>(), selected = runs.filter(r => r.version === version).filter(r => {
    if (unique && seen.has(r.trackHash)) return false; seen.add(r.trackHash); return true;
  });
  const peaks = selected.flatMap(r => r.peaks), pointPeaks = selected.flatMap(r => r.pointPeaks);
  const thresholds = [];
  for (const absolute of [.5, 1, 2]) for (const ratio of [.5, 1, 2]) for (const strongOnly of [false, true]) {
    const xs = peaks.filter(p => p.class !== 'landing-window' && Math.abs(p.offsetMs) > 75 && p.value >= absolute && p.toLandingPeak > ratio && (!strongOnly || p.targetImpact >= .5));
    thresholds.push({absolute, ratio, strongOnly, peaks: xs.length, before: xs.filter(p => p.class === 'before-beat').length,
      after: xs.filter(p => p.class === 'after-beat').length, withRecentGuideCollision: xs.filter(p => p.guideSections.length).length,
      slowingDown: xs.filter(p => p.speedGain < 0).length, outsideAllLandingScoreWindows: xs.filter(p => !p.scoreWindows.length).length,
      nextFrameAirborne: xs.filter(p => p.nextFrameAirborne).length});
  }
  summaries.push({version, unique, tracks: selected.length, beats: selected.reduce((n, r) => n + r.beats, 0),
    strongBeats: selected.reduce((n, r) => n + r.strongBeats, 0), thresholds,
    nontranslationalPeaks: pointPeaks.filter(p => p.value >= 1 && p.meanImpulse < .5 && p.class !== 'landing-window').length});
}
const result = {schema: 'line.ride-accent-investigation.v1', harnessSha256: sha(readFileSync(import.meta.filename)),
  observerSha256: sha(readFileSync('scripts/gallery/ride_accents.ts')), sourceAuditSha256: sha(checked(join(source, 'audit.json'))),
  engineSha256: sha(readFileSync('engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm')),
  notes: ['No new scalar aesthetic score. Threshold sweeps are descriptive sensitivity checks, not tuned acceptance bars.',
    'Body mean correction detects translation/turning; point RMS also retains opposing corrections cancelled in that mean. Relative RMS includes rotation and articulation, not only undesirable motion.',
    'Mean correction exactly reproduces the independently saved full-ride diagnostic within 1e-8.',
    'Stored velocity at f+1 contains the solver response at f plus gravity; directResponseInsideScoreGate reports window membership and grounding at f+1, not causal attribution of all later consequences.',
    'Guide collision in the same or preceding two frames is association. Only the separately reported deletion assays establish local causation.',
    'A peak outside the landing window is not automatically unwanted. Some are intentional useful transfers or music accents missing from the contact specification.',
    'Raw counts include repeated ordinary geometries; unique=true separately deduplicates by track hash. Neither sample is an independent randomized experiment.'], summaries, causal, runs};
for (const [name, bytes] of [['audit.json', Buffer.from(JSON.stringify(result) + '\n')], ['audit.json.gz', gzipSync(JSON.stringify(result) + '\n')],
  ['frames.json.gz', gzipSync(JSON.stringify({schema: 'line.ride-accent-frames.v1', series}) + '\n')]] as const) {
  writeFileSync(join(out, name), bytes); writeFileSync(join(out, name + '.sha256'), sha(bytes) + '\n');
}
