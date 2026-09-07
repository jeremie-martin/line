/** Isolate the reuse-reference omission in the frozen interruption assay. */
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
import { makeBaseEngine, engineLineFromTrackLine } from "../v0/core/substrate.ts";
import { tryCandidateLines, axisLookaheadEndFrame } from "../v0/core/candidate.ts";
import { getCandidateProbe } from "../v0/optimizer/sample.ts";
import { IMPACT_WINDOW } from "../v0/types.ts";
import { getPhysicsFrameCount } from "../lib/detector.ts";
import { read, write, state, buildEngine } from "./impact_release_response.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const baseDirectory = "generated/benchmark-v2/impact-delivery-650-new";
const input = resolve(arg("input") ?? `${baseDirectory}/interrupted-support-capture`);
const parentDirectory = resolve(arg("parent") ?? `${baseDirectory}/interrupted-support-response`);
const out = resolve(arg("out") ?? `${baseDirectory}/interrupted-support-metadata-replay`);
const script = fileURLToPath(import.meta.url), hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const implementation = [script, "scripts/benchmark/impact_release_response.ts"].map(p => hash(readFileSync(p))).join(":");
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
function worker(source: any, requestSha256: string): void {
  if (compilerCandidateIdentity("wasm").candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("wrong compiler snapshot");
  const started = performance.now(), sourceId = source.sourceId;
  const capturePath = resolve(input, `${sourceId}.capture.json`), capture = read(capturePath);
  if (hash(readFileSync(capturePath)) !== source.captureSha256) throw new Error("capture changed");
  const originalRun = read(resolve(parentDirectory, `${sourceId}.json`));
  const selected: any[] = originalRun.states.filter((s: any) => s.prefixExact);
  if (!selected.length) {
    write(resolve(out, `${sourceId}.json`), { implementation, requestSha256, sourceId, states: [], warmupFrames: 0, elapsedMs: performance.now() - started });
    return;
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
    const setupStart = getPhysicsFrameCount(), prefix = root(capture, index), original = stored.search.prefixFits[index];
    const gap = ctx.gaps[index], probe = getCandidateProbe(prefix.prefixEngine, gap, ctx);
    const reference = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    if (!original.ref || reference.x !== original.ref.x || reference.y !== original.ref.y) throw new Error("ordinary reference mismatch");
    function admit(lines: any[]): any {
      const fit = tryCandidateLines(prefix.prefixEngine, gap, lines, prefix.prefixNextLineId,
        ctx.allContactFrames, axisLookaheadEndFrame(gap, ctx.allContactFrames), gap.targets, true,
        "normal", probe.preTargetSledTrace, { allowRideOutPolish: false });
      if (!fit || lineKey(fit.lines) !== lineKey(lines)) throw new Error("frozen admission changed");
      fit.ref = { ...reference };
      if (original.aimed !== undefined) fit.aimed = original.aimed;
      return fit;
    }
    const neutral = admit(original.lines), corrected = admit(prior.construction.lines);
    for (const axis of Object.keys(ctx.gapAxisTargets[index])) {
      if (neutral.achieved[axis] !== original.achieved[axis] || corrected.achieved[axis] !== prior.currentAxes[axis]) throw new Error("frozen local axes changed");
    }
    const setupFrames = getPhysicsFrameCount() - setupStart;
    function resume(fit: any, name: string, expected?: any): any {
      const start = performance.now(), search = extendNodeCached(prefix, fit);
      const result = compileHandoffFromSnapshot(spec, capture.seed, snapshot(capture, search), {
        budget: prior.budget, searchSeed: stored.searchSeed, stopAfterFirstCompletion: true,
      });
      const frames = getPhysicsFrameCount(), score = scoreV2Report(result.report, spec.contacts.length, contract, suite);
      const trackHash = hash(JSON.stringify(result.track)), reportHash = hash(JSON.stringify(result.report));
      const firstAxes = result.report.gaps.find(g => g.gap_index === index)?.axes ?? null;
      if (expected) {
        const oldTrack = read(resolve(parentDirectory, `${sourceId}-g${index}-control.track.json`));
        const oldReport = read(resolve(parentDirectory, `${sourceId}-g${index}-control.report.json`));
        if (trackHash !== hash(JSON.stringify(oldTrack)) || reportHash !== hash(JSON.stringify(oldReport)) || frames !== expected.frames) {
          write(resolve(out, `${sourceId}-g${index}-neutral-failure.json`), { trackHash, reportHash, frames,
            expectedTrackHash: hash(JSON.stringify(oldTrack)), expectedReportHash: hash(JSON.stringify(oldReport)), expectedFrames: expected.frames,
            neutral, original });
          throw new Error("ordinary metadata-restored control replay mismatch");
        }
      }
      const returned = new Map<number, any>(result.track.lines.map(l => [l.id, l]));
      const expectedLines = [...stored.startLines, ...search.prefixFits.flatMap((f: any) => f?.lines ?? [])];
      const prefixRetained = expectedLines.every(l => returned.has(l.id) && lineKey([returned.get(l.id)]) === lineKey([l]));
      const verificationStart = getPhysicsFrameCount(), engine = buildEngine(result.track), windowHash = createHash("sha256");
      for (let frame = prior.selection.impactFrame; frame <= prior.selection.impactFrame + IMPACT_WINDOW; frame++) windowHash.update(state(engine, frame).key + "\n");
      const realizedWindowHash = windowHash.digest("hex"), verificationFrames = getPhysicsFrameCount() - verificationStart;
      write(resolve(out, `${sourceId}-g${index}-${name}.track.json`), result.track);
      write(resolve(out, `${sourceId}-g${index}-${name}.report.json`), result.report);
      return { score: score.score, valid: score.valid, hardFailures: score.hardFailures, frames, verificationFrames,
        prefixRetained, firstAxes, realizedWindowHash, trackHash, reportHash, elapsedMs: performance.now() - start,
        reuseAttempts: result.stats.handoff_reuse_attempts ?? null, reuseSuccesses: result.stats.handoff_reuse_successes ?? null };
    }
    const neutralControl = resume(neutral, "neutral", prior.control);
    const removedReference = resume({ ...original, ref: undefined }, "control-without-reference");
    const candidate = resume(corrected, "corrected-candidate");
    const retained = candidate.prefixRetained && candidate.realizedWindowHash === prior.local.windowHash &&
      candidate.firstAxes?.impact?.achieved === prior.currentAxes.impact;
    const pairedDelta = candidate.score - prior.control.score, incumbentDelta = candidate.score - originalRun.incumbent.score;
    const useful = retained && candidate.valid && prior.localRawGain >= prior.selection.requestedRawGain && pairedDelta > 0 && incumbentDelta > 0;
    const result = { schema: "line.interrupted-support-metadata-state.v1", requestSha256, sourceId, gapIndex: index,
      reference, neutralExact: true, neutralControl, removedReference, candidate, retained, localRawGain: prior.localRawGain,
      requestedRawGain: prior.selection.requestedRawGain, pairedDelta, incumbentDelta, useful,
      referenceRemovalDelta: removedReference.score - prior.control.score,
      correctedVsMissingReferenceDelta: candidate.score - prior.candidate.score, setupFrames,
      continuationFrames: neutralControl.frames + removedReference.frames + candidate.frames,
      verificationFrames: neutralControl.verificationFrames + removedReference.verificationFrames + candidate.verificationFrames };
    write(statePath, result); states.push(result);
  }
  write(resolve(out, `${sourceId}.json`), { implementation, requestSha256, sourceId, states, warmupFrames, elapsedMs: performance.now() - started });
}

const request = { schema: "line.interrupted-support-metadata-request.v1", implementation,
  candidateFingerprint: baseline.candidate_fingerprint, parentPlanSha256: hash(readFileSync(resolve(parentDirectory, "plan.json"))),
  sources: parentPlan.sources.map((s: any) => ({ sourceId: s.sourceId,
    priorSha256: hash(readFileSync(resolve(parentDirectory, `${s.sourceId}.json`))) })),
  law: "all 22 exact admitted cuts; neutral readmission plus ordinary probe ref must replay exact control; original minus ref; frozen cut plus ref; same budget and first-completion seed" };
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
      copyFileSync(script, resolve(workspace.directory, "scripts/benchmark/impact_gap_metadata_replay.ts"));
      const failures: string[] = [];
      await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
        while (queue.length) {
          const source = queue.shift()!;
          const code = await new Promise<number | null>((done, reject) => {
            const child = spawn(process.execPath, ["--import", "tsx", "scripts/benchmark/impact_gap_metadata_replay.ts", `--worker=${source.sourceId}`, `--input=${input}`, `--parent=${parentDirectory}`, `--out=${out}`],
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
  const median = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? null;
  const summary = { schema: "line.interrupted-support-metadata-summary.v1", implementation, requestSha256, sources: results.length,
    states: states.length, neutralExact: states.filter(s => s.neutralExact).length, valid: states.filter(s => s.candidate.valid).length,
    retained: states.filter(s => s.retained).length, useful: states.filter(s => s.useful).length,
    positiveAgainstBoth: states.filter(s => s.retained && s.candidate.valid && s.pairedDelta > 0 && s.incumbentDelta > 0).length,
    medianReferenceRemovalDelta: median(states.map(s => s.referenceRemovalDelta)),
    medianCorrectedVsMissingReferenceDelta: median(states.map(s => s.correctedVsMissingReferenceDelta)),
    medianPairedDelta: median(states.map(s => s.pairedDelta)), medianIncumbentDelta: median(states.map(s => s.incumbentDelta)),
    warmupFrames: results.reduce((s, r) => s + r.warmupFrames, 0), setupFrames: sum("setupFrames"),
    continuationFrames: sum("continuationFrames"), verificationFrames: sum("verificationFrames"),
    workerSeconds: results.reduce((s, r) => s + r.elapsedMs / 1000, 0) };
  write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
}
