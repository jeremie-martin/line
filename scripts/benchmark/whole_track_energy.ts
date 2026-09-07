/** Direct exact-track energy search with causal downstream geometry transport.
 * Research work is additional to the captured compile, never a 750k result.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { detect, extractRawTrajectory, getRiderMetered, getPhysicsFrameCount } from "../lib/detector.ts";
import { buildDriftReport } from "../v0/core/substrate.ts";
import { readTargetStateFromRider } from "../v0/arc_placement.ts";
import { buildAxisContract, scoreV2Report, summarizeDevelopmentBudget } from "../v0/benchmark_v2/evaluator.ts";
import { setCatchEnergy, transportCatch, type ArrivalFrame, type TransportMode } from "./whole_track_controls.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const input = resolve(arg("input") ?? "generated/benchmark-v2/impact-delivery-650-new/interrupted-support-capture");
const out = resolve(arg("out") ?? "generated/benchmark-v2/unrestricted-650/whole-track-energy");
const script = fileURLToPath(import.meta.url);
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const implementation = [script, resolve("scripts/benchmark/whole_track_controls.ts")].map(p => hash(readFileSync(p))).join(":");
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const suite = JSON.parse(readFileSync("benchmark/v2/compat/suite-manifest.json", "utf8"));
const engineHash = hash(readFileSync("engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm"));
if (process.env.LR_ENGINE !== "wasm" || engineHash !== baseline.engine_artifact_fingerprint) throw new Error("frozen exact engine required");
mkdirSync(out, { recursive: true });
const read = (p: string) => {
  const b = readFileSync(p);
  if (readFileSync(`${p}.sha256`, "utf8").split(/\s/)[0] !== hash(b)) throw new Error(`checksum mismatch: ${p}`);
  return JSON.parse(b.toString());
};
const write = (p: string, v: any) => {
  const b = `${JSON.stringify(v)}\n`;
  writeFileSync(p, b); writeFileSync(`${p}.sha256`, `${hash(b)}  ${basename(p)}\n`);
};
const lineKey = (lines: any[]) => JSON.stringify(lines.map(l => [l.id, l.type, l.x1, l.y1, l.x2, l.y2,
  !!l.flipped, !!l.leftExtended, !!l.rightExtended]));
const freshEngine = (track: any) => new LineRiderEngine().setStart(track.startPosition, track.riders[0].startVelocity);
const frameAt = (engine: any, frame: number): ArrivalFrame => {
  const rider = getRiderMetered(engine, frame);
  return readTargetStateFromRider(rider, rider.position.x, rider.position.y);
};

function worker(source: any, plan: any, planSha256: string): void {
  const started = performance.now(), sourceId = source.sourceId;
  const paths = ["capture", "track", "report"].map(kind => resolve(input, `${sourceId}.${kind}.json`));
  paths.forEach((p, i) => { if (hash(readFileSync(p)) !== source.inputHashes[i]) throw new Error("frozen input changed"); });
  const [capture, track, savedReport] = paths.map(read);
  if (capture.candidateFingerprint !== baseline.candidate_fingerprint) throw new Error("wrong captured compiler");
  const spec = applyJolt(developmentCases.find(e => e.case.metadata.id === sourceId)!.case.spec, benchmarkPolicy.transform.joltMs);
  const contract = buildAxisContract(spec, Object.keys(benchmarkPolicy.componentWeights) as any);
  const ctx = capture.context, originals = capture.snapshot.node.search.prefixFits;
  const startLines = capture.snapshot.node.startLines;
  if (lineKey([...startLines, ...originals.flatMap((f: any) => f?.lines ?? [])]) !== lineKey(track.lines)) throw new Error("incomplete geometry ownership");
  const originalScore = scoreV2Report(savedReport, spec.contacts.length, contract, suite);
  if (!originalScore.valid) throw new Error("invalid saved incumbent");
  const references: Array<ArrivalFrame | null> = [];
  const calibrationStart = getPhysicsFrameCount();
  try {
    let engine = freshEngine(track).addLine(startLines.map(createLineFromJson));
    originals.forEach((fit: any, i: number) => {
      references.push(fit === null ? null : frameAt(engine, ctx.gaps[i].endFrame));
      if (fit !== null) engine = engine.addLine(fit.lines.map(createLineFromJson));
    });
  } finally { disposeAllWasmEnginesForStudy(); }
  const calibrationFrames = getPhysicsFrameCount() - calibrationStart;

  function evaluate(controls: Array<-1 | 0 | 1>, mode: TransportMode): any {
    const frameStart = getPhysicsFrameCount();
    try {
      let engine = freshEngine(track).addLine(startLines.map(createLineFromJson));
      const fits: any[] = [], allLines = startLines.map((l: any) => ({ ...l }));
      let changed = false, movedCatches = 0;
      for (let i = 0; i < originals.length; i++) {
        const original = originals[i];
        if (original === null) { fits.push(null); continue; }
        changed ||= controls[i] !== 0;
        const actual = changed && mode !== "fixed" ? frameAt(engine, ctx.gaps[i].endFrame) : references[i]!;
        if (![actual.sledX, actual.sledY, actual.speed].every(Number.isFinite) ||
          Math.abs(actual.sledX) > 1e6 || Math.abs(actual.sledY) > 1e6) {
          return { score: null, reason: "arrival_outside_world", frames: getPhysicsFrameCount() - frameStart };
        }
        const transported = transportCatch(original.lines, references[i]!, actual, mode);
        if (lineKey(transported) !== lineKey(original.lines)) movedCatches++;
        const lines = setCatchEnergy(transported, actual.velocity, controls[i]);
        fits.push({ ...original, lines }); allLines.push(...lines);
        engine = engine.addLine(lines.map(createLineFromJson));
      }
      const det = detect(extractRawTrajectory(engine, ctx.durationFrames));
      const report = buildDriftReport(det, spec, ctx.gaps, ctx.allContactFrames, ctx.durationFrames,
        [], fits, ctx.gapAxisTargets);
      const score = scoreV2Report(report, spec.contacts.length, contract, suite);
      return { score, report, track: { ...track, lines: allLines }, movedCatches,
        activeLines: allLines.filter((l: any) => l.type === 1).length,
        frames: getPhysicsFrameCount() - frameStart };
    } finally { disposeAllWasmEnginesForStudy(); }
  }

  const zero: Array<-1 | 0 | 1> = originals.map(() => 0);
  const neutral = evaluate(zero, "similarity");
  if (!neutral.score?.valid || neutral.score.score !== originalScore.score || lineKey(neutral.track.lines) !== lineKey(track.lines) ||
      JSON.stringify(neutral.report.contacts) !== JSON.stringify(savedReport.contacts) ||
      JSON.stringify(neutral.report.gaps) !== JSON.stringify(savedReport.gaps)) throw new Error("neutral full-track replay mismatch");
  const anchors = savedReport.gaps.filter((g: any) => originals[g.gap_index]?.lines.some((l: any) => l.type !== 2))
    .map((g: any) => ({ index: g.gap_index, loss: Object.entries(g.axes).reduce((s, [axis, a]: [string, any]) =>
      s + ((benchmarkPolicy.componentWeights as any)[axis] ?? 0) * a.error * a.error, 0) }))
    .sort((a: any, b: any) => b.loss - a.loss || a.index - b.index).slice(0, plan.anchors).map((g: any) => g.index);
  const arms: any[] = [];
  for (const mode of plan.modes as TransportMode[]) {
    let best = neutral, controls = zero.slice(), frames = 0;
    const trials: any[] = [];
    for (let round = 0; round < plan.rounds; round++) for (const index of anchors) {
      for (const values of [[1], [-1], [1, -1], [-1, 1]] as Array<Array<-1 | 1>>) {
        if (index + values.length > originals.length || values.some((_, k) => originals[index + k] === null)) continue;
        const proposal = controls.slice(); values.forEach((v, k) => proposal[index + k] = v);
        if (proposal.every((v, i) => v === controls[i])) continue;
        const measured = evaluate(proposal, mode); frames += measured.frames;
        const accepted = measured.score?.valid && measured.score.score > best.score.score;
        trials.push({ round, index, values, score: measured.score?.score ?? 0,
          valid: measured.score?.valid ?? false, failures: measured.score?.hardFailures ?? [measured.reason],
          movedCatches: measured.movedCatches ?? null, frames: measured.frames, accepted: !!accepted });
        if (accepted) { best = measured; controls = proposal; }
      }
    }
    const check = evaluate(controls, mode); frames += check.frames;
    if (JSON.stringify(check.score) !== JSON.stringify(best.score) || lineKey(check.track.lines) !== lineKey(best.track.lines)) throw new Error("best track replay changed");
    write(resolve(out, `${sourceId}-${mode}.track.json`), best.track);
    write(resolve(out, `${sourceId}-${mode}.report.json`), best.report);
    const arm = { mode, score: best.score, delta: best.score.score - originalScore.score,
      controls, trials, frames, movedCatches: best.movedCatches, activeLines: best.activeLines,
      accepted: trials.filter(t => t.accepted).length, validTrials: trials.filter(t => t.valid).length };
    arms.push(arm);
    process.stderr.write(`${sourceId} ${mode}: ${arm.delta >= 0 ? "+" : ""}${arm.delta.toFixed(4)}, ${arm.accepted} accepted, ${arm.validTrials}/${trials.length} valid\n`);
  }
  write(resolve(out, `${sourceId}.json`), { schema: "line.whole-track-energy-source.v1", implementation, planSha256,
    sourceId, seed: capture.seed, originalScore, anchors, calibrationFrames, neutralFrames: neutral.frames,
    arms, elapsedMs: performance.now() - started });
}

const planPath = resolve(out, "plan.json");
if (process.argv.includes("--plan")) {
  if (existsSync(planPath)) throw new Error("plan exists");
  const requested = arg("sources")?.split(",");
  const members = developmentCases.filter(e => !requested || requested.includes(e.case.metadata.id));
  if (!members.length || (requested && members.length !== requested.length)) throw new Error("unknown sources");
  const sources = members.map(e => ({ sourceId: e.case.metadata.id,
    inputHashes: ["capture", "track", "report"].map(kind => {
      const p = resolve(input, `${e.case.metadata.id}.${kind}.json`); read(p); return hash(readFileSync(p));
    }) }));
  write(planPath, { schema: "line.whole-track-energy-plan.v1", implementation, engineHash,
    candidateFingerprint: baseline.candidate_fingerprint, suiteSha256: hash(readFileSync("benchmark/v2/compat/suite-manifest.json")),
    researchOnly: true, input, modes: ["fixed", "translate", "similarity"],
    anchors: Number(arg("anchors") ?? 16), rounds: Number(arg("rounds") ?? 1),
    law: "greedy full-valid-track improvement; native forward/braking material on one catch or opposing adjacent pair; exact causal downstream translation/similarity; saved incumbent retained",
    sources });
  console.log(JSON.stringify({ plannedSources: sources.length, planSha256: hash(readFileSync(planPath)) }));
} else {
  const plan = read(planPath), planSha256 = hash(readFileSync(planPath));
  if (plan.implementation !== implementation || plan.engineHash !== engineHash || plan.input !== input ||
      plan.suiteSha256 !== hash(readFileSync("benchmark/v2/compat/suite-manifest.json"))) throw new Error("frozen experiment changed");
  if (arg("worker")) worker(plan.sources.find((s: any) => s.sourceId === arg("worker")), plan, planSha256);
  else {
    const queue = plan.sources.filter((s: any) => {
      const p = resolve(out, `${s.sourceId}.json`);
      if (!existsSync(p)) return true;
      if (read(p).planSha256 !== planSha256) throw new Error("checkpoint identity mismatch");
      return false;
    });
    const jobs = Number(arg("jobs") ?? 8), failures: string[] = [];
    if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error("invalid jobs");
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      while (queue.length) {
        const s = queue.shift()!;
        const code = await new Promise<number | null>((done, reject) => {
          const child = spawn(process.execPath, ["--import", "tsx", script, `--worker=${s.sourceId}`, `--input=${input}`, `--out=${out}`],
            { env: process.env, stdio: ["ignore", "ignore", "inherit"] });
          child.on("error", reject); child.on("exit", done);
        });
        if (code !== 0) failures.push(s.sourceId);
      }
    }));
    if (failures.length) throw new Error(`failed workers: ${failures.join(", ")}`);
    const sources = plan.sources.map((s: any) => read(resolve(out, `${s.sourceId}.json`)));
    const aggregate = (mode: string | null) => sources.length === 44 ? summarizeDevelopmentBudget(sources.map((s: any) => ({
      sourceId: s.sourceId, budget: 750000, seedSlot: 0, actualSeed: s.seed,
      score: mode === null ? s.originalScore : s.arms.find((a: any) => a.mode === mode).score,
    })), 750000, suite) : null;
    const summary = { schema: "line.whole-track-energy-summary.v1", planSha256, implementation, researchOnly: true,
      sources: sources.length, baseline: aggregate(null),
      arms: plan.modes.map((mode: string) => {
        const arms = sources.map((s: any) => s.arms.find((a: any) => a.mode === mode));
        return { mode, positiveSources: arms.filter((a: any) => a.delta > 0).length,
          meanDelta: arms.reduce((s: number, a: any) => s + a.delta, 0) / arms.length,
          maxDelta: Math.max(...arms.map((a: any) => a.delta)),
          frames: arms.reduce((s: number, a: any) => s + a.frames, 0), aggregate: aggregate(mode) };
      }),
      calibrationFrames: sources.reduce((s: number, r: any) => s + r.calibrationFrames, 0),
      neutralFrames: sources.reduce((s: number, r: any) => s + r.neutralFrames, 0),
      workerMs: sources.reduce((s: number, r: any) => s + r.elapsedMs, 0) };
    write(resolve(out, "summary.json"), summary);
    console.log(JSON.stringify(summary));
  }
}
