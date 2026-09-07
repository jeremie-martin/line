/** Interrupted passive support, exact admission, and ordinary suffix controls. */
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
import { compileHandoffFromSnapshot } from "../v0/optimizer/handoff.ts";
import { makeRootNode, extendNodeCached } from "../v0/optimizer/node.ts";
import { makeBaseEngine, engineLineFromTrackLine, contactRedirArcPxAtLanding } from "../v0/core/substrate.ts";
import { tryCandidateLines, axisLookaheadEndFrame } from "../v0/core/candidate.ts";
import { getCandidateProbe } from "../v0/optimizer/sample.ts";
import { IMPACT_WINDOW, impactToRawPx } from "../v0/types.ts";
import { detect, extractRawTrajectory, getRiderMetered, getPhysicsFrameCount } from "../lib/detector.ts";
import { read, write, state, buildEngine } from "./impact_release_response.ts";
import { interruptSupport, isConnectedSolid } from "./impact_support_gap.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const input = resolve(arg("input") ?? "generated/benchmark-v2/impact-delivery-650-new/interrupted-support-capture");
const out = resolve(arg("out") ?? "generated/benchmark-v2/impact-delivery-650-new/interrupted-support-response");
const script = fileURLToPath(import.meta.url), hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const dependencies = ["scripts/benchmark/impact_support_gap.ts", "scripts/benchmark/impact_release_response.ts"];
const implementation = [script, ...dependencies].map(p => hash(readFileSync(p))).join(":");
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const lineKey = (lines: any[]) => JSON.stringify(lines.map(l => [l.id, l.type, l.x1, l.y1, l.x2, l.y2,
  !!l.flipped, !!l.leftExtended, !!l.rightExtended]));
mkdirSync(out, { recursive: true });

