/** Replay frozen secants and rejected directions; no new optimization or suffix. */
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
import { compileHandoffFromSnapshot } from "../v0/optimizer/handoff.ts";
import { makeRootNode, extendNodeCached } from "../v0/optimizer/node.ts";
import { makeBaseEngine, engineLineFromTrackLine } from "../v0/core/substrate.ts";
import { tryCandidateLines, axisLookaheadEndFrame } from "../v0/core/candidate.ts";
import { getCandidateProbe } from "../v0/optimizer/sample.ts";
import { getPhysicsFrameCount } from "../lib/detector.ts";
import { read, write, deform } from "./impact_release_response.ts";
import { broydenUpdate } from "./impact_axis_math.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const baseDirectory = "generated/benchmark-v2/impact-delivery-650-new";
const captures = resolve(arg("captures") ?? `${baseDirectory}/continuation-capture`);
const input = resolve(arg("input") ?? `${baseDirectory}/selected-fit-trace`);
const parentDirectory = resolve(arg("parent") ?? `${baseDirectory}/authored-output-relaxation`);
const pairsPath = resolve(arg("pairs") ?? `${baseDirectory}/contact-pair-response/plan.json`);
const out = resolve(arg("out") ?? `${baseDirectory}/authored-output-model-audit`);
const script = fileURLToPath(import.meta.url), hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const dependencies = ["scripts/benchmark/impact_axis_math.ts", "scripts/benchmark/impact_release_response.ts"];
const implementation = [script, ...dependencies].map(p => hash(readFileSync(p))).join(":");
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const parent = read(resolve(parentDirectory, "request.json")), pairs = read(pairsPath);
const norm = (values: number[]) => Math.hypot(...values), square = (values: number[]) => values.reduce((s, v) => s + v * v, 0);
const lineKey = (lines: any[]) => JSON.stringify(lines.map(l => [l.id, l.type, l.x1, l.y1, l.x2, l.y2,
  !!l.flipped, !!l.leftExtended, !!l.rightExtended]));
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-13 + Math.abs(b) * 1e-9;
mkdirSync(out, { recursive: true });

