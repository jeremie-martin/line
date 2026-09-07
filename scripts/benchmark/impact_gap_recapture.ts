/** One rigid return-surface reconstruction on every exact admitted support gap. */
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
import { IMPACT_WINDOW } from "../v0/types.ts";
import { detect, extractRawTrajectory, getRiderMetered, getPhysicsFrameCount } from "../lib/detector.ts";
import { read, write, state, buildEngine } from "./impact_release_response.ts";
import { matchRecaptureFrame } from "./impact_recapture_frame.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const baseDirectory = "generated/benchmark-v2/impact-delivery-650-new";
const input = resolve(arg("input") ?? `${baseDirectory}/interrupted-support-capture`);
const parentDirectory = resolve(arg("parent") ?? `${baseDirectory}/interrupted-support-response`);
const metadataDirectory = resolve(arg("metadata") ?? `${baseDirectory}/interrupted-support-metadata-replay`);
const out = resolve(arg("out") ?? `${baseDirectory}/state-matched-recapture`);
const script = fileURLToPath(import.meta.url), hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const dependencies = ["scripts/benchmark/impact_recapture_frame.ts", "scripts/benchmark/impact_release_response.ts"];
const implementation = [script, ...dependencies].map(p => hash(readFileSync(p))).join(":");
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const parentPlan = read(resolve(parentDirectory, "plan.json"));
const lineKey = (lines: any[]) => JSON.stringify(lines.map(l => [l.id, l.type, l.x1, l.y1, l.x2, l.y2,
  !!l.flipped, !!l.leftExtended, !!l.rightExtended]));
