/** Frozen bounded continuation toward a useful authored impact request.
 * Exact saved geometry, precision-checked local physics, and one terminal score.
 */
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { detect, extractRawTrajectory, getPhysicsFrameCount } from "../lib/detector.ts";
import { contactRedirArcPxAtLanding, findAuthoredContactNearFrame } from "../v0/core/substrate.ts";
import { read, write, scoreTrack, deform, state, buildEngine } from "./impact_release_response.ts";

const root = resolve("generated/benchmark-v2/impact-delivery-650-new/contact-pair-response");
const input = resolve("generated/benchmark-v2/impact-delivery-650-new/selected-fit-trace");
const out = resolve("generated/benchmark-v2/impact-delivery-650-new/contact-pair-continuation");
const script = fileURLToPath(import.meta.url), solver = resolve("scripts/benchmark/impact_pair_corrector_solve.py");
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const implementation = [script, solver, "scripts/benchmark/impact_release_response.ts"].map(p => hash(readFileSync(p))).join(":");
const parentPlan = read(resolve(root, "plan.json")), parentPlanSha256 = hash(readFileSync(resolve(root, "plan.json")));
const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const norm = (xs: number[]) => Math.hypot(...xs);
const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
const median = (xs: number[]) => xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null;
mkdirSync(out, { recursive: true });

function probe(track: any, selection: any): any {
  try {
    const engine = buildEngine(track), prefix = state(engine, selection.impactFrame - 1);
    const det = detect(extractRawTrajectory(engine, selection.releaseFrame)), release = state(engine, selection.releaseFrame);
    const contacts = [selection, selection.second].map(s =>
      findAuthoredContactNearFrame(det, s.targetFrame, 1, s.gapFrames)?.frame === s.impactFrame);
    const impulses = [selection, selection.second].map(s => contactRedirArcPxAtLanding(det, s.impactFrame));
    return { prefix: prefix.key, compatible: release.intact && contacts.every(Boolean) && impulses.every(x => x !== null),
      features: [impulses[0], ...release.values, impulses[1]] };
  } finally { disposeAllWasmEnginesForStudy(); }
}

