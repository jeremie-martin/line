/** Re-admit unchanged winning lines at exact original prefixes, independently.
 * This checks the intervention interface; every next prefix uses the original fit.
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
import { compileHandoffFromSnapshot, type HandoffNodeSnapshot } from "../v0/optimizer/handoff.ts";
import { makeRootNode, extendNodeCached } from "../v0/optimizer/node.ts";
import { makeBaseEngine, engineLineFromTrackLine } from "../v0/core/substrate.ts";
import { tryCandidateLines, axisLookaheadEndFrame } from "../v0/core/candidate.ts";
import { getCandidateProbe } from "../v0/optimizer/sample.ts";
import { getPhysicsFrameCount } from "../lib/detector.ts";
import { read, write } from "./impact_release_response.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const captures = resolve(arg("captures") ?? "generated/benchmark-v2/impact-delivery-650-new/continuation-capture");
const out = resolve(arg("out") ?? "generated/benchmark-v2/impact-delivery-650-new/continuation-admission");
const script = fileURLToPath(import.meta.url), hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const implementation = hash(readFileSync(script));
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const ids = developmentCases.map(e => e.case.metadata.id).sort();
const lineKey = (lines: any[]) => JSON.stringify(lines.map(l => [l.id, l.type, l.x1, l.y1, l.x2, l.y2,
  !!l.flipped, !!l.leftExtended, !!l.rightExtended]));
mkdirSync(out, { recursive: true });

function root(capture: any): any {
  const stored = capture.snapshot.node;
  let engine = makeBaseEngine(stored.startState);
  if (stored.startLines.length) engine = engine.addLine(stored.startLines.map(engineLineFromTrackLine));
  return { ...makeRootNode(engine, capture.context.gaps.length), prefixNextLineId: 1 + stored.startLines.length };
}
function worker(sourceId: string): void {
  if (compilerCandidateIdentity("wasm").candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("wrong compiler snapshot");
  const capturePath = resolve(captures, `${sourceId}.capture.json`), capture = read(capturePath);
  const preflight = read(resolve(captures, `${sourceId}.preflight.json`));
  if (!preflight.trackExact || !preflight.reportExact || !preflight.scoreExact || preflight.captureSha256 !== hash(readFileSync(capturePath)) ||
      capture.candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("unverified capture");
  const spec = applyJolt(developmentCases.find(e => e.case.metadata.id === sourceId)!.case.spec, benchmarkPolicy.transform.joltMs);
  const stored = capture.snapshot.node, started = performance.now();
  let full = root(capture);
  for (const fit of stored.search.prefixFits) full = extendNodeCached(full, fit);
  const snapshot: HandoffNodeSnapshot = { ...capture.snapshot, node: { ...stored, search: full } };
  const replay = compileHandoffFromSnapshot(spec, capture.seed, snapshot, {
    budget: capture.budget, searchSeed: stored.searchSeed, stopAfterFirstCompletion: true,
  });
  if (hash(JSON.stringify(replay.report)) !== capture.reportHash || hash(JSON.stringify(replay.track)) !== capture.trackHash) throw new Error("warmup changed baseline");
  const setupFrames = getPhysicsFrameCount(), frameStart = setupFrames;
  let entry = root(capture);
  const rows: any[] = [];
  const ctx = { ...capture.context, probeCache: undefined };
  for (let index = 0; index < stored.search.prefixFits.length; index++) {
    const original = stored.search.prefixFits[index], gap = ctx.gaps[index];
    if (original !== null) {
      const before = getPhysicsFrameCount(), probe = getCandidateProbe(entry.prefixEngine, gap, ctx);
      const admitted = tryCandidateLines(entry.prefixEngine, gap, original.lines, entry.prefixNextLineId,
        ctx.allContactFrames, axisLookaheadEndFrame(gap, ctx.allContactFrames), gap.targets, true,
        "normal", probe.preTargetSledTrace, { allowRideOutPolish: false });
      const differences = Object.keys(ctx.gapAxisTargets[index]).map(axis => ({ axis,
        original: original.achieved[axis] ?? null, admitted: admitted?.achieved[axis] ?? null,
        exact: admitted?.achieved[axis] === original.achieved[axis] }));
      rows.push({ gapIndex: index, admitted: admitted !== null,
        geometryExact: admitted !== null && lineKey(admitted.lines) === lineKey(original.lines),
        axesExact: admitted !== null && differences.every(r => r.exact), differences,
        frames: getPhysicsFrameCount() - before });
    }
    entry = extendNodeCached(entry, original);
  }
  if (entry.prefixNextLineId !== stored.search.prefixNextLineId || entry.cumulativeCost !== stored.search.cumulativeCost) throw new Error("prefix replay changed");
  write(resolve(out, `${sourceId}.json`), { schema: "line.impact-continuation-admission.v1", implementation, sourceId,
    captureSha256: hash(readFileSync(capturePath)), rows, setupFrames,
    admissionFrames: getPhysicsFrameCount() - frameStart, elapsedMs: performance.now() - started });
}

const workerId = arg("worker");
if (workerId) worker(workerId);
else {
  const request = { schema: "line.impact-continuation-admission-request.v1", implementation,
    candidateFingerprint: baseline.candidate_fingerprint, sources: ids.map(sourceId => ({ sourceId,
      captureSha256: hash(readFileSync(resolve(captures, `${sourceId}.capture.json`))) })),
    law: "unchanged lines, exact prefix, ordinary probe and direct gate, no rideout polish; always advance original fit" };
  const requestPath = resolve(out, "request.json");
  if (existsSync(requestPath)) {
    if (JSON.stringify(read(requestPath)) !== JSON.stringify(request)) throw new Error("request changed");
  } else write(requestPath, request);
  const jobs = Number(arg("jobs") ?? "8");
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error("invalid jobs");
  const queue = ids.filter(id => {
    const path = resolve(out, `${id}.json`);
    if (!existsSync(path)) return true;
    if (read(path).implementation !== implementation) throw new Error("incompatible checkpoint");
    return false;
  });
  if (queue.length) {
    const workspace = createSnapshotWorkspace(baseline.compiler_snapshot), environment = { ...process.env };
    for (const key of Object.keys(environment)) if (key.startsWith("LR_")) delete environment[key];
    Object.assign(environment, baseline.compiler_snapshot.compilerEnvironment, { LR_ENGINE: "wasm" });
    try {
      copyFileSync(script, resolve(workspace.directory, "scripts/benchmark/impact_continuation_admission.ts"));
      const failures: string[] = [];
      await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
        while (queue.length) {
          const id = queue.shift()!;
          const code = await new Promise<number | null>((done, reject) => {
            const child = spawn(process.execPath, ["--import", "tsx", "scripts/benchmark/impact_continuation_admission.ts",
              `--worker=${id}`, `--captures=${captures}`, `--out=${out}`],
              { cwd: workspace.directory, env: environment, stdio: ["ignore", "ignore", "inherit"] });
            child.on("error", reject); child.on("exit", done);
          });
          if (code !== 0) failures.push(`${id}: ${code}`);
          else process.stderr.write(`${id}: admission preflight complete\n`);
        }
      }));
      if (failures.length) throw new Error(failures.join("\n"));
    } finally { disposeSnapshotWorkspace(workspace); }
  }
  const results = ids.map(id => read(resolve(out, `${id}.json`))), rows = results.flatMap(r => r.rows);
  const summary = { schema: "line.impact-continuation-admission-summary.v1", implementation, sources: results.length,
    contacts: rows.length, admitted: rows.filter(r => r.admitted).length, geometryExact: rows.filter(r => r.geometryExact).length,
    axesExact: rows.filter(r => r.axesExact).length, setupFrames: results.reduce((n, r) => n + r.setupFrames, 0),
    admissionFrames: results.reduce((n, r) => n + r.admissionFrames, 0),
    workerSeconds: results.reduce((n, r) => n + r.elapsedMs / 1000, 0) };
  write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
}
