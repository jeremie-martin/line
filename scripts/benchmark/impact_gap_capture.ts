/** Fresh discovery census and complete winning metadata in one source compile. */
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
import { compileLegacyHandoff, compileHandoffFromSnapshot, setHandoffRolloutProbeHook } from "../v0/optimizer/legacy_handoff.ts";
import { makeRootNode, extendNodeCached } from "../v0/optimizer/node.ts";
import { makeBaseEngine, engineLineFromTrackLine, contactRedirArcPxAtLanding, findAuthoredContactNearFrame } from "../v0/core/substrate.ts";
import { scoreDriftReport } from "../v0/score.ts";
import { simulateTrack } from "../v0/impact_support.ts";
import { FPS, IMPACT_WINDOW, normImpact, wrapPi } from "../v0/types.ts";
import { getPhysicsFrameCount } from "../lib/detector.ts";
import { read, write } from "./impact_release_response.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const out = resolve(arg("out") ?? "generated/benchmark-v2/impact-delivery-650-new/interrupted-support-capture");
const script = fileURLToPath(import.meta.url), hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const implementation = [script, "scripts/benchmark/impact_release_response.ts"].map(p => hash(readFileSync(p))).join(":");
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const seed = Number(arg("seed") ?? 260907001), budget = 750000;
const stopAfterFirstCompletion = arg("first-completion") === "on";
const requestedSources = arg("sources")?.split(",");
const sources = developmentCases.map(e => e.case).filter(s => !requestedSources || requestedSources.includes(s.metadata.id))
  .sort((a, b) => a.metadata.id.localeCompare(b.metadata.id));
if (!Number.isSafeInteger(seed) || !sources.length || (requestedSources && requestedSources.length !== sources.length)) throw new Error("invalid capture request");
const controls = ["amplitude_tides", "frontier_dense_recovery"].filter(id => sources.some(s => s.metadata.id === id));
const lineKey = (lines: any[]) => JSON.stringify(lines.map(l => [l.id, l.type, l.x1, l.y1, l.x2, l.y2,
  !!l.flipped, !!l.leftExtended, !!l.rightExtended]));
mkdirSync(out, { recursive: true });

