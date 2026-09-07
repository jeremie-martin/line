/** Frozen component experiment: authored-output geometry relaxation followed
 * by ordinary first-completion search. Every original pair remains in the assay.
 * No full-track score is observed while choosing a local numerical update.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { compilerCandidateIdentity } from "../v0/benchmark_v2/compiler_identity.ts";
import { createSnapshotWorkspace, disposeSnapshotWorkspace } from "../v0/benchmark_v2/compiler_snapshot.ts";
import { buildAxisContract, scoreV2Report } from "../v0/benchmark_v2/evaluator.ts";
import { compileHandoffFromSnapshot, type HandoffNodeSnapshot } from "../v0/optimizer/handoff.ts";
import { makeRootNode, extendNodeCached } from "../v0/optimizer/node.ts";
import { makeBaseEngine, engineLineFromTrackLine } from "../v0/core/substrate.ts";
import { tryCandidateLines, axisLookaheadEndFrame } from "../v0/core/candidate.ts";
import { getCandidateProbe } from "../v0/optimizer/sample.ts";
import { scoreDriftReport } from "../v0/score.ts";
import { impactToRawPx } from "../v0/types.ts";
import { getPhysicsFrameCount } from "../lib/detector.ts";
import { read, write, deform } from "./impact_release_response.ts";
import { ridgeStep, broydenUpdate } from "./impact_axis_math.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const baseDirectory = "generated/benchmark-v2/impact-delivery-650-new";
const captures = resolve(arg("captures") ?? `${baseDirectory}/continuation-capture`);
const input = resolve(arg("input") ?? `${baseDirectory}/selected-fit-trace`);
const parentPath = resolve(arg("parent") ?? `${baseDirectory}/contact-pair-response/plan.json`);
const out = resolve(arg("out") ?? `${baseDirectory}/authored-output-relaxation`);
const script = fileURLToPath(import.meta.url), hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const dependencies = ["scripts/benchmark/impact_axis_math.ts", "scripts/benchmark/impact_release_response.ts"];
const implementation = [script, ...dependencies].map(p => hash(readFileSync(p))).join(":");
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const parent = read(parentPath), parentSha256 = hash(readFileSync(parentPath));
const weights = benchmarkPolicy.componentWeights;
type Axis = keyof typeof weights;
const axes = Object.keys(weights) as Axis[];
const norm = (values: number[]) => Math.hypot(...values);
const square = (values: number[]) => values.reduce((s, v) => s + v * v, 0);
const lineKey = (lines: any[]) => JSON.stringify(lines.map(l => [l.id, l.type, l.x1, l.y1, l.x2, l.y2,
  !!l.flipped, !!l.leftExtended, !!l.rightExtended]));
mkdirSync(out, { recursive: true });

function root(capture: any, count = 0): any {
  const stored = capture.snapshot.node;
  let engine = makeBaseEngine(stored.startState);
  if (stored.startLines.length) engine = engine.addLine(stored.startLines.map(engineLineFromTrackLine));
  let node = { ...makeRootNode(engine, capture.context.gaps.length), prefixNextLineId: 1 + stored.startLines.length };
  for (const fit of stored.search.prefixFits.slice(0, count)) node = extendNodeCached(node, fit);
  return node;
}
function snapshot(capture: any, search: any): HandoffNodeSnapshot {
  const stored = capture.snapshot.node;
  // Trace is historical provenance only; the two intervention entries are
  // explicitly identified in the study record, never claimed as ordinary wins.
  return { ...capture.snapshot, node: { ...stored, search, rankTrace: stored.rankTrace.slice(0, search.gapIndex) } };
}

function worker(source: any, requestSha256: string): void {
  if (compilerCandidateIdentity("wasm").candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("wrong compiler snapshot");
  const started = performance.now(), sourceId = source.sourceId;
  const capturePath = resolve(captures, `${sourceId}.capture.json`), capture = read(capturePath);
  const preflight = read(resolve(captures, `${sourceId}.preflight.json`));
  if (!preflight.trackExact || !preflight.reportExact || !preflight.scoreExact ||
      preflight.captureSha256 !== hash(readFileSync(capturePath)) ||
      capture.candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("unverified capture");
  const recordPath = resolve(input, `${sourceId}.json`), trackPath = resolve(input, `${sourceId}.track.json`);
  if (hash(readFileSync(recordPath)) !== source.recordSha256 || hash(readFileSync(trackPath)) !== source.trackSha256) throw new Error("census changed");
  const record = read(recordPath), track = read(trackPath);
  const spec = applyJolt(developmentCases.find(e => e.case.metadata.id === sourceId)!.case.spec, benchmarkPolicy.transform.joltMs);
  const contract = buildAxisContract(spec, axes);
  const suite = { component_weights: weights, axis_quality_tolerance: benchmarkPolicy.axisQualityTolerance };
  const stored = capture.snapshot.node;
  const replay = compileHandoffFromSnapshot(spec, capture.seed, snapshot(capture, root(capture, stored.search.gapIndex)), {
    budget: capture.budget, searchSeed: stored.searchSeed, stopAfterFirstCompletion: true,
  });
  if (hash(JSON.stringify(replay.report)) !== capture.reportHash || hash(JSON.stringify(replay.track)) !== capture.trackHash) throw new Error("warmup changed baseline");
  const incumbent = scoreV2Report(replay.report, spec.contacts.length, contract, suite);
  if (!incumbent.valid) throw new Error("incumbent is not V2 valid");
  const warmupFrames = getPhysicsFrameCount(), states: any[] = [];
  for (const selection of source.selections) {
    const statePath = resolve(out, `${sourceId}-g${selection.gapIndex}.json`);
    if (existsSync(statePath)) {
      const previous = read(statePath);
      if (previous.requestSha256 !== requestSha256) throw new Error("state checkpoint changed");
      states.push(previous); continue;
    }
    if (!selection.eligible) throw new Error("declared cohort unexpectedly contains unavailable geometry");
    const firstIndex = selection.gapIndex, anchor = firstIndex + 2;
    if (selection.second.gapIndex !== firstIndex + 1) throw new Error("nonadjacent pair");
    const localStart = getPhysicsFrameCount(), prefix = root(capture, firstIndex);
    const originals = stored.search.prefixFits.slice(firstIndex, anchor);
    const ownedIds = new Set<number>(originals.flatMap((fit: any) => fit.lines.map((l: any) => l.id)));
    if (selection.coordinates.some((c: any) => !ownedIds.has(track.lines[c.left].id) || !ownedIds.has(track.lines[c.right].id))) throw new Error("basis escapes pair ownership");
    const ctx = { ...capture.context, probeCache: undefined };
    const targets = [0, 1].map(offset => ctx.gapAxisTargets[firstIndex + offset]);
    if (targets.some(t => Object.keys(t).some(axis => !axes.includes(axis as Axis)))) throw new Error("unweighted authored axis");
    const active = axes.filter(axis => targets.some(t => t[axis] !== undefined));
    const totalWeight = active.reduce((s, axis) => s + weights[axis], 0);
    const features = targets.flatMap((t, offset) => active.filter(axis => t[axis] !== undefined).map(axis => ({
      offset, axis, scale: Math.sqrt(weights[axis] / totalWeight / targets.filter(v => v[axis] !== undefined).length), target: t[axis],
    })));
    function measure(controls: number[]): any | null {
      const changed = deform(track, selection, controls), byId = new Map<number, any>(changed.lines.map((l: any) => [l.id, l]));
      let node = prefix;
      const fits: any[] = [];
      for (let offset = 0; offset < 2; offset++) {
        const gap = ctx.gaps[firstIndex + offset], probe = getCandidateProbe(node.prefixEngine, gap, ctx);
        const lines = originals[offset].lines.map((l: any) => byId.get(l.id)!);
        const fit = tryCandidateLines(node.prefixEngine, gap, lines, node.prefixNextLineId,
          ctx.allContactFrames, axisLookaheadEndFrame(gap, ctx.allContactFrames), gap.targets, true,
          "normal", probe.preTargetSledTrace, { allowRideOutPolish: false });
        if (!fit) return null;
        if (lineKey(fit.lines) !== lineKey(lines)) throw new Error("admission mutated intervention");
        fits.push(fit); node = extendNodeCached(node, fit);
      }
      const outputs = features.map(f => fits[f.offset].achieved[f.axis] * f.scale);
      const residual = features.map((f, i) => outputs[i] - f.target * f.scale);
      if (![...outputs, ...residual].every(Number.isFinite)) throw new Error("nonfinite authored output");
      return { fits, outputs, residual, objective: square(residual), node,
        firstImpactError: Math.abs(fits[0].achieved.impact - targets[0].impact) };
    }
    const zero = Array(selection.coordinates.length).fill(0), initial = measure(zero);
    if (!initial || initial.fits.some((fit: any, offset: number) => Object.keys(targets[offset]).some(axis => fit.achieved[axis] !== originals[offset].achieved[axis]))) throw new Error("zero proposal mismatch");
    const setupFrames = getPhysicsFrameCount() - localStart, derivativeStart = getPhysicsFrameCount();
    const columns = zero.map((_, index) => {
      const stencil = [1e-5, -1e-5, 5e-6, -5e-6].map(step => {
        const controls = zero.slice(); controls[index] = step;
        const measured = measure(controls); return measured?.outputs ?? null;
      });
      if (stencil.some(v => v === null)) return { index, eligible: false, reason: "admission" };
      const broad = stencil[0]!.map((v: number, i: number) => (v - stencil[1]![i]) / 2e-5);
      const fine = stencil[2]!.map((v: number, i: number) => (v - stencil[3]![i]) / 1e-5);
      const disagreement = norm(broad.map((v: number, i: number) => v - fine[i])) / Math.max(norm(fine), 1e-12);
      const eligible = disagreement <= 0.01 && norm(fine) > 1e-9;
      return { index, eligible, disagreement, reason: disagreement > 0.01 ? "precision" : norm(fine) <= 1e-9 ? "inactive" : null,
        derivative: fine.map((v: number, i: number) => (4 * v - broad[i]) / 3) };
    });
    const derivativeFrames = getPhysicsFrameCount() - derivativeStart, stepStart = getPhysicsFrameCount();
    const stable = columns.filter(c => c.eligible);
    let j = features.map((_, i) => stable.map(c => c.derivative![i]));
    let controls = zero.slice(), current = initial, radius = 0.001, stopReason = stable.length ? "update_cap" : "no_stable_response";
    const updates: any[] = [];
    for (let iteration = 0; stable.length && iteration < 12; iteration++) {
      const rawStep = ridgeStep(j, current.residual), largest = Math.max(...rawStep.map(Math.abs));
      if (!(largest > 1e-12)) { stopReason = "stationary"; break; }
      let scale = Math.min(1, radius / largest);
      stable.forEach((c, k) => { if (rawStep[k]) scale = Math.min(scale, (0.1 - Math.sign(rawStep[k]) * controls[c.index]) / Math.abs(rawStep[k])); });
      if (!(scale > 1e-12)) { stopReason = "coordinate_bound"; break; }
      const step = rawStep.map(v => v * scale), nextControls = controls.slice();
      stable.forEach((c, k) => nextControls[c.index] += step[k]);
      const predictedResidual = current.residual.map((v: number, i: number) => v + j[i].reduce((s, c, k) => s + c * step[k], 0));
      const predictedGain = current.objective - square(predictedResidual);
      if (!(predictedGain > 0)) { stopReason = "no_predicted_gain"; break; }
      const measured = measure(nextControls), actualGain = measured ? current.objective - measured.objective : null;
      const ratio = actualGain === null ? null : actualGain / predictedGain;
      const accepted = measured !== null && actualGain! > 0 && ratio! >= 0.25 && measured.firstImpactError <= current.firstImpactError;
      updates.push({ iteration, radius, controls: nextControls, predictedGain, actualGain, ratio, admitted: measured !== null, accepted,
        firstImpactError: measured?.firstImpactError ?? null, objective: measured?.objective ?? null });
      if (!accepted) { stopReason = measured === null ? "step_admission" : measured.firstImpactError > current.firstImpactError ? "first_impact_worse" : "step_model"; break; }
      j = broydenUpdate(j, step, measured.outputs.map((v: number, i: number) => v - current.outputs[i]));
      controls = nextControls; current = measured;
      if (ratio! > 0.75) radius = Math.min(0.1, radius * 2);
    }
    const stepFrames = getPhysicsFrameCount() - stepStart;
    const changed = lineKey(current.fits.flatMap((fit: any) => fit.lines)) !== lineKey(originals.flatMap((fit: any) => fit.lines));
    const budget = Math.max(1, Math.ceil(capture.budget * (ctx.gaps.length - anchor) / ctx.gaps.length));
    function resume(search: any, name: string): any {
      const begin = performance.now();
      const result = compileHandoffFromSnapshot(spec, capture.seed, snapshot(capture, search), {
        budget, searchSeed: stored.searchSeed, stopAfterFirstCompletion: true,
      });
      const frames = getPhysicsFrameCount(), v2 = scoreV2Report(result.report, spec.contacts.length, contract, suite);
      const native = scoreDriftReport(result.report, { totalFrames: ctx.durationFrames });
      const returned = new Map<number, any>(result.track.lines.map(l => [l.id, l]));
      const expected = [...stored.startLines, ...search.prefixFits.flatMap((fit: any) => fit?.lines ?? [])];
      const prefixRetained = expected.every(l => returned.has(l.id) && lineKey([returned.get(l.id)]) === lineKey([l]));
      const firstAxes = result.report.gaps.find(g => g.gap_index === firstIndex)?.axes;
      const evidencePath = resolve(out, `${sourceId}-g${firstIndex}-${name}.track.json`);
      // Retain every full physical result, including failures, for exact audit.
      write(evidencePath, result.track);
      write(resolve(out, `${sourceId}-g${firstIndex}-${name}.report.json`), result.report);
      return { score: v2.score, valid: v2.valid, hardFailures: v2.hardFailures, firstAxes, prefixRetained,
        nativeScore: native.contract_passed ? native.score : 0, frames, elapsedMs: performance.now() - begin,
        trackSha256: hash(readFileSync(evidencePath)), reused: false };
    }
    const control = resume(root(capture, anchor), "control");
    const candidate = changed ? resume(current.node, "candidate") : { ...control, frames: 0, elapsedMs: 0, reused: true };
    const baselineRow = record.rows.find((row: any) => row.gapIndex === firstIndex);
    const localRawGain = impactToRawPx(current.fits[0].achieved.impact) - baselineRow.rawImpulse;
    const finalImpact = candidate.firstAxes?.impact?.achieved;
    const finalRawGain = finalImpact === undefined ? null : impactToRawPx(finalImpact) - baselineRow.rawImpulse;
    const pairedDelta = candidate.score - control.score, incumbentDelta = candidate.score - incumbent.score;
    const useful = changed && candidate.valid && candidate.prefixRetained && finalRawGain !== null &&
      finalRawGain >= selection.requestedRawGain && pairedDelta > 0 && incumbentDelta > 0;
    const state = { schema: "line.impact-axis-relaxation-state.v1", requestSha256, sourceId, gapIndex: firstIndex, anchor, budget,
      features, columns, controls, updates, stopReason, changed, initialObjective: initial.objective, finalObjective: current.objective,
      initialAxes: originals.map((fit: any) => fit.achieved), finalLocalAxes: current.fits.map((fit: any) => fit.achieved),
      requestedRawGain: selection.requestedRawGain, localRawGain, finalRawGain, control, candidate,
      pairedDelta, incumbentDelta, useful, setupFrames, derivativeFrames, stepFrames,
      localFrames: setupFrames + derivativeFrames + stepFrames, suffixFrames: control.frames + candidate.frames };
    write(statePath, state); states.push(state);
  }
  write(resolve(out, `${sourceId}.json`), { schema: "line.impact-axis-relaxation-source.v1", implementation, requestSha256,
    sourceId, incumbent, warmupFrames, states, elapsedMs: performance.now() - started });
}

const request = { schema: "line.impact-axis-relaxation-request.v1", implementation, parentSha256,
  candidateFingerprint: baseline.candidate_fingerprint, captures: parent.sources.map((s: any) => ({ sourceId: s.sourceId,
    captureSha256: hash(readFileSync(resolve(captures, `${s.sourceId}.capture.json`))) })),
  law: { weights, derivativeSteps: [1e-5, 5e-6], precisionGate: 0.01, ridge: 1e-6, updates: 12,
    initialRadius: 0.001, maximumRadius: 0.1, coordinateBound: 0.1, admissionRatio: 0.25, expansionRatio: 0.75,
    update: "accepted Broyden secant only; no retries or refits; first impact absolute error cannot increase",
    suffix: "ordinary first completion, ceil(original budget * remaining gaps / all gaps), common seed and historical trace",
    success: "at least 25% raw first-impact deficit retained, valid, beats original V2 incumbent and paired ordinary continuation" } };
const requestPath = resolve(out, "request.json");
if (existsSync(requestPath)) {
  if (JSON.stringify(read(requestPath)) !== JSON.stringify(request)) throw new Error("frozen request changed");
} else write(requestPath, request);
const requestSha256 = hash(readFileSync(requestPath));
if (process.argv.includes("--plan")) console.log(JSON.stringify({ sources: parent.sources.length,
  pairs: parent.sources.reduce((s: number, source: any) => s + source.selections.length, 0), requestSha256 }));
else if (arg("worker")) worker(parent.sources.find((s: any) => s.sourceId === arg("worker")), requestSha256);
else {
  const jobs = Number(arg("jobs") ?? "8");
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error("invalid jobs");
  const queue = parent.sources.filter((s: any) => {
    const path = resolve(out, `${s.sourceId}.json`);
    if (!existsSync(path)) return true;
    if (read(path).requestSha256 !== requestSha256) throw new Error("incompatible checkpoint");
    return false;
  });
  if (queue.length) {
    const workspace = createSnapshotWorkspace(baseline.compiler_snapshot), environment = { ...process.env };
    for (const key of Object.keys(environment)) if (key.startsWith("LR_")) delete environment[key];
    Object.assign(environment, baseline.compiler_snapshot.compilerEnvironment, { LR_ENGINE: "wasm" });
    try {
      copyFileSync(script, resolve(workspace.directory, "scripts/benchmark/impact_axis_relaxation.ts"));
      for (const path of dependencies) copyFileSync(path, resolve(workspace.directory, path));
      const failures: string[] = [];
      await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
        while (queue.length) {
          const source = queue.shift()!;
          const code = await new Promise<number | null>((done, reject) => {
            const child = spawn(process.execPath, ["--import", "tsx", "scripts/benchmark/impact_axis_relaxation.ts",
              `--worker=${source.sourceId}`, `--captures=${captures}`, `--input=${input}`, `--parent=${parentPath}`, `--out=${out}`],
              { cwd: workspace.directory, env: environment, stdio: ["ignore", "ignore", "inherit"] });
            child.on("error", reject); child.on("exit", done);
          });
          if (code !== 0) failures.push(`${source.sourceId}: ${code}`);
          else process.stderr.write(`${source.sourceId}: authored-output and suffix assay complete\n`);
        }
      }));
      if (failures.length) throw new Error(failures.join("\n"));
    } finally { disposeSnapshotWorkspace(workspace); }
  }
  const results: any[] = parent.sources.map((s: any) => read(resolve(out, `${s.sourceId}.json`)));
  const states: any[] = results.flatMap(r => r.states);
  const positive = states.filter(s => s.changed && s.candidate.valid && s.candidate.prefixRetained && s.pairedDelta > 0 && s.incumbentDelta > 0);
  const sum = (key: string) => states.reduce((s, row) => s + row[key], 0);
  const summary = { schema: "line.impact-axis-relaxation-summary.v1", implementation, requestSha256,
    sources: results.length, pairs: states.length, changed: states.filter(s => s.changed).length,
    validControl: states.filter(s => s.control.valid).length, validChanged: states.filter(s => s.changed && s.candidate.valid).length,
    positiveAgainstBoth: positive.length, useful: states.filter(s => s.useful).length,
    localUseful: states.filter(s => s.localRawGain >= s.requestedRawGain).length,
    finalUsefulGain: states.filter(s => s.finalRawGain !== null && s.finalRawGain >= s.requestedRawGain).length,
    lostChangedPrefix: states.filter(s => s.changed && !s.candidate.prefixRetained).length,
    maximumPositiveIncumbentGain: Math.max(0, ...positive.map(s => s.incumbentDelta)),
    allPairedDeltaSum: sum("pairedDelta"), allIncumbentDeltaSum: sum("incumbentDelta"),
    warmupFrames: results.reduce((s, r) => s + r.warmupFrames, 0), localFrames: sum("localFrames"),
    derivativeFrames: sum("derivativeFrames"), stepFrames: sum("stepFrames"), suffixFrames: sum("suffixFrames"),
    workerSeconds: results.reduce((s, r) => s + r.elapsedMs / 1000, 0),
    stopReasons: Object.fromEntries([...new Set(states.map(s => s.stopReason))].map(reason => [reason, states.filter(s => s.stopReason === reason).length])) };
  write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
}
