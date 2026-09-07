/** Observation-only audit of selected-fit measurements in the completed track.
 * Run against the verified promoted snapshot, with resumable per-source files.
 *   LR_ENGINE=wasm node --import tsx scripts/benchmark/impact_delivery_trace.ts
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { compilerCandidateIdentity } from "../v0/benchmark_v2/compiler_identity.ts";
import { createSnapshotWorkspace, disposeSnapshotWorkspace } from "../v0/benchmark_v2/compiler_snapshot.ts";
import { compileHandoff, type HandoffNode } from "../v0/optimizer/handoff.ts";
import { scoreDriftReport } from "../v0/score.ts";
import { simulateTrack } from "../v0/impact_support.ts";
import { contactRedirArcPxAtLanding, findAuthoredContactNearFrame } from "../v0/core/substrate.ts";
import { FPS, IMPACT_WINDOW, normImpact, wrapPi, type TrackLine } from "../v0/types.ts";

const argument = (name: string) => process.argv.slice(2).find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const seed = Number(argument("seed") ?? "260907000");
const budget = Number(argument("budget") ?? "750000");
const out = resolve(argument("out") ?? "generated/benchmark-v2/impact-delivery-650-new/selected-fit-trace");
const scriptPath = fileURLToPath(import.meta.url);
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const scriptSha256 = hash(readFileSync(scriptPath));
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const sources = developmentCases.map(entry => entry.case).sort((a, b) => a.metadata.id.localeCompare(b.metadata.id));
if (!Number.isSafeInteger(seed) || seed < 0 || !Number.isSafeInteger(budget) || budget < 1) throw new Error("invalid seed/budget");
mkdirSync(out, { recursive: true });

function publish(path: string, value: unknown): void {
  const bytes = `${JSON.stringify(value)}\n`;
  writeFileSync(path, bytes);
  writeFileSync(`${path}.sha256`, `${hash(bytes)}  ${basename(path)}\n`);
}

function loadResult(path: string): any {
  const bytes = readFileSync(path);
  if (readFileSync(`${path}.sha256`, "utf8").split(/\s/)[0] !== hash(bytes)) throw new Error(`checksum mismatch: ${path}`);
  const value = JSON.parse(bytes.toString());
  if (value.seed !== seed || value.budget !== budget || value.scriptSha256 !== scriptSha256 ||
      value.candidateFingerprint !== baseline.candidate_fingerprint) throw new Error(`incompatible checkpoint: ${path}`);
  return value;
}

// Only physical line fields determine membership; serialized property order does not.
const lineKey = (line: TrackLine): string => JSON.stringify([
  line.id, line.type, line.x1, line.y1, line.x2, line.y2,
  line.flipped ?? false, line.leftExtended ?? false, line.rightExtended ?? false,
]);

async function worker(sourceId: string): Promise<void> {
  const identity = compilerCandidateIdentity("wasm");
  if (identity.candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("worker is not the exact promoted compiler snapshot");
  const source = sources.find(source => source.metadata.id === sourceId);
  if (!source) throw new Error(`unknown source ${sourceId}`);
  const spec = applyJolt(source.spec, benchmarkPolicy.transform.joltMs);
  const started = performance.now();
  const holder: { winner: HandoffNode | null; score: number | null } = { winner: null, score: null };
  const compiled = compileHandoff(spec, seed, { budget, onNode(node, key, event) {
    if (event.improved) { holder.winner = node; holder.score = key.full_score; }
  } });
  const score = scoreDriftReport(compiled.report, { totalFrames: Math.round(spec.duration * FPS) });
  const trackHash = hash(JSON.stringify(compiled.track));
  let observerIdentity: boolean | null = null;
  if (sourceId === "amplitude_tides" || sourceId === "frontier_dense_recovery") {
    const control = compileHandoff(spec, seed, { budget });
    observerIdentity = hash(JSON.stringify(control.track)) === trackHash &&
      JSON.stringify(control.report) === JSON.stringify(compiled.report) &&
      control.stats.sim_frames === compiled.stats.sim_frames;
    if (!observerIdentity) throw new Error(`${sourceId}: observation changed compilation`);
  }
  const winnerScoreMatches = holder.score !== null && Math.abs(holder.score - score.score) < 1e-9;
  const fits = winnerScoreMatches ? holder.winner?.search.prefixFits ?? [] : [];
  const finalLines = new Map(compiled.track.lines.map(line => [line.id, lineKey(line)]));
  const owners = new Map<number, number>();
  fits.forEach((fit, gap) => fit?.lines.forEach(line => owners.set(line.id, gap)));
  // This replay runs after compilation, so it cannot change the frame budget.
  const sim = simulateTrack(compiled.track);
  const gaps = compiled.report.gaps;
  const rows = gaps.flatMap((gap, offset) => {
    const impact = gap.axes.impact;
    if (!impact) return [];
    const fit = fits[gap.gap_index];
    const geometryMatches = fit !== null && fit !== undefined && fit.lines.length > 0 &&
      fit.lines.every(line => finalLines.get(line.id) === lineKey(line));
    const targetFrame = Math.round(gap.t_end * FPS);
    const startFrame = Math.round((offset ? gaps[offset - 1].t_end : 0) * FPS);
    const landing = findAuthoredContactNearFrame(sim.det, targetFrame, 1, targetFrame - startFrame);
    const frames = [];
    let rawImpulse = 0;
    if (landing) {
      let previous = sim.vel[landing.frame - 1] ?? sim.vel[landing.frame];
      for (let frame = landing.frame; frame <= Math.min(sim.last, landing.frame + IMPACT_WINDOW); frame++) {
        const velocity = sim.vel[frame];
        if (!velocity || !previous) throw new Error("missing contact-window velocity");
        const contacted = sim.det.measurements.airborne[frame] === false;
        const speedBefore = Math.hypot(previous.x, previous.y);
        const speed = Math.hypot(velocity.x, velocity.y);
        const turn = wrapPi(Math.atan2(velocity.y, velocity.x) - Math.atan2(previous.y, previous.x));
        const impulse = contacted && speedBefore > 1e-9 && speed > 1e-9
          ? 0.5 * (speedBefore + speed) * Math.abs(turn) : 0;
        rawImpulse += impulse;
        frames.push({ frame, velocity, speed, contacted, turn, impulse,
          lineIds: sim.cids[frame], lineOwners: sim.cids[frame].map(id => owners.get(id) ?? null) });
        previous = velocity;
      }
      const shared = contactRedirArcPxAtLanding(sim.det, landing.frame);
      if (shared === undefined || Math.abs(shared - rawImpulse) > 1e-9 ||
          Math.abs(normImpact(shared) - impact.achieved) > 1e-9) {
        throw new Error(`${sourceId} gap ${gap.gap_index}: final impact replay mismatch`);
      }
    }
    const localAxes = geometryMatches ? fit.achieved : null;
    return [{ gapIndex: gap.gap_index, targetFrame, actualFrame: landing?.frame ?? null,
      gapFrames: targetFrame - startFrame,
      nextGapFrames: offset + 1 < gaps.length ? Math.round(gaps[offset + 1].t_end * FPS) - targetFrame : null,
      finalAxes: gap.axes, nextAxes: gaps[offset + 1]?.axes ?? null, localAxes,
      localImpact: localAxes?.impact ?? null, finalImpact: impact.achieved,
      localToFinalImpact: localAxes?.impact === undefined ? null : impact.achieved - localAxes.impact,
      geometryMatches, source: holder.winner?.rankTrace[gap.gap_index]?.source ?? null,
      incomingVelocity: landing ? sim.vel[landing.frame - 1] ?? null : null,
      rawImpulse, frames }];
  });
  const record = { schema: "line.impact-delivery-selected-fit-trace.v1", sourceId, seed, budget,
    scriptSha256, candidateFingerprint: identity.candidateFingerprint,
    compilerSnapshotSha256: baseline.compiler_snapshot.archiveSha256,
    score: score.score, valid: score.contract_passed, simFrames: compiled.stats.sim_frames,
    elapsedMs: performance.now() - started, trackHash, observerIdentity, winnerScoreMatches, rows };
  publish(resolve(out, `${sourceId}.track.json`), compiled.track);
  publish(resolve(out, `${sourceId}.json`), record);
}

const workerSource = argument("worker");
if (workerSource) {
  await worker(workerSource);
} else {
  const jobs = Number(argument("jobs") ?? "8");
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error("jobs must be 1..48");
  const queue = sources.filter(source => {
    const path = resolve(out, `${source.metadata.id}.json`);
    if (!existsSync(path)) return true;
    if (loadResult(path).sourceId !== source.metadata.id) throw new Error("checkpoint source mismatch");
    return false;
  });
  if (queue.length) {
    const workspace = createSnapshotWorkspace(baseline.compiler_snapshot);
    const environment = { ...process.env };
    for (const key of Object.keys(environment)) if (key.startsWith("LR_")) delete environment[key];
    Object.assign(environment, baseline.compiler_snapshot.compilerEnvironment, { LR_ENGINE: "wasm" });
    try {
      copyFileSync(scriptPath, resolve(workspace.directory, "scripts/benchmark/impact_delivery_trace.ts"));
      const failures: string[] = [];
      await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
        while (queue.length) {
          const source = queue.shift()!;
          const id = source.metadata.id;
          const code = await new Promise<number | null>((done, reject) => {
            const child = spawn(process.execPath, ["--import", "tsx", "scripts/benchmark/impact_delivery_trace.ts",
              `--worker=${id}`, `--seed=${seed}`, `--budget=${budget}`, `--out=${out}`],
              { cwd: workspace.directory, env: environment, stdio: ["ignore", "ignore", "inherit"] });
            child.on("error", reject);
            child.on("exit", done);
          });
          if (code !== 0) { failures.push(`${id}: exit ${code}`); continue; }
          const value = loadResult(resolve(out, `${id}.json`));
          process.stderr.write(`${id}: score=${value.score.toFixed(2)} valid=${value.valid} contacts=${value.rows.length}\n`);
        }
      }));
      if (failures.length) throw new Error(failures.join("\n"));
    } finally { disposeSnapshotWorkspace(workspace); }
  }
  const records = sources.map(source => loadResult(resolve(out, `${source.metadata.id}.json`)));
  const rows = records.flatMap(record => record.rows);
  const matched = rows.filter(row => row.localImpact !== null);
  const differing = matched.filter(row => Math.abs(row.localToFinalImpact) > 1e-9);
  const summary = { schema: "line.impact-delivery-selected-fit-summary.v1", seed, budget, scriptSha256,
    candidateFingerprint: baseline.candidate_fingerprint, sources: records.length,
    validRuns: records.filter(record => record.valid).length, contacts: rows.length,
    matchedFits: matched.length, differingImpact: differing.length,
    maximumImpactDifference: Math.max(0, ...matched.map(row => Math.abs(row.localToFinalImpact))),
    observerChecks: records.filter(record => record.observerIdentity !== null).map(record => ({ sourceId: record.sourceId, exact: record.observerIdentity })),
    perSource: records.map(record => ({ sourceId: record.sourceId, score: record.score, valid: record.valid,
      matched: record.rows.filter((row: any) => row.localImpact !== null).length,
      differing: record.rows.filter((row: any) => row.localImpact !== null && Math.abs(row.localToFinalImpact) > 1e-9).length })) };
  publish(resolve(out, "summary.json"), summary);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