function worker(sourceId: string, requestSha256: string): void {
  if (compilerCandidateIdentity("wasm").candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("wrong promoted compiler");
  const spec = applyJolt(sources.find(s => s.metadata.id === sourceId)!.spec, benchmarkPolicy.transform.joltMs);
  const started = performance.now(), holder: { node: any; key: any; event: any; context: any } = { node: null, key: null, event: null, context: null };
  setHandoffRolloutProbeHook(r => {
    if (r.gaps && r.ctx) holder.context = { gaps: r.gaps, gapAxisTargets: r.ctx.gapAxisTargets,
      allContactFrames: r.ctx.allContactFrames, durationFrames: r.ctx.durationFrames };
  });
  let compiled: ReturnType<typeof compileLegacyHandoff>;
  try {
    compiled = compileLegacyHandoff(spec, seed, { budget, stopAfterFirstCompletion, onNode(node, key, event) {
      if (event.improved) Object.assign(holder, { node, key, event });
    } });
  } finally { setHandoffRolloutProbeHook(null); }
  const captureMs = performance.now() - started, score = scoreDriftReport(compiled.report, { totalFrames: Math.round(spec.duration * FPS) });
  if (!holder.node || !holder.context || !score.contract_passed || Math.abs(score.score - holder.key.full_score) > 1e-9) throw new Error("unavailable winning state");
  const trackHash = hash(JSON.stringify(compiled.track)), reportHash = hash(JSON.stringify(compiled.report));
  const node = holder.node, snapshot = { key: holder.key, event: holder.event, node: {
    startState: node.startState, startLines: node.startLines, startRank: node.startRank, searchSeed: node.searchSeed,
    startExpanded: node.startExpanded, deferExpansion: node.deferExpansion, rankTrace: node.rankTrace, skippedContacts: node.skippedContacts,
    search: { gapIndex: node.search.gapIndex, prefixFits: node.search.prefixFits,
      prefixNextLineId: node.search.prefixNextLineId, cumulativeCost: node.search.cumulativeCost },
  } };
  let controlFrames = 0, observerExact: boolean | null = null;
  if (controls.includes(sourceId)) {
    const control = compileLegacyHandoff(spec, seed, { budget, stopAfterFirstCompletion });
    controlFrames = control.stats.sim_frames;
    observerExact = hash(JSON.stringify(control.track)) === trackHash && hash(JSON.stringify(control.report)) === reportHash &&
      control.stats.sim_frames === compiled.stats.sim_frames;
    if (!observerExact) throw new Error("observer changed compilation");
  }
  let engine = makeBaseEngine(node.startState);
  if (node.startLines.length) engine = engine.addLine(node.startLines.map(engineLineFromTrackLine));
  let search = { ...makeRootNode(engine, holder.context.gaps.length), prefixNextLineId: 1 + node.startLines.length };
  for (const fit of node.search.prefixFits) search = extendNodeCached(search, fit);
  const replay = compileHandoffFromSnapshot(spec, seed, { ...snapshot, node: { ...snapshot.node, search } }, {
    budget, searchSeed: node.searchSeed, stopAfterFirstCompletion: true,
  });
  const preflightFrames = getPhysicsFrameCount();
  const replayScore = scoreDriftReport(replay.report, { totalFrames: Math.round(spec.duration * FPS) });
  if (hash(JSON.stringify(replay.track)) !== trackHash || hash(JSON.stringify(replay.report)) !== reportHash || replayScore.score !== score.score) throw new Error("ordinary replay mismatch");
  const sim = simulateTrack(compiled.track), finalLines = new Map<number, any>(compiled.track.lines.map(l => [l.id, l]));
  const owners = new Map<number, number>();
  node.search.prefixFits.forEach((fit: any, gap: number) => fit?.lines.forEach((l: any) => owners.set(l.id, gap)));
  const rows = compiled.report.gaps.flatMap((gap, offset) => {
    if (!gap.axes.impact) return [];
    const fit = node.search.prefixFits[gap.gap_index], targetFrame = Math.round(gap.t_end * FPS);
    const startFrame = Math.round((offset ? compiled.report.gaps[offset - 1].t_end : 0) * FPS);
    const landing = findAuthoredContactNearFrame(sim.det, targetFrame, 1, targetFrame - startFrame);
    if (!fit || !landing || lineKey(fit.lines) !== lineKey(fit.lines.map((l: any) => finalLines.get(l.id)))) throw new Error("selected geometry mismatch");
    for (const [axis, value] of Object.entries(gap.axes) as Array<[string, any]>) {
      if (fit.achieved[axis] !== value.achieved || holder.context.gapAxisTargets[gap.gap_index][axis] !== value.target) throw new Error("selected axis mismatch");
    }
    if (holder.context.gaps[gap.gap_index].targets.impact !== gap.axes.impact.target) throw new Error("impact target changed");
    const frames = [], incomingVelocity = sim.vel[landing.frame - 1];
    let previous = incomingVelocity, rawImpulse = 0;
    for (let frame = landing.frame; frame <= landing.frame + IMPACT_WINDOW; frame++) {
      const velocity = sim.vel[frame], contacted = sim.det.measurements.airborne[frame] === false;
      const speedBefore = Math.hypot(previous.x, previous.y), speed = Math.hypot(velocity.x, velocity.y);
      const turn = wrapPi(Math.atan2(velocity.y, velocity.x) - Math.atan2(previous.y, previous.x));
      const impulse = contacted && speedBefore > 1e-9 && speed > 1e-9 ? 0.5 * (speedBefore + speed) * Math.abs(turn) : 0;
      rawImpulse += impulse;
      frames.push({ frame, velocity, speed, contacted, turn, impulse, lineIds: sim.cids[frame],
        lineOwners: sim.cids[frame].map(id => owners.get(id) ?? null) });
      previous = velocity;
    }
    const shared = contactRedirArcPxAtLanding(sim.det, landing.frame);
    if (shared === undefined || Math.abs(shared - rawImpulse) > 1e-9 || Math.abs(normImpact(shared) - gap.axes.impact.achieved) > 1e-9) throw new Error("impulse mismatch");
    return [{ gapIndex: gap.gap_index, targetFrame, actualFrame: landing.frame, gapFrames: targetFrame - startFrame,
      nextGapFrames: offset + 1 < compiled.report.gaps.length ? Math.round(compiled.report.gaps[offset + 1].t_end * FPS) - targetFrame : null,
      finalAxes: gap.axes, localAxes: fit.achieved, geometryMatches: true, finalImpact: gap.axes.impact.achieved,
      incomingVelocity, rawImpulse, frames }];
  });
  const record = { schema: "line.interrupted-support-census.v1", implementation, requestSha256, sourceId, seed, budget,
    candidateFingerprint: baseline.candidate_fingerprint, score: score.score, valid: true, trackHash, reportHash,
    simFrames: compiled.stats.sim_frames, controlFrames, observerExact, preflightFrames,
    censusFrames: getPhysicsFrameCount() - preflightFrames, captureMs, elapsedMs: performance.now() - started, rows };
  write(resolve(out, `${sourceId}.track.json`), compiled.track);
  write(resolve(out, `${sourceId}.report.json`), compiled.report);
  write(resolve(out, `${sourceId}.json`), record);
  const capturePath = resolve(out, `${sourceId}.capture.json`);
  write(capturePath, { schema: "line.impact-continuation-capture.v1", implementation, requestSha256, sourceId, seed, budget,
    candidateFingerprint: baseline.candidate_fingerprint, compilerSnapshotSha256: baseline.compiler_snapshot.archiveSha256,
    censusRecordSha256: hash(readFileSync(resolve(out, `${sourceId}.json`))), trackHash, reportHash,
    score: score.score, compileFrames: compiled.stats.sim_frames, elapsedMs: captureMs, context: holder.context, snapshot });
  write(resolve(out, `${sourceId}.preflight.json`), { implementation, requestSha256, sourceId,
    captureSha256: hash(readFileSync(capturePath)), trackExact: true, reportExact: true, scoreExact: true, physicsFrames: preflightFrames });
}

const request = { schema: "line.interrupted-support-census-request.v1", implementation, seed, budget, stopAfterFirstCompletion,
  candidateFingerprint: baseline.candidate_fingerprint, sources: sources.map(s => s.metadata.id), controls,
  law: "capture full winning metadata and exact selected-fit census in one compile; ordinary full-snapshot replay; two observer-free controls" };
const requestPath = resolve(out, "request.json");
if (existsSync(requestPath)) {
  if (JSON.stringify(read(requestPath)) !== JSON.stringify(request)) throw new Error("request changed");
} else write(requestPath, request);
const requestSha256 = hash(readFileSync(requestPath));
if (arg("worker")) worker(arg("worker")!, requestSha256);
else {
  const jobs = Number(arg("jobs") ?? "8");
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error("invalid jobs");
  const queue = sources.filter(s => {
    const path = resolve(out, `${s.metadata.id}.json`);
    if (!existsSync(path)) return true;
    if (read(path).requestSha256 !== requestSha256 || !existsSync(resolve(out, `${s.metadata.id}.preflight.json`))) throw new Error("incompatible checkpoint");
    return false;
  });
  if (queue.length) {
    const workspace = createSnapshotWorkspace(baseline.compiler_snapshot), environment = { ...process.env };
    for (const key of Object.keys(environment)) if (key.startsWith("LR_")) delete environment[key];
    Object.assign(environment, baseline.compiler_snapshot.compilerEnvironment, { LR_ENGINE: "wasm" });
    try {
      copyFileSync(script, resolve(workspace.directory, "scripts/benchmark/impact_gap_capture.ts"));
      const failures: string[] = [];
      await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
        while (queue.length) {
          const source = queue.shift()!;
          const code = await new Promise<number | null>((done, reject) => {
            const child = spawn(process.execPath, ["--import", "tsx", "scripts/benchmark/impact_gap_capture.ts", `--worker=${source.metadata.id}`, `--out=${out}`,
              `--seed=${seed}`, `--first-completion=${stopAfterFirstCompletion ? "on" : "off"}`, `--sources=${sources.map(s => s.metadata.id).join(",")}`],
              { cwd: workspace.directory, env: environment, stdio: ["ignore", "ignore", "inherit"] });
            child.on("error", reject); child.on("exit", done);
          });
          if (code !== 0) failures.push(`${source.metadata.id}: ${code}`);
          else process.stderr.write(`${source.metadata.id}: capture and exact preflight complete\n`);
        }
      }));
      if (failures.length) throw new Error(failures.join("\n"));
    } finally { disposeSnapshotWorkspace(workspace); }
  }
  const records = sources.map(s => read(resolve(out, `${s.metadata.id}.json`)));
  const sum = (key: string) => records.reduce((s, r) => s + r[key], 0);
  const summary = { schema: "line.interrupted-support-census-summary.v1", implementation, requestSha256, seed, budget,
    candidateFingerprint: baseline.candidate_fingerprint, sources: records.length, contacts: records.reduce((s, r) => s + r.rows.length, 0),
    valid: records.filter(r => r.valid).length, observerControls: records.filter(r => r.observerExact === true).length,
    compileFrames: sum("simFrames"), controlFrames: sum("controlFrames"), preflightFrames: sum("preflightFrames"),
    censusFrames: sum("censusFrames"), workerSeconds: sum("elapsedMs") / 1000, perSource: records.map(r => ({ sourceId: r.sourceId })) };
  write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
}