function makePlan(): any {
  const summary = read(resolve(input, "summary.json"));
  if (summary.sources !== 44 || summary.seed !== 260907001 || summary.candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("wrong fresh census");
  const sources = summary.perSource.map((source: any) => {
    const recordPath = resolve(input, `${source.sourceId}.json`), capturePath = resolve(input, `${source.sourceId}.capture.json`);
    const record = read(recordPath), capture = read(capturePath);
    const eligible = record.rows.filter((row: any) => row.geometryMatches && row.actualFrame !== null &&
      row.finalAxes.impact.target - row.finalImpact >= 0.05 && row.frames.length === IMPACT_WINDOW + 1 && row.frames.every((f: any) => f.contacted) &&
      row.nextGapFrames !== null && row.targetFrame + row.nextGapFrames - 2 > row.actualFrame + IMPACT_WINDOW &&
      isConnectedSolid(capture.snapshot.node.search.prefixFits[row.gapIndex]?.lines ?? []));
    const selected: any[] = [];
    for (const fraction of [1 / 3, 2 / 3]) {
      const available = eligible.filter((r: any) => !selected.some(s => s.gapIndex === r.gapIndex));
      available.sort((a: any, b: any) => Math.abs(a.targetFrame / capture.context.durationFrames - fraction) - Math.abs(b.targetFrame / capture.context.durationFrames - fraction) || a.gapIndex - b.gapIndex);
      if (available.length) {
        const r = available[0];
        selected.push({ gapIndex: r.gapIndex, impactFrame: r.actualFrame, targetFrame: r.targetFrame,
          centerFrame: r.actualFrame + IMPACT_WINDOW / 2, incomingSpeed: Math.hypot(r.incomingVelocity.x, r.incomingVelocity.y),
          baselineRawImpulse: r.rawImpulse, targetImpact: r.finalAxes.impact.target,
          requestedRawGain: 0.25 * (impactToRawPx(r.finalAxes.impact.target) - r.rawImpulse) });
      }
    }
    return { sourceId: source.sourceId, eligible: eligible.length, selected,
      recordSha256: hash(readFileSync(recordPath)), captureSha256: hash(readFileSync(capturePath)) };
  });
  return { schema: "line.interrupted-support-response-plan.v1", implementation,
    candidateFingerprint: baseline.candidate_fingerprint, censusSha256: hash(readFileSync(resolve(input, "summary.json"))),
    law: "one arclength gap centered on the four sled points at H+3, width projected span plus one incoming-speed frame; exact catch prefix; ordinary first completion; no width/phase sweep",
    sources };
}
function root(capture: any, count: number): any {
  const stored = capture.snapshot.node;
  let engine = makeBaseEngine(stored.startState);
  if (stored.startLines.length) engine = engine.addLine(stored.startLines.map(engineLineFromTrackLine));
  let node = { ...makeRootNode(engine, capture.context.gaps.length), prefixNextLineId: 1 + stored.startLines.length };
  for (const fit of stored.search.prefixFits.slice(0, count)) node = extendNodeCached(node, fit);
  return node;
}
function snapshot(capture: any, search: any): any {
  const stored = capture.snapshot.node;
  return { ...capture.snapshot, node: { ...stored, search, rankTrace: stored.rankTrace.slice(0, search.gapIndex) } };
}
function trace(engine: any, selection: any, returnIds: Set<number>): any {
  const det = detect(extractRawTrajectory(engine, selection.impactFrame + IMPACT_WINDOW));
  const prefixHash = createHash("sha256"), windowHash = createHash("sha256");
  for (let frame = 0; frame <= selection.impactFrame; frame++) prefixHash.update(state(engine, frame).key + "\n");
  const frames: any[] = [];
  for (let frame = selection.impactFrame; frame <= selection.impactFrame + IMPACT_WINDOW; frame++) {
    windowHash.update(state(engine, frame).key + "\n");
    const events = engine.getUpdatesAtFrame(frame).filter((u: any) => u.type === "CollisionUpdate")
      .map((u: any) => ({ lineId: u.id, points: u.updated.map((p: any) => p.id), returnSide: returnIds.has(u.id) }));
    frames.push({ frame, contacted: det.measurements.airborne[frame] === false, events });
  }
  const interruptedAndRecaptured = frames.some((f, i) => !f.contacted && frames.slice(i + 1).some(next => next.contacted && next.events.some((e: any) => e.returnSide)));
  return { prefixHash: prefixHash.digest("hex"), windowHash: windowHash.digest("hex"), frames, interruptedAndRecaptured,
    rawImpulse: contactRedirArcPxAtLanding(det, selection.impactFrame) ?? null };
}
function worker(source: any, planSha256: string): void {
  if (compilerCandidateIdentity("wasm").candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("wrong compiler snapshot");
  const started = performance.now(), sourceId = source.sourceId;
  const capturePath = resolve(input, `${sourceId}.capture.json`), capture = read(capturePath);
  const preflight = read(resolve(input, `${sourceId}.preflight.json`)), recordPath = resolve(input, `${sourceId}.json`);
  if (hash(readFileSync(capturePath)) !== source.captureSha256 || hash(readFileSync(recordPath)) !== source.recordSha256 ||
      preflight.captureSha256 !== source.captureSha256 || !preflight.trackExact || !preflight.reportExact || !preflight.scoreExact) throw new Error("capture identity mismatch");
  const spec = applyJolt(developmentCases.find(e => e.case.metadata.id === sourceId)!.case.spec, benchmarkPolicy.transform.joltMs);
  const contract = buildAxisContract(spec, Object.keys(benchmarkPolicy.componentWeights) as Array<keyof typeof benchmarkPolicy.componentWeights>);
  const suite = { component_weights: benchmarkPolicy.componentWeights, axis_quality_tolerance: benchmarkPolicy.axisQualityTolerance };
  const stored = capture.snapshot.node, ctx = { ...capture.context, probeCache: undefined };
  const warmup = compileHandoffFromSnapshot(spec, capture.seed, snapshot(capture, root(capture, stored.search.gapIndex)), {
    budget: capture.budget, searchSeed: stored.searchSeed, stopAfterFirstCompletion: true,
  });
  if (hash(JSON.stringify(warmup.track)) !== capture.trackHash || hash(JSON.stringify(warmup.report)) !== capture.reportHash) throw new Error("warmup mismatch");
  const incumbent = scoreV2Report(warmup.report, spec.contacts.length, contract, suite), warmupFrames = getPhysicsFrameCount();
  const states: any[] = [];
  for (const selection of source.selected) {
    const statePath = resolve(out, `${sourceId}-g${selection.gapIndex}.json`);
    if (existsSync(statePath)) {
      const saved = read(statePath); if (saved.planSha256 !== planSha256) throw new Error("changed state checkpoint");
      states.push(saved); continue;
    }
    const localStart = getPhysicsFrameCount(), index = selection.gapIndex, prefix = root(capture, index), original = stored.search.prefixFits[index];
    const gap = ctx.gaps[index], probe = getCandidateProbe(prefix.prefixEngine, gap, ctx);
    function admit(lines: any[]): any {
      return tryCandidateLines(prefix.prefixEngine, gap, lines, prefix.prefixNextLineId,
        ctx.allContactFrames, axisLookaheadEndFrame(gap, ctx.allContactFrames), gap.targets, true,
        "normal", probe.preTargetSledTrace, { allowRideOutPolish: false });
    }
    const unmodified = admit(original.lines);
    if (!unmodified || lineKey(unmodified.lines) !== lineKey(original.lines) ||
        Object.keys(ctx.gapAxisTargets[index]).some(axis => unmodified.achieved[axis] !== original.achieved[axis])) throw new Error("ordinary admission mismatch");
    const baselineNode = extendNodeCached(prefix, original), baselineTrace = trace(baselineNode.prefixEngine, selection, new Set());
    if (baselineTrace.rawImpulse === null || Math.abs(baselineTrace.rawImpulse - selection.baselineRawImpulse) > 1e-9 ||
        baselineTrace.frames.some((f: any) => !f.contacted)) throw new Error("baseline support mismatch");
    const packet = getRiderMetered(baselineNode.prefixEngine, selection.centerFrame).ballisticState();
    const sledPoints = ["PEG", "TAIL", "NOSE", "STRING"].map(id => ({ x: packet.points[id].x, y: packet.points[id].y }));
    const construction = interruptSupport(original.lines, sledPoints, selection.incomingSpeed);
    const changedFit = construction.available ? admit(construction.lines) : null;
    if (changedFit && lineKey(changedFit.lines) !== lineKey(construction.lines)) throw new Error("admission mutated proposal");
    const returnIds = new Set<number>(construction.available ? construction.origins.filter((o: any) => o.side === "after").map((o: any) => o.id) : []);
    const changedNode = changedFit ? extendNodeCached(prefix, changedFit) : null;
    const local = changedNode ? trace(changedNode.prefixEngine, selection, returnIds) : null;
    const prefixExact = local !== null && local.prefixHash === baselineTrace.prefixHash;
    const localFrames = getPhysicsFrameCount() - localStart;
    const anchor = index + 1, budget = Math.max(1, Math.ceil(capture.budget * (ctx.gaps.length - anchor) / ctx.gaps.length));
    function resume(search: any, name: string): any {
      const start = performance.now();
      const result = compileHandoffFromSnapshot(spec, capture.seed, snapshot(capture, search), {
        budget, searchSeed: stored.searchSeed, stopAfterFirstCompletion: true,
      });
      const frames = getPhysicsFrameCount(), score = scoreV2Report(result.report, spec.contacts.length, contract, suite);
      const returned = new Map<number, any>(result.track.lines.map(l => [l.id, l]));
      const expected = [...stored.startLines, ...search.prefixFits.flatMap((fit: any) => fit?.lines ?? [])];
      const prefixRetained = expected.every(l => returned.has(l.id) && lineKey([returned.get(l.id)]) === lineKey([l]));
      const verificationStart = getPhysicsFrameCount();
      const realized = trace(buildEngine(result.track), selection, returnIds);
      const verificationFrames = getPhysicsFrameCount() - verificationStart;
      write(resolve(out, `${sourceId}-g${index}-${name}.track.json`), result.track);
      write(resolve(out, `${sourceId}-g${index}-${name}.report.json`), result.report);
      return { score: score.score, valid: score.valid, hardFailures: score.hardFailures, prefixRetained, realized,
        firstAxes: result.report.gaps.find(g => g.gap_index === index)?.axes ?? null, frames, verificationFrames,
        elapsedMs: performance.now() - start };
    }
    const control = prefixExact ? resume(baselineNode, "control") : null;
    const candidate = prefixExact ? resume(changedNode, "candidate") : null;
    const retained = candidate !== null && candidate.prefixRetained && candidate.realized.prefixHash === local.prefixHash &&
      candidate.realized.windowHash === local.windowHash && candidate.realized.interruptedAndRecaptured;
    const finalRawGain = candidate?.realized.rawImpulse === null || !candidate ? null : candidate.realized.rawImpulse - selection.baselineRawImpulse;
    const pairedDelta = candidate && control ? candidate.score - control.score : null;
    const incumbentDelta = candidate ? candidate.score - incumbent.score : null;
    const useful = !!(retained && candidate.valid && finalRawGain !== null && finalRawGain >= selection.requestedRawGain &&
      pairedDelta !== null && pairedDelta > 0 && incumbentDelta !== null && incumbentDelta > 0);
    const result = { schema: "line.interrupted-support-response-state.v1", planSha256, sourceId, selection, construction,
      baselineAxes: original.achieved, currentAxes: changedFit?.achieved ?? null, admitted: changedFit !== null,
      baselineTrace, local, prefixExact, localFrames, anchor, budget, control, candidate, retained,
      localRawGain: local?.rawImpulse === null || !local ? null : local.rawImpulse - selection.baselineRawImpulse,
      finalRawGain, pairedDelta, incumbentDelta, useful,
      suffixFrames: (control?.frames ?? 0) + (candidate?.frames ?? 0),
      verificationFrames: (control?.verificationFrames ?? 0) + (candidate?.verificationFrames ?? 0) };
    write(statePath, result); states.push(result);
  }
  write(resolve(out, `${sourceId}.json`), { schema: "line.interrupted-support-response-source.v1", implementation, planSha256,
    sourceId, incumbent, warmupFrames, states, elapsedMs: performance.now() - started });
}

const planPath = resolve(out, "plan.json");
if (process.argv.includes("--plan")) {
  if (existsSync(planPath)) throw new Error("plan exists");
  const plan = makePlan(); write(planPath, plan);
  console.log(JSON.stringify({ sources: plan.sources.length, selections: plan.sources.reduce((s: number, r: any) => s + r.selected.length, 0),
    unavailable: plan.sources.filter((s: any) => s.selected.length !== 2).map((s: any) => s.sourceId), planSha256: hash(readFileSync(planPath)) }));
} else {
  const plan = read(planPath), planSha256 = hash(readFileSync(planPath));
  if (plan.implementation !== implementation || plan.candidateFingerprint !== baseline.candidate_fingerprint ||
      plan.censusSha256 !== hash(readFileSync(resolve(input, "summary.json")))) throw new Error("frozen plan changed");
  if (arg("worker")) worker(plan.sources.find((s: any) => s.sourceId === arg("worker")), planSha256);
  else {
    const jobs = Number(arg("jobs") ?? "8");
    if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error("invalid jobs");
    const queue: any[] = plan.sources.filter((s: any) => {
      const path = resolve(out, `${s.sourceId}.json`);
      if (!existsSync(path)) return true;
      if (read(path).planSha256 !== planSha256) throw new Error("incompatible checkpoint");
      return false;
    });
    if (queue.length) {
      const workspace = createSnapshotWorkspace(baseline.compiler_snapshot), environment = { ...process.env };
      for (const key of Object.keys(environment)) if (key.startsWith("LR_")) delete environment[key];
      Object.assign(environment, baseline.compiler_snapshot.compilerEnvironment, { LR_ENGINE: "wasm" });
      try {
        copyFileSync(script, resolve(workspace.directory, "scripts/benchmark/impact_gap_response.ts"));
        for (const path of dependencies) copyFileSync(path, resolve(workspace.directory, path));
        const failures: string[] = [];
        await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
          while (queue.length) {
            const source = queue.shift()!;
            const code = await new Promise<number | null>((done, reject) => {
              const child = spawn(process.execPath, ["--import", "tsx", "scripts/benchmark/impact_gap_response.ts", `--worker=${source.sourceId}`, `--input=${input}`, `--out=${out}`],
                { cwd: workspace.directory, env: environment, stdio: ["ignore", "ignore", "inherit"] });
              child.on("error", reject); child.on("exit", done);
            });
            if (code !== 0) failures.push(`${source.sourceId}: ${code}`);
            else process.stderr.write(`${source.sourceId}: support-interruption assay complete\n`);
          }
        }));
        if (failures.length) throw new Error(failures.join("\n"));
      } finally { disposeSnapshotWorkspace(workspace); }
    }
    const results: any[] = plan.sources.map((s: any) => read(resolve(out, `${s.sourceId}.json`))), states: any[] = results.flatMap(r => r.states);
    const sum = (key: string) => states.reduce((s, r) => s + r[key], 0);
    const summary = { schema: "line.interrupted-support-response-summary.v1", implementation, planSha256, sources: results.length,
      selected: states.length, constructed: states.filter(s => s.construction.available).length, admitted: states.filter(s => s.admitted).length,
      exactPrefix: states.filter(s => s.prefixExact).length, localInterruption: states.filter(s => s.local?.interruptedAndRecaptured).length,
      validChanged: states.filter(s => s.candidate?.valid).length, retainedMechanism: states.filter(s => s.retained).length,
      localUsefulGain: states.filter(s => s.prefixExact && s.localRawGain >= s.selection.requestedRawGain).length,
      positiveAgainstBoth: states.filter(s => s.retained && s.candidate.valid && s.pairedDelta > 0 && s.incumbentDelta > 0).length,
      useful: states.filter(s => s.useful).length, warmupFrames: results.reduce((s, r) => s + r.warmupFrames, 0),
      localFrames: sum("localFrames"), suffixFrames: sum("suffixFrames"), verificationFrames: sum("verificationFrames"),
      workerSeconds: results.reduce((s, r) => s + r.elapsedMs / 1000, 0) };
    write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
  }
}
