/** Extend the existing discovery census with exact winning-fit metadata.
 * Capture once from the promoted snapshot; replay via the ordinary snapshot API.
 * This is observation/preflight work, not new independent benchmark evidence.
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
import { compileLegacyHandoff, compileHandoffFromSnapshot, setHandoffRolloutProbeHook,
  type HandoffNode, type HandoffNodeSnapshot } from "../v0/optimizer/legacy_handoff.ts";
import { makeRootNode, extendNodeCached } from "../v0/optimizer/node.ts";
import { makeBaseEngine, engineLineFromTrackLine } from "../v0/core/substrate.ts";
import { scoreDriftReport } from "../v0/score.ts";
import { getPhysicsFrameCount } from "../lib/detector.ts";
import { read, write } from "./impact_release_response.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const input = resolve(arg("input") ?? "generated/benchmark-v2/impact-delivery-650-new/selected-fit-trace");
const out = resolve(arg("out") ?? "generated/benchmark-v2/impact-delivery-650-new/continuation-capture");
const script = fileURLToPath(import.meta.url), hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const implementation = hash(readFileSync(script));
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const census = read(resolve(input, "summary.json"));
mkdirSync(out, { recursive: true });

function loadCapture(sourceId: string): any {
  const capture = read(resolve(out, `${sourceId}.capture.json`)), original = read(resolve(input, `${sourceId}.json`));
  if (capture.sourceId !== sourceId || capture.candidateFingerprint !== baseline.candidate_fingerprint ||
      capture.seed !== original.seed || capture.budget !== original.budget || capture.trackHash !== original.trackHash ||
      capture.compileFrames !== original.simFrames || Math.abs(capture.score - original.score) > 1e-9 ||
      capture.censusRecordSha256 !== hash(readFileSync(resolve(input, `${sourceId}.json`)))) throw new Error("capture identity mismatch");
  for (const row of original.rows) {
    const targets = capture.context.gapAxisTargets[row.gapIndex];
    for (const [axis, value] of Object.entries(row.finalAxes) as Array<[string, any]>) {
      if (targets[axis] !== value.target) throw new Error("captured authored target mismatch");
    }
    if (capture.context.gaps[row.gapIndex].targets.impact !== row.finalAxes.impact.target) throw new Error("impact target was altered");
  }
  return capture;
}

function restore(capture: any): HandoffNodeSnapshot {
  const stored = capture.snapshot.node;
  let engine = makeBaseEngine(stored.startState);
  if (stored.startLines.length) engine = engine.addLine(stored.startLines.map(engineLineFromTrackLine));
  let search = { ...makeRootNode(engine, capture.context.gaps.length), prefixNextLineId: 1 + stored.startLines.length };
  for (const fit of stored.search.prefixFits) search = extendNodeCached(search, fit);
  if (search.gapIndex !== stored.search.gapIndex || search.prefixNextLineId !== stored.search.prefixNextLineId ||
      search.cumulativeCost !== stored.search.cumulativeCost) throw new Error("ordinary prefix reconstruction mismatch");
  return { ...capture.snapshot, node: { ...stored, search } };
}

function worker(sourceId: string): void {
  if (compilerCandidateIdentity("wasm").candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("worker is not promoted snapshot");
  const original = read(resolve(input, `${sourceId}.json`));
  const catalog = developmentCases.find(e => e.case.metadata.id === sourceId);
  if (!catalog) throw new Error("unknown source");
  const spec = applyJolt(catalog.case.spec, benchmarkPolicy.transform.joltMs);
  const capturePath = resolve(out, `${sourceId}.capture.json`);
  if (!existsSync(capturePath)) {
    const started = performance.now();
    const holder: { node: HandoffNode | null; key: any; event: any; context: any } = { node: null, key: null, event: null, context: null };
    setHandoffRolloutProbeHook(record => {
      if (record.gaps && record.ctx) holder.context = { gaps: record.gaps,
        gapAxisTargets: record.ctx.gapAxisTargets, allContactFrames: record.ctx.allContactFrames, durationFrames: record.ctx.durationFrames };
    });
    let compiled: ReturnType<typeof compileLegacyHandoff>;
    try {
      compiled = compileLegacyHandoff(spec, original.seed, { budget: original.budget, onNode(node, key, event) {
        if (event.improved) { holder.node = node; holder.key = key; holder.event = event; }
      } });
    } finally { setHandoffRolloutProbeHook(null); }
    const score = scoreDriftReport(compiled.report, { totalFrames: Math.round(spec.duration * 40) });
    const trackHash = hash(JSON.stringify(compiled.track)), reportHash = hash(JSON.stringify(compiled.report));
    if (!holder.node || !holder.context || !score.contract_passed || Math.abs(score.score - original.score) > 1e-9 ||
        Math.abs(holder.key.full_score - score.score) > 1e-9 || trackHash !== original.trackHash || compiled.stats.sim_frames !== original.simFrames) {
      write(resolve(out, `${sourceId}.capture-failure.json`), { trackHash, score: score.score, compileFrames: compiled.stats.sim_frames,
        expectedTrackHash: original.trackHash, expectedScore: original.score, expectedFrames: original.simFrames });
      throw new Error(`${sourceId}: observation changed captured compilation`);
    }
    const node = holder.node, search = node.search;
    const snapshot = { key: holder.key, event: holder.event, node: { startState: node.startState, startLines: node.startLines,
      startRank: node.startRank, searchSeed: node.searchSeed, startExpanded: node.startExpanded, deferExpansion: node.deferExpansion,
      rankTrace: node.rankTrace, skippedContacts: node.skippedContacts,
      search: { gapIndex: search.gapIndex, prefixFits: search.prefixFits, prefixNextLineId: search.prefixNextLineId, cumulativeCost: search.cumulativeCost } } };
    write(capturePath, { schema: "line.impact-continuation-capture.v1", implementation, sourceId, seed: original.seed, budget: original.budget,
      candidateFingerprint: baseline.candidate_fingerprint, compilerSnapshotSha256: baseline.compiler_snapshot.archiveSha256,
      censusRecordSha256: hash(readFileSync(resolve(input, `${sourceId}.json`))), trackHash, reportHash, score: score.score,
      compileFrames: compiled.stats.sim_frames, elapsedMs: performance.now() - started, spec, context: holder.context, snapshot });
  }
  const capture = loadCapture(sourceId), started = performance.now();
  const restored = restore(capture);
  // The production API constructs its own current authored setup and evaluates
  // the complete root. Stop on that first complete offer; no suffix search is
  // needed for an already complete ordinary control.
  // Axis curves are functions. The JSON spec is descriptive metadata; reload
  // the exact catalog spec above rather than silently dropping those targets.
  const replay = compileHandoffFromSnapshot(spec, capture.seed, restored, {
    budget: capture.budget, searchSeed: capture.snapshot.node.searchSeed, stopAfterFirstCompletion: true,
  });
  const score = scoreDriftReport(replay.report, { totalFrames: capture.context.durationFrames });
  const trackExact = hash(JSON.stringify(replay.track)) === capture.trackHash;
  const reportExact = hash(JSON.stringify(replay.report)) === capture.reportHash;
  const scoreExact = score.contract_passed && Math.abs(score.score - capture.score) <= 1e-9;
  write(resolve(out, `${sourceId}.preflight.json`), { schema: "line.impact-continuation-preflight.v1", implementation,
    sourceId, captureSha256: hash(readFileSync(capturePath)), trackExact, reportExact, scoreExact,
    // compileHandoffFromSnapshot resets the per-compile physics counter.
    snapshotFrames: replay.stats.sim_frames, physicsFrames: getPhysicsFrameCount(),
    elapsedMs: performance.now() - started, gaps: capture.context.gaps.length,
    contacts: capture.context.gaps.filter((g: any) => g.endsWithContact).length });
  if (!trackExact || !reportExact || !scoreExact) throw new Error(`${sourceId}: ordinary snapshot replay mismatch`);
}

const workerId = arg("worker");
if (workerId) worker(workerId);
else {
  const jobs = Number(arg("jobs") ?? "8");
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error("invalid jobs");
  const queue = census.perSource.filter((s: any) => {
    const path = resolve(out, `${s.sourceId}.preflight.json`);
    if (!existsSync(path)) return true;
    const previous = read(path);
    loadCapture(s.sourceId);
    if (previous.implementation !== implementation) throw new Error("preflight implementation changed; retain previous outputs");
    return !(previous.trackExact && previous.reportExact && previous.scoreExact);
  });
  if (queue.length) {
    const workspace = createSnapshotWorkspace(baseline.compiler_snapshot), environment = { ...process.env };
    for (const key of Object.keys(environment)) if (key.startsWith("LR_")) delete environment[key];
    Object.assign(environment, baseline.compiler_snapshot.compilerEnvironment, { LR_ENGINE: "wasm" });
    try {
      copyFileSync(script, resolve(workspace.directory, "scripts/benchmark/impact_continuation_capture.ts"));
      const failures: string[] = [];
      await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
        while (queue.length) {
          const source = queue.shift();
          const code = await new Promise<number | null>((done, reject) => {
            const child = spawn(process.execPath, ["--import", "tsx", "scripts/benchmark/impact_continuation_capture.ts",
              `--worker=${source.sourceId}`, `--input=${input}`, `--out=${out}`],
              { cwd: workspace.directory, env: environment, stdio: ["ignore", "ignore", "inherit"] });
            child.on("error", reject); child.on("exit", done);
          });
          if (code !== 0) failures.push(`${source.sourceId}: ${code}`);
          else process.stderr.write(`${source.sourceId}: capture and ordinary replay exact\n`);
        }
      }));
      if (failures.length) throw new Error(failures.join("\n"));
    } finally { disposeSnapshotWorkspace(workspace); }
  }
  const captures = census.perSource.map((s: any) => loadCapture(s.sourceId));
  const preflights = census.perSource.map((s: any) => read(resolve(out, `${s.sourceId}.preflight.json`)));
  const summary = { schema: "line.impact-continuation-capture-summary.v1", implementation, sources: captures.length,
    candidateFingerprint: baseline.candidate_fingerprint, exactCompiles: captures.length,
    exactPreflights: preflights.filter((r: any) => r.trackExact && r.reportExact && r.scoreExact).length,
    compileFrames: captures.reduce((n: number, r: any) => n + r.compileFrames, 0),
    replayPhysicsFrames: preflights.reduce((n: number, r: any) => n + r.physicsFrames, 0),
    workerSeconds: [...captures, ...preflights].reduce((n: number, r: any) => n + r.elapsedMs / 1000, 0) };
  write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
}