function root(capture: any, count: number): any {
  const stored = capture.snapshot.node;
  let engine = makeBaseEngine(stored.startState);
  if (stored.startLines.length) engine = engine.addLine(stored.startLines.map(engineLineFromTrackLine));
  let node = { ...makeRootNode(engine, capture.context.gaps.length), prefixNextLineId: 1 + stored.startLines.length };
  for (const fit of stored.search.prefixFits.slice(0, count)) node = extendNodeCached(node, fit);
  return node;
}
function worker(source: any, requestSha256: string): void {
  if (compilerCandidateIdentity("wasm").candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("wrong compiler snapshot");
  const started = performance.now(), sourceId = source.sourceId;
  const capturePath = resolve(captures, `${sourceId}.capture.json`), capture = read(capturePath);
  const binding = parent.captures.find((s: any) => s.sourceId === sourceId);
  if (binding.captureSha256 !== hash(readFileSync(capturePath))) throw new Error("capture changed");
  const trackPath = resolve(input, `${sourceId}.track.json`), track = read(trackPath);
  if (hash(readFileSync(trackPath)) !== source.trackSha256) throw new Error("track changed");
  const spec = applyJolt(developmentCases.find(e => e.case.metadata.id === sourceId)!.case.spec, benchmarkPolicy.transform.joltMs);
  const stored = capture.snapshot.node;
  const replay = compileHandoffFromSnapshot(spec, capture.seed, {
    ...capture.snapshot, node: { ...stored, search: root(capture, stored.search.gapIndex) },
  }, { budget: capture.budget, searchSeed: stored.searchSeed, stopAfterFirstCompletion: true });
  if (hash(JSON.stringify(replay.report)) !== capture.reportHash || hash(JSON.stringify(replay.track)) !== capture.trackHash) throw new Error("warmup mismatch");
  const warmupFrames = getPhysicsFrameCount();
  const states = source.selections.map((selection: any) => {
    const state = read(resolve(parentDirectory, `${sourceId}-g${selection.gapIndex}.json`));
    if (state.requestSha256 !== hash(readFileSync(resolve(parentDirectory, "request.json")) )) throw new Error("parent state changed");
    const startFrames = getPhysicsFrameCount(), first = selection.gapIndex, prefix = root(capture, first);
    const originals = stored.search.prefixFits.slice(first, first + 2), features: any[] = state.features;
    const ctx = { ...capture.context, probeCache: undefined };
    function measure(controls: number[]): any | null {
      const changed = deform(track, selection, controls), byId = new Map<number, any>(changed.lines.map((l: any) => [l.id, l]));
      let node = prefix;
      const fits: any[] = [];
      for (let offset = 0; offset < 2; offset++) {
        const gap = ctx.gaps[first + offset], probe = getCandidateProbe(node.prefixEngine, gap, ctx);
        const lines = originals[offset].lines.map((l: any) => byId.get(l.id)!);
        const fit = tryCandidateLines(node.prefixEngine, gap, lines, node.prefixNextLineId,
          ctx.allContactFrames, axisLookaheadEndFrame(gap, ctx.allContactFrames), gap.targets, true,
          "normal", probe.preTargetSledTrace, { allowRideOutPolish: false });
        if (!fit) return null;
        if (lineKey(fit.lines) !== lineKey(lines)) throw new Error("changed admission geometry");
        fits.push(fit); node = extendNodeCached(node, fit);
      }
      const outputs = features.map(f => fits[f.offset].achieved[f.axis] * f.scale);
      const residual = features.map((f, i) => outputs[i] - f.target * f.scale);
      return { outputs, residual, objective: square(residual),
        firstImpactError: Math.abs(fits[0].achieved.impact - ctx.gapAxisTargets[first].impact) };
    }
    const stable: any[] = state.columns.filter((c: any) => c.eligible);
    let j = features.map((_, i) => stable.map(c => c.derivative[i]));
    let controls = Array(selection.coordinates.length).fill(0), current = measure(controls);
    if (!current || !close(current.objective, state.initialObjective)) throw new Error("initial objective mismatch");
    for (const update of state.updates.filter((u: any) => u.accepted)) {
      const next = measure(update.controls);
      if (!next || !close(next.objective, update.objective) || !close(next.firstImpactError, update.firstImpactError)) throw new Error("accepted secant mismatch");
      const step = stable.map(c => update.controls[c.index] - controls[c.index]);
      j = broydenUpdate(j, step, next.outputs.map((v: number, i: number) => v - current.outputs[i]));
      controls = update.controls; current = next;
    }
    if (JSON.stringify(controls) !== JSON.stringify(state.controls) || !close(current.objective, state.finalObjective)) throw new Error("final replay mismatch");
    const rejected = state.updates.find((u: any) => !u.accepted);
    let audit: any = { available: false, reason: state.stopReason };
    if (rejected) {
      const direction = rejected.controls.map((v: number, i: number) => v - controls[i]);
      const step = stable.map(c => direction[c.index]);
      const prediction = j.map(row => row.reduce((s, v, k) => s + v * step[k], 0));
      const predictedGain = current.objective - square(current.residual.map((v: number, i: number) => v + prediction[i]));
      if (!close(predictedGain, rejected.predictedGain)) throw new Error("Broyden prediction replay mismatch");
      const full = measure(rejected.controls);
      if ((full !== null) !== rejected.admitted || (full && (!close(full.objective, rejected.objective) || !close(full.firstImpactError, rejected.firstImpactError)))) throw new Error("rejected proposal mismatch");
      const stencil = [0.001, -0.001, 0.0005, -0.0005].map(scale => measure(controls.map((v: number, i: number) => v + scale * direction[i])));
      audit = { available: stencil.every(v => v !== null), fullAdmitted: full !== null, prediction, predictedGain,
        fullChange: full?.outputs.map((v: number, i: number) => v - current.outputs[i]) ?? null,
        stencil: stencil.map(v => v?.outputs ?? null), features, currentOutputs: current.outputs, residual: current.residual };
      if (audit.available) {
        const broad = current.outputs.map((_: number, i: number) => (stencil[0].outputs[i] - stencil[1].outputs[i]) / 0.002);
        const fine = current.outputs.map((_: number, i: number) => (stencil[2].outputs[i] - stencil[3].outputs[i]) / 0.001);
        const precise = fine.map((v: number, i: number) => (4 * v - broad[i]) / 3);
        Object.assign(audit, { derivative: precise,
          stencilDisagreement: norm(fine.map((v: number, i: number) => v - broad[i])) / Math.max(norm(fine), 1e-12),
          infinitesimalModelError: norm(precise.map((v: number, i: number) => v - prediction[i])) / Math.max(norm(precise), 1e-12),
          finiteStepCurvature: full ? norm(audit.fullChange.map((v: number, i: number) => v - precise[i])) / Math.max(norm(precise), 1e-12) : null,
          exactLocalObjectiveDerivative: 2 * current.residual.reduce((s: number, v: number, i: number) => s + v * precise[i], 0),
          predictedObjectiveDerivative: 2 * current.residual.reduce((s: number, v: number, i: number) => s + v * prediction[i], 0) });
      }
    }
    return { sourceId, gapIndex: first, stopReason: state.stopReason, acceptedUpdates: state.updates.filter((u: any) => u.accepted).length,
      replayExact: true, audit, frames: getPhysicsFrameCount() - startFrames };
  });
  write(resolve(out, `${sourceId}.json`), { implementation, requestSha256, sourceId, warmupFrames, states,
    auditFrames: getPhysicsFrameCount() - warmupFrames, elapsedMs: performance.now() - started });
}

const request = { schema: "line.impact-axis-model-audit-request.v1", implementation,
  parentRequestSha256: hash(readFileSync(resolve(parentDirectory, "request.json"))), pairsSha256: hash(readFileSync(pairsPath)),
  law: "all original paths; replay accepted secants and last rejected point exactly; fixed directional scales +/-0.001 and +/-0.0005; no optimization or suffix" };
const requestPath = resolve(out, "request.json");
if (existsSync(requestPath)) {
  if (JSON.stringify(read(requestPath)) !== JSON.stringify(request)) throw new Error("request changed");
} else write(requestPath, request);
const requestSha256 = hash(readFileSync(requestPath));
if (arg("worker")) worker(pairs.sources.find((s: any) => s.sourceId === arg("worker")), requestSha256);
else {
  const jobs = Number(arg("jobs") ?? "8");
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error("invalid jobs");
  const queue: any[] = pairs.sources.filter((s: any) => {
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
      copyFileSync(script, resolve(workspace.directory, "scripts/benchmark/impact_axis_model_audit.ts"));
      for (const path of dependencies) copyFileSync(path, resolve(workspace.directory, path));
      const failures: string[] = [];
      await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
        while (queue.length) {
          const source = queue.shift()!;
          const code = await new Promise<number | null>((done, reject) => {
            const child = spawn(process.execPath, ["--import", "tsx", "scripts/benchmark/impact_axis_model_audit.ts",
              `--worker=${source.sourceId}`, `--captures=${captures}`, `--input=${input}`, `--parent=${parentDirectory}`, `--pairs=${pairsPath}`, `--out=${out}`],
              { cwd: workspace.directory, env: environment, stdio: ["ignore", "ignore", "inherit"] });
            child.on("error", reject); child.on("exit", done);
          });
          if (code !== 0) failures.push(`${source.sourceId}: ${code}`);
        }
      }));
      if (failures.length) throw new Error(failures.join("\n"));
    } finally { disposeSnapshotWorkspace(workspace); }
  }
  const results: any[] = pairs.sources.map((s: any) => read(resolve(out, `${s.sourceId}.json`))), states: any[] = results.flatMap(r => r.states);
  const measurable = states.filter(s => s.audit.available), stable = measurable.filter(s => s.audit.stencilDisagreement <= 0.01);
  const median = (values: number[]) => values.length ? values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)] : null;
  const summary = { schema: "line.impact-axis-model-audit-summary.v1", implementation, requestSha256, sources: results.length,
    pairs: states.length, exactReplays: states.filter(s => s.replayExact).length, measurable: measurable.length, stable: stable.length,
    medianStencilDisagreement: median(measurable.map(s => s.audit.stencilDisagreement)),
    medianInfinitesimalModelError: median(stable.map(s => s.audit.infinitesimalModelError)),
    medianFiniteStepCurvature: median(stable.filter(s => s.audit.finiteStepCurvature !== null).map(s => s.audit.finiteStepCurvature)),
    stableNonDescent: stable.filter(s => s.audit.exactLocalObjectiveDerivative >= 0).length,
    warmupFrames: results.reduce((s, r) => s + r.warmupFrames, 0), auditFrames: results.reduce((s, r) => s + r.auditFrames, 0),
    workerSeconds: results.reduce((s, r) => s + r.elapsedMs / 1000, 0) };
  write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
}