function runSource(plan: any, source: any): void {
  const started = performance.now(), frameStart = getPhysicsFrameCount();
  const recordPath = resolve(input, `${source.sourceId}.json`), trackPath = resolve(input, `${source.sourceId}.track.json`);
  const parentPath = resolve(root, `${source.sourceId}.json`), parent = read(parentPath);
  const record = read(recordPath), track = read(trackPath);
  if (hash(readFileSync(recordPath)) !== source.recordSha256 || hash(readFileSync(trackPath)) !== source.trackSha256 ||
      hash(readFileSync(parentPath)) !== source.parentRecordSha256 || parent.implementation !== parentPlan.implementation ||
      parent.planSha256 !== parentPlanSha256) throw new Error("frozen source changed");
  const baselineScore = scoreTrack(track, record);
  if (!baselineScore.valid || Math.abs(baselineScore.score - record.score) > 1e-9) throw new Error("baseline score mismatch");
  for (const row of record.rows) {
    const replay = baselineScore.gaps.find((g: any) => g.gapIndex === row.gapIndex);
    for (const [axis, value] of Object.entries(row.finalAxes) as Array<[string, any]>) {
      if (replay?.axes[axis]?.achieved !== value.achieved) throw new Error("baseline axis mismatch");
    }
  }
  const states = source.selections.map((selection: any) => {
    const parentState = parent.states.find((s: any) => s.gapIndex === selection.gapIndex);
    if (!selection.eligible || !parentState.arms?.some((a: any) => a.name === "contact_pair" && a.controls)) {
      return { gapIndex: selection.gapIndex, available: false, reason: "no_frozen_response" };
    }
    const indices = parentState.columns.filter((c: any) => c.eligible).map((c: any) => c.index);
    const pathFrameStart = getPhysicsFrameCount();
    let probeCalls = 0;
    const sample = (u: number[]) => { probeCalls++; return probe(deform(track, selection, u), selection); };
    let controls = Array(selection.coordinates.length).fill(0), current = sample(controls);
    const base = current, request = selection.requestedRawGain / selection.speed;
    if (!base.compatible) throw new Error("baseline pair mismatch");
    const compatible = (p: any) => p.compatible && p.prefix === base.prefix;
    const movement = (p: any) => sub(p.features, base.features).map(v => v / selection.speed);
    const residual = (p: any, target: number) => movement(p).map((v, i) => v - (i === 0 ? target : 0));
    function linearize(u: number[], p: any, target: number): any {
      const columns = indices.map((index: number) => {
        const stencil = [1e-5, -1e-5, 5e-6, -5e-6].map(step => {
          const v = u.slice(); v[index] += step; return sample(v);
        });
        if (stencil.some(v => !compatible(v))) return { index, eligible: false, reason: "probe_incompatibility" };
        const broad = sub(stencil[0].features, stencil[1].features).map(v => v / (2e-5 * selection.speed));
        const fine = sub(stencil[2].features, stencil[3].features).map(v => v / (1e-5 * selection.speed));
        const disagreement = norm(sub(broad, fine)) / Math.max(norm(fine), 1e-8);
        const impulseDisagreement = Math.abs(broad[0] - fine[0]) / Math.max(Math.abs(fine[0]), 1e-8);
        return { index, eligible: Math.max(disagreement, impulseDisagreement) <= 0.01 && norm(fine) > 1e-9,
          disagreement, impulseDisagreement, derivative: fine.map((v, i) => (4 * v - broad[i]) / 3) };
      });
      const stable = columns.filter((c: any) => c.eligible), error = residual(p, target);
      if (!stable.length) return { columns, reason: "no_precise_columns" };
      const solution = JSON.parse(execFileSync("python", [solver], {
        input: JSON.stringify({ gradient: stable.map((c: any) => c.derivative[0]),
          jacobian: Array.from({ length: 61 }, (_, i) => stable.map((c: any) => c.derivative[i + 1])),
          residual: error.slice(1), impact_correction: -error[0] }), encoding: "utf8",
        env: { ...process.env, OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1" },
      }));
      if (!solution.step) return { columns, reason: solution.reason };
      const delta = Array(u.length).fill(0); stable.forEach((c: any, i: number) => delta[c.index] = solution.step[i]);
      return { columns, delta, solution };
    }
    function inspectDirection(u: number[], delta: number[], columns: any[]): any {
      const predicted = Array.from({ length: 62 }, (_, i) => columns.filter(c => c.eligible)
        .reduce((sum, c) => sum + c.derivative[i] * delta[c.index], 0));
      const plus = sample(u.map((v, i) => v + 0.01 * delta[i])), minus = sample(u.map((v, i) => v - 0.01 * delta[i]));
      const measured = sub(plus.features, minus.features).map(v => v / (0.02 * selection.speed));
      const errorL2 = norm(sub(measured, predicted)), tolerance = Math.max(1e-8, 0.01 * norm(predicted));
      return { predicted, errorL2, tolerance, passed: compatible(plus) && compatible(minus) && errorL2 <= tolerance };
    }
    let radius = 0.001, acceptedStages = 0, reason = "stage_cap";
    const stages: any[] = [];
    for (let stage = 0; stage < plan.law.maximumStages; stage++) {
      if (movement(current)[0] >= 0.99 * request) { reason = "request_reached"; break; }
      const predictor = linearize(controls, current, request), detail: any = { stage, radius, predictor, corrections: [] };
      stages.push(detail);
      if (!predictor.delta) { reason = predictor.reason; break; }
      let scale = Math.min(1, radius / Math.max(...predictor.delta.map(Math.abs), 1e-15));
      for (let i = 0; i < controls.length; i++) {
        const d = predictor.delta[i];
        if (d > 0) scale = Math.min(scale, (0.1 - controls[i]) / d);
        if (d < 0) scale = Math.min(scale, (-0.1 - controls[i]) / d);
      }
      const delta: number[] = predictor.delta.map((v: number) => v * Math.max(0, scale));
      const direction = inspectDirection(controls, delta, predictor.columns); detail.direction = direction; detail.scale = scale;
      if (!direction.passed) { reason = "predictor_precision_failed"; break; }
      if (direction.predicted[0] <= 1e-12) { reason = "no_positive_predictor"; break; }
      const target = Math.min(request, movement(current)[0] + direction.predicted[0]);
      let trialControls = controls.map((v, i) => v + delta[i]), trial = sample(trialControls), error = residual(trial, target);
      const initialConstraint = norm(error.slice(1)), threshold = Math.max(1e-7, 0.1 * initialConstraint);
      detail.target = target; detail.initialConstraintL2 = initialConstraint; detail.constraintThreshold = threshold;
      const acceptable = () => compatible(trial) && norm(error.slice(1)) <= threshold && Math.abs(error[0]) <= Math.max(1e-9, 0.01 * target);
      let correctionNorm = 0;
      for (let k = 0; k < plan.law.maximumCorrections && !acceptable(); k++) {
        if (!compatible(trial)) { detail.failure = "predictor_incompatibility"; break; }
        const correction = linearize(trialControls, trial, target); detail.corrections.push(correction);
        if (!correction.delta) { detail.failure = correction.reason; break; }
        const proposed = trialControls.map((v, i) => v + correction.delta[i]);
        if (Math.max(...correction.delta.map(Math.abs)) > radius || Math.max(...proposed.map(Math.abs)) > 0.1 + 1e-12) {
          detail.failure = "corrector_trust_region"; break;
        }
        const checked = inspectDirection(trialControls, correction.delta, correction.columns); correction.direction = checked;
        if (!checked.passed) { detail.failure = "corrector_precision_failed"; break; }
        const next = sample(proposed), nextError = residual(next, target);
        correction.beforeConstraintL2 = norm(error.slice(1)); correction.afterConstraintL2 = norm(nextError.slice(1));
        correction.afterImpactError = nextError[0];
        correction.accepted = compatible(next) && norm(nextError.slice(1)) <= 0.9 * norm(error.slice(1)) &&
          Math.abs(nextError[0]) <= Math.max(1e-9, 0.01 * target) && norm(nextError) < norm(error);
        if (!correction.accepted) { detail.failure = "corrector_actual_residual"; break; }
        correctionNorm += norm(correction.delta); trialControls = proposed; trial = next; error = nextError;
      }
      detail.finalConstraintL2 = norm(error.slice(1)); detail.impactError = error[0]; detail.accepted = acceptable();
      if (!detail.accepted) { reason = detail.failure ?? "stage_residual_not_met"; break; }
      controls = trialControls; current = trial; acceptedStages++;
      detail.correctionToPredictorRatio = correctionNorm / Math.max(norm(delta), 1e-15);
      if (detail.corrections.length <= 2 && correctionNorm <= 0.25 * norm(delta)) radius = Math.min(0.1, radius * 2);
    }
    const changed = deform(track, selection, controls), full = scoreTrack(changed, record);
    const pathFrames = getPhysicsFrameCount() - pathFrameStart, shamStart = getPhysicsFrameCount();
    for (let i = 0; i < probeCalls; i++) {
      if (JSON.stringify(probe(track, selection)) !== JSON.stringify(base)) throw new Error("sham response changed");
    }
    const sham = scoreTrack(track, record), shamFrames = getPhysicsFrameCount() - shamStart;
    if (shamFrames !== pathFrames || !sham.valid || Math.abs(sham.score - baselineScore.score) > 1e-9) throw new Error("same-cost sham mismatch");
    const gainFraction = movement(current)[0] / request;
    const success = acceptedStages > 0 && compatible(current) && gainFraction >= 0.9 && full.valid && full.score > baselineScore.score;
    const result = { gapIndex: selection.gapIndex, available: true, controls, request, acceptedStages, reason, stages,
      compatible: compatible(current), rawImpulseGain: current.features[0] - base.features[0], gainFraction,
      constraintL2: norm(movement(current).slice(1)), valid: full.valid, scoreDelta: full.score - baselineScore.score,
      missing: full.missing, offBeat: full.offBeat, success,
      currentAxes: full.gaps.find((g: any) => g.gapIndex === selection.gapIndex)?.axes,
      nextAxes: full.gaps.find((g: any) => g.gapIndex === selection.second.gapIndex)?.axes,
      probeCalls, pathFrames, shamFrames };
    if (acceptedStages > 0 && compatible(current) && full.valid && full.score > baselineScore.score) {
      write(resolve(out, `${source.sourceId}-g${selection.gapIndex}.track.json`), changed);
    }
    return result;
  });
  write(resolve(out, `${source.sourceId}.json`), { schema: "line.impact-pair-continuation.v1", implementation,
    planSha256: hash(readFileSync(resolve(out, "plan.json"))), sourceId: source.sourceId, baselineAxesExact: true,
    baselineScore: baselineScore.score, states, physicsFrames: getPhysicsFrameCount() - frameStart, elapsedMs: performance.now() - started });
}

if (process.argv.includes("--plan")) {
  const path = resolve(out, "plan.json");
  if (existsSync(path)) throw new Error("frozen continuation plan already exists");
  const sources = parentPlan.sources.map((s: any) => ({ ...s, parentRecordSha256: hash(readFileSync(resolve(root, `${s.sourceId}.json`))) }));
  const plan = { schema: "line.impact-pair-continuation-plan.v1", implementation, parentPlanSha256, sources,
    law: { maximumStages: 12, maximumCorrections: 4, finiteDifferenceSteps: [1e-5, 5e-6], richardson: true,
      initialRadius: 0.001, maximumRadius: 0.1, radiusGrowth: 2, maximumTotalControl: 0.1, ridge: 1e-6,
      stageAcceptance: "prefix/contact compatible, predictor constraint reduced tenfold or <=1e-7, impact within 1%",
      radiusGrowthGate: "at most 2 corrections with total norm <=25% of predictor norm", retries: 0,
      control: "unchanged baseline, identical local/full replay count and asserted identical frames",
      usefulGainGate: "at least half of 78 available paths reach >=90% of the 25% deficit request with a positive valid complete score" } };
  write(path, plan); console.log(JSON.stringify({ sources: sources.length, selections: sources.reduce((n: number, s: any) => n + s.selections.length, 0),
    planSha256: hash(readFileSync(path)) }));
} else {
  const plan = read(resolve(out, "plan.json")), planSha256 = hash(readFileSync(resolve(out, "plan.json")));
  if (plan.implementation !== implementation || plan.parentPlanSha256 !== parentPlanSha256) throw new Error("frozen continuation changed");
  const worker = arg("worker");
  if (worker) {
    const source = plan.sources.find((s: any) => s.sourceId === worker);
    if (!source) throw new Error("unknown source");
    runSource(plan, source);
  } else {
    const jobs = Number(arg("jobs") ?? "8");
    if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) throw new Error("invalid jobs");
    const queue = plan.sources.filter((s: any) => {
      const path = resolve(out, `${s.sourceId}.json`);
      if (!existsSync(path)) return true;
      const old = read(path);
      if (old.implementation !== implementation || old.planSha256 !== planSha256) throw new Error("incompatible checkpoint");
      return false;
    });
    const failures: string[] = [];
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      while (queue.length) {
        const source = queue.shift();
        const code = await new Promise<number | null>((done, reject) => {
          const child = spawn(process.execPath, ["--import", "tsx", script, `--worker=${source.sourceId}`], { stdio: ["ignore", "ignore", "inherit"] });
          child.on("error", reject); child.on("exit", done);
        });
        if (code !== 0) failures.push(`${source.sourceId}: ${code}`);
        else process.stderr.write(`${source.sourceId}: complete\n`);
      }
    }));
    if (failures.length) throw new Error(failures.join("\n"));
    const results = plan.sources.map((s: any) => read(resolve(out, `${s.sourceId}.json`))), states = results.flatMap((r: any) => r.states);
    const available = states.filter((s: any) => s.available), changed = available.filter((s: any) => s.acceptedStages > 0);
    const good = changed.filter((s: any) => s.compatible && s.valid && s.scoreDelta > 0);
    const summary = { schema: "line.impact-pair-continuation-summary.v1", implementation, planSha256,
      sources: results.length, selections: states.length, available: available.length, changed: changed.length,
      usefulGainSuccesses: available.filter((s: any) => s.success).length,
      usefulGainGate: available.filter((s: any) => s.success).length >= available.length / 2,
      validChangedComplete: changed.filter((s: any) => s.compatible && s.valid).length, positiveChangedComplete: good.length,
      medianRequestFraction: median(available.map((s: any) => s.gainFraction)), maximumRequestFraction: Math.max(...available.map((s: any) => s.gainFraction)),
      maximumPositiveChangedGain: Math.max(0, ...good.map((s: any) => s.scoreDelta)),
      baselineAxesExact: results.every((r: any) => r.baselineAxesExact), sameCost: available.every((s: any) => s.pathFrames === s.shamFrames),
      physicsFrames: results.reduce((s: number, r: any) => s + r.physicsFrames, 0),
      workerSeconds: results.reduce((s: number, r: any) => s + r.elapsedMs / 1000, 0) };
    write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
  }
}