mkdirSync(out, { recursive: true });
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
function trace(engine: any, prior: any, beforeReturn: number, returnIds: Set<number>): any {
  const h = prior.selection.impactFrame, det = detect(extractRawTrajectory(engine, h + IMPACT_WINDOW));
  const prefix = createHash("sha256"), window = createHash("sha256"), frames: any[] = [];
  for (let f = 0; f <= beforeReturn; f++) prefix.update(state(engine, f).key + "\n");
  for (let f = h; f <= h + IMPACT_WINDOW; f++) {
    window.update(state(engine, f).key + "\n");
    const events = engine.getUpdatesAtFrame(f).filter((u: any) => u.type === "CollisionUpdate")
      .map((u: any) => ({ lineId: u.id, points: u.updated.map((p: any) => p.id), returnSide: returnIds.has(u.id) }));
    frames.push({ frame: f, contacted: det.measurements.airborne[f] === false, events });
  }
  return { prefixHash: prefix.digest("hex"), windowHash: window.digest("hex"), frames,
    rawImpulse: contactRedirArcPxAtLanding(det, h) ?? null,
    interruptedAndRecaptured: frames.some((f, i) => !f.contacted && frames.slice(i + 1).some(next => next.contacted && next.events.some((e: any) => e.returnSide))) };
}
function worker(source: any, requestSha256: string): void {
  if (compilerCandidateIdentity("wasm").candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("wrong compiler snapshot");
  const started = performance.now(), sourceId = source.sourceId;
  const capturePath = resolve(input, `${sourceId}.capture.json`), capture = read(capturePath);
  if (hash(readFileSync(capturePath)) !== source.captureSha256) throw new Error("capture changed");
  const originalRun = read(resolve(parentDirectory, `${sourceId}.json`));
  const metadataRun = read(resolve(metadataDirectory, `${sourceId}.json`));
  const selected: any[] = originalRun.states.filter((s: any) => s.prefixExact);
  if (!selected.length) {
    write(resolve(out, `${sourceId}.json`), { implementation, requestSha256, sourceId, states: [], warmupFrames: 0, elapsedMs: performance.now() - started }); return;
  }
  const spec = applyJolt(developmentCases.find(e => e.case.metadata.id === sourceId)!.case.spec, benchmarkPolicy.transform.joltMs);
  const contract = buildAxisContract(spec, Object.keys(benchmarkPolicy.componentWeights) as Array<keyof typeof benchmarkPolicy.componentWeights>);
  const suite = { component_weights: benchmarkPolicy.componentWeights, axis_quality_tolerance: benchmarkPolicy.axisQualityTolerance };
  const stored = capture.snapshot.node, ctx = { ...capture.context, probeCache: undefined };
  const warmup = compileHandoffFromSnapshot(spec, capture.seed, snapshot(capture, root(capture, stored.search.gapIndex)), {
    budget: capture.budget, searchSeed: stored.searchSeed, stopAfterFirstCompletion: true,
  });
  if (hash(JSON.stringify(warmup.track)) !== capture.trackHash || hash(JSON.stringify(warmup.report)) !== capture.reportHash) throw new Error("warmup mismatch");
  const warmupFrames = getPhysicsFrameCount(), states: any[] = [];
  for (const prior of selected) {
    const index = prior.selection.gapIndex, statePath = resolve(out, `${sourceId}-g${index}.json`);
    if (existsSync(statePath)) {
      const saved = read(statePath); if (saved.requestSha256 !== requestSha256) throw new Error("changed state checkpoint");
      states.push(saved); continue;
    }
    const metadata = metadataRun.states.find((s: any) => s.gapIndex === index);
    const setupStart = getPhysicsFrameCount(), prefix = root(capture, index), original = stored.search.prefixFits[index];
    const gap = ctx.gaps[index], probe = getCandidateProbe(prefix.prefixEngine, gap, ctx);
    const reference = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    if (reference.x !== original.ref?.x || reference.y !== original.ref?.y) throw new Error("ordinary reference mismatch");
    function admit(lines: any[]): any {
      const fit = tryCandidateLines(prefix.prefixEngine, gap, lines, prefix.prefixNextLineId,
        ctx.allContactFrames, axisLookaheadEndFrame(gap, ctx.allContactFrames), gap.targets, true,
        "normal", probe.preTargetSledTrace, { allowRideOutPolish: false });
      if (fit) {
        if (lineKey(fit.lines) !== lineKey(lines)) throw new Error("admission mutated geometry");
        fit.ref = { ...reference }; if (original.aimed !== undefined) fit.aimed = original.aimed;
      }
      return fit;
    }
    const neutral = admit(prior.construction.lines);
    if (!neutral || Object.keys(ctx.gapAxisTargets[index]).some(axis => neutral.achieved[axis] !== prior.currentAxes[axis])) throw new Error("frozen gap admission changed");
    const baselineNode = extendNodeCached(prefix, original), interruptedNode = extendNodeCached(prefix, neutral);
    const firstFree = prior.local.frames.findIndex((f: any) => !f.contacted);
    const recapture = prior.local.frames.slice(firstFree + 1).find((f: any) => f.contacted && f.events.some((e: any) => e.returnSide));
    if (firstFree < 0 || !recapture) throw new Error("missing parent recapture");
    const beforeReturn = recapture.frame - 1;
    const phase = (engine: any) => {
      const packet = getRiderMetered(engine, beforeReturn).ballisticState();
      return ["PEG", "TAIL", "NOSE", "STRING"].map(id => ({ x: packet.points[id].x, y: packet.points[id].y, vx: packet.points[id].vx, vy: packet.points[id].vy }));
    };
    const oldPhase = phase(baselineNode.prefixEngine), changedPhase = phase(interruptedNode.prefixEngine);
    const returnIds = new Set<number>(prior.construction.origins.filter((o: any) => o.side === "after").map((o: any) => o.id));
    const returnLines = prior.construction.lines.filter((l: any) => returnIds.has(l.id));
    const identity = matchRecaptureFrame(returnLines, changedPhase, changedPhase);
    if (!identity.available || !identity.identity || JSON.stringify(identity.lines) !== JSON.stringify(returnLines)) throw new Error("zero phase map changed geometry");
    const map = matchRecaptureFrame(returnLines, oldPhase, changedPhase);
    const mappedById = new Map<number, any>(map.available ? map.lines.map((l: any) => [l.id, l]) : []);
    const proposalLines = map.available ? prior.construction.lines.map((l: any) => mappedById.get(l.id) ?? l) : null;
    const proposal = proposalLines ? admit(proposalLines) : null;
    const parentTrace = trace(interruptedNode.prefixEngine, prior, beforeReturn, returnIds);
    if (parentTrace.windowHash !== prior.local.windowHash) throw new Error("parent impact window changed");
    const local = proposal ? trace(extendNodeCached(prefix, proposal).prefixEngine, prior, beforeReturn, returnIds) : null;
    const prefixExact = local !== null && local.prefixHash === parentTrace.prefixHash;
    const setupFrames = getPhysicsFrameCount() - setupStart;
    function resume(fit: any, name: string, expected?: any): any {
      const start = performance.now(), search = extendNodeCached(prefix, fit);
      const result = compileHandoffFromSnapshot(spec, capture.seed, snapshot(capture, search), {
        budget: prior.budget, searchSeed: stored.searchSeed, stopAfterFirstCompletion: true,
      });
      const frames = getPhysicsFrameCount(), score = scoreV2Report(result.report, spec.contacts.length, contract, suite);
      const trackHash = hash(JSON.stringify(result.track)), reportHash = hash(JSON.stringify(result.report));
      if (expected && (trackHash !== expected.trackHash || reportHash !== expected.reportHash || frames !== expected.frames)) throw new Error("zero-map ordinary continuation mismatch");
      const returned = new Map<number, any>(result.track.lines.map(l => [l.id, l]));
      const expectedLines = [...stored.startLines, ...search.prefixFits.flatMap((f: any) => f?.lines ?? [])];
      const prefixRetained = expectedLines.every(l => returned.has(l.id) && lineKey([returned.get(l.id)]) === lineKey([l]));
      const verificationStart = getPhysicsFrameCount(), realized = trace(buildEngine(result.track), prior, beforeReturn, returnIds);
      const verificationFrames = getPhysicsFrameCount() - verificationStart;
      write(resolve(out, `${sourceId}-g${index}-${name}.track.json`), result.track);
      write(resolve(out, `${sourceId}-g${index}-${name}.report.json`), result.report);
      return { score: score.score, valid: score.valid, hardFailures: score.hardFailures, frames, verificationFrames,
        prefixRetained, realized, firstAxes: result.report.gaps.find(g => g.gap_index === index)?.axes ?? null,
        trackHash, reportHash, elapsedMs: performance.now() - start };
    }
    const control = resume(neutral, "neutral", metadata.candidate);
    const candidate = prefixExact && local.interruptedAndRecaptured ? resume(proposal, "candidate") : null;
    const retained = candidate !== null && candidate.prefixRetained && candidate.realized.windowHash === local.windowHash && candidate.realized.interruptedAndRecaptured;
    const rawGain = candidate?.realized.rawImpulse === null || !candidate ? null : candidate.realized.rawImpulse - prior.selection.baselineRawImpulse;
    const gapDelta = candidate ? candidate.score - control.score : null;
    const pairedDelta = candidate ? candidate.score - prior.control.score : null;
    const incumbentDelta = candidate ? candidate.score - originalRun.incumbent.score : null;
    const useful = !!(retained && candidate.valid && rawGain !== null && rawGain >= prior.selection.requestedRawGain &&
      gapDelta !== null && gapDelta > 0 && pairedDelta !== null && pairedDelta > 0 && incumbentDelta !== null && incumbentDelta > 0);
    const result = { schema: "line.state-matched-recapture-state.v1", requestSha256, sourceId, gapIndex: index, beforeReturn,
      oldPhase, changedPhase, map, proposalLines, admitted: proposal !== null, prefixExact, neutralExact: true,
      parentTrace, local, control, candidate, retained, rawGain, gapDelta, pairedDelta, incumbentDelta, useful, setupFrames,
      requestedRawGain: prior.selection.requestedRawGain,
      continuationFrames: control.frames + (candidate?.frames ?? 0), verificationFrames: control.verificationFrames + (candidate?.verificationFrames ?? 0) };
    write(statePath, result); states.push(result);
  }
  write(resolve(out, `${sourceId}.json`), { implementation, requestSha256, sourceId, states, warmupFrames, elapsedMs: performance.now() - started });
}
const request = { schema: "line.state-matched-recapture-request.v1", implementation,
  candidateFingerprint: baseline.candidate_fingerprint, parentPlanSha256: hash(readFileSync(resolve(parentDirectory, "plan.json"))),
  metadataSummarySha256: hash(readFileSync(resolve(metadataDirectory, "summary.json"))),
  sources: parentPlan.sources.map((s: any) => ({ sourceId: s.sourceId,
    parentSha256: hash(readFileSync(resolve(parentDirectory, `${s.sourceId}.json`))),
    metadataSha256: hash(readFileSync(resolve(metadataDirectory, `${s.sourceId}.json`))) })),
  law: "all 22 admitted interruptions, rigid phase fit at first recapture minus one; transform return lines only; exact causal prefix and zero-map continuation; no parameter menu" };
const requestPath = resolve(out, "request.json");
if (existsSync(requestPath)) {
  if (JSON.stringify(read(requestPath)) !== JSON.stringify(request)) throw new Error("request changed");
} else write(requestPath, request);
const requestSha256 = hash(readFileSync(requestPath));
if (arg("worker")) worker(parentPlan.sources.find((s: any) => s.sourceId === arg("worker")), requestSha256);
else {
  const jobs = Number(arg("jobs") ?? "8");
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error("invalid jobs");
  const queue: any[] = parentPlan.sources.filter((s: any) => {
    const path = resolve(out, `${s.sourceId}.json`); if (!existsSync(path)) return true;
    if (read(path).requestSha256 !== requestSha256) throw new Error("incompatible checkpoint"); return false;
  });
  if (queue.length) {
    const workspace = createSnapshotWorkspace(baseline.compiler_snapshot), environment = { ...process.env };
    for (const key of Object.keys(environment)) if (key.startsWith("LR_")) delete environment[key];
    Object.assign(environment, baseline.compiler_snapshot.compilerEnvironment, { LR_ENGINE: "wasm" });
    try {
      copyFileSync(script, resolve(workspace.directory, "scripts/benchmark/impact_gap_recapture.ts"));
      for (const path of dependencies) copyFileSync(path, resolve(workspace.directory, path));
      const failures: string[] = [];
      await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
        while (queue.length) {
          const source = queue.shift()!;
          const code = await new Promise<number | null>((done, reject) => {
            const child = spawn(process.execPath, ["--import", "tsx", "scripts/benchmark/impact_gap_recapture.ts", `--worker=${source.sourceId}`, `--input=${input}`, `--parent=${parentDirectory}`, `--metadata=${metadataDirectory}`, `--out=${out}`],
              { cwd: workspace.directory, env: environment, stdio: ["ignore", "ignore", "inherit"] });
            child.on("error", reject); child.on("exit", done);
          });
          if (code !== 0) failures.push(`${source.sourceId}: ${code}`);
        }
      }));
      if (failures.length) throw new Error(failures.join("\n"));
    } finally { disposeSnapshotWorkspace(workspace); }
  }
  const results: any[] = parentPlan.sources.map((s: any) => read(resolve(out, `${s.sourceId}.json`))), states: any[] = results.flatMap(r => r.states);
  const sum = (key: string) => states.reduce((s, r) => s + r[key], 0);
  const summary = { schema: "line.state-matched-recapture-summary.v1", implementation, requestSha256, sources: results.length,
    states: states.length, neutralExact: states.filter(s => s.neutralExact).length, mapped: states.filter(s => s.map.available).length,
    admitted: states.filter(s => s.admitted).length, exactPrefix: states.filter(s => s.prefixExact).length,
    localInterruption: states.filter(s => s.local?.interruptedAndRecaptured).length, continued: states.filter(s => s.candidate).length,
    valid: states.filter(s => s.candidate?.valid).length, retained: states.filter(s => s.retained).length,
    positiveAgainstAll: states.filter(s => s.retained && s.candidate.valid && s.gapDelta > 0 && s.pairedDelta > 0 && s.incumbentDelta > 0).length,
    useful: states.filter(s => s.useful).length, warmupFrames: results.reduce((s, r) => s + r.warmupFrames, 0),
    setupFrames: sum("setupFrames"), continuationFrames: sum("continuationFrames"), verificationFrames: sum("verificationFrames"),
    workerSeconds: results.reduce((s, r) => s + r.elapsedMs / 1000, 0) };
  write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
}
