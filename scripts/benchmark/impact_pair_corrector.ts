/** Precision-controlled correction of the frozen small pair responses.
 * No new impact request, geometry basis, compiler search, or scored line search.
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
const out = resolve("generated/benchmark-v2/impact-delivery-650-new/contact-pair-corrector");
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
    const response = parent.states.find((s: any) => s.gapIndex === selection.gapIndex);
    if (!selection.eligible || !response.arms?.some((a: any) => a.controls)) {
      return { gapIndex: selection.gapIndex, available: false, reason: "no_frozen_response", arms: [] };
    }
    const base = probe(track, selection);
    if (!base.compatible) throw new Error("baseline contact pair mismatch");
    const arms = response.arms.filter((a: any) => a.controls).map((parentArm: any) => {
      const armFrameStart = getPhysicsFrameCount();
      let probeCalls = 0;
      const measured = (u: number[]) => { probeCalls++; return probe(deform(track, selection, u), selection); };
      const compatible = (p: any) => p.compatible && p.prefix === base.prefix;
      const request = parentArm.predictedRawGain / selection.speed;
      const residual = (p: any) => sub(p.features, base.features).map((v, i) => v / selection.speed - (i === 0 ? request : 0));
      let controls: number[] = parentArm.controls.slice(), current = measured(controls), error = residual(current);
      const initial = current, initialError = error.slice();
      const indices = response.columns.filter((c: any) => c.eligible && (parentArm.name === "contact_pair" || c.first)).map((c: any) => c.index);
      const iterations: any[] = [];
      let accepted = 0, reason = "iteration_cap";
      for (let iteration = 0; iteration < plan.law.maximumCorrections; iteration++) {
        if (!compatible(current)) { reason = "initial_incompatibility"; break; }
        if (norm(error.slice(1)) <= plan.law.constraintTolerance && Math.abs(error[0]) <= Math.max(1e-9, 0.01 * request)) {
          reason = "residual_tolerance"; break;
        }
        const columns = indices.map((index: number) => {
          const stencil = [1e-5, -1e-5, 5e-6, -5e-6].map(step => {
            const u = controls.slice(); u[index] += step; return measured(u);
          });
          if (stencil.some(p => !compatible(p))) return { index, eligible: false, reason: "probe_incompatibility" };
          const broad = sub(stencil[0].features, stencil[1].features).map(v => v / (2e-5 * selection.speed));
          const fine = sub(stencil[2].features, stencil[3].features).map(v => v / (1e-5 * selection.speed));
          const disagreement = norm(sub(broad, fine)) / Math.max(norm(fine), 1e-8);
          const impulseDisagreement = Math.abs(broad[0] - fine[0]) / Math.max(Math.abs(fine[0]), 1e-8);
          const eligible = Math.max(disagreement, impulseDisagreement) <= 0.01 && norm(fine) > 1e-9;
          return { index, eligible, disagreement, impulseDisagreement,
            derivative: fine.map((v, i) => (4 * v - broad[i]) / 3) };
        });
        const stable = columns.filter((c: any) => c.eligible);
        const detail: any = { iteration, beforeConstraintL2: norm(error.slice(1)), columns };
        iterations.push(detail);
        if (!stable.length) { reason = "no_precise_columns"; break; }
        const solution = JSON.parse(execFileSync("python", [solver], {
          input: JSON.stringify({ gradient: stable.map((c: any) => c.derivative[0]),
            jacobian: Array.from({ length: 61 }, (_, i) => stable.map((c: any) => c.derivative[i + 1])),
            residual: error.slice(1), impact_correction: -error[0] }), encoding: "utf8",
          env: { ...process.env, OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1" },
        }));
        detail.solution = solution;
        if (!solution.step) { reason = solution.reason; break; }
        const delta = Array(controls.length).fill(0); stable.forEach((c: any, i: number) => delta[c.index] = solution.step[i]);
        const proposed = controls.map((v, i) => v + delta[i]);
        if (Math.max(...delta.map(Math.abs)) > 0.001 || Math.max(...proposed.map(Math.abs)) > 0.002) {
          reason = "trust_region_exceeded"; break;
        }
        const predicted = Array.from({ length: 62 }, (_, i) => stable.reduce((sum: number, c: any) => sum + c.derivative[i] * delta[c.index], 0));
        const plus = measured(controls.map((v, i) => v + 0.01 * delta[i]));
        const minus = measured(controls.map((v, i) => v - 0.01 * delta[i]));
        const direction = sub(plus.features, minus.features).map(v => v / (0.02 * selection.speed));
        detail.directionErrorL2 = norm(sub(direction, predicted));
        detail.directionTolerance = Math.max(1e-8, 0.01 * norm(predicted));
        if (!compatible(plus) || !compatible(minus) || detail.directionErrorL2 > detail.directionTolerance) {
          reason = "directional_precision_failed"; break;
        }
        const next = measured(proposed), nextError = residual(next);
        detail.afterConstraintL2 = norm(nextError.slice(1)); detail.afterImpactError = nextError[0];
        detail.compatible = compatible(next);
        detail.accepted = detail.compatible && detail.afterConstraintL2 <= 0.9 * detail.beforeConstraintL2 &&
          Math.abs(nextError[0]) <= Math.max(1e-9, 0.01 * request) && norm(nextError) < norm(error);
        if (!detail.accepted) { reason = "actual_residual_failed"; break; }
        controls = proposed; current = next; error = nextError; accepted++;
      }
      const changed = deform(track, selection, controls), full = scoreTrack(changed, record);
      const correctionFrames = getPhysicsFrameCount() - armFrameStart;
      // The sham consumes exactly the same number of local/full replays but
      // retains the original command throughout. No unchanged fallback counts
      // as a correction success, and frame equality is asserted, not inferred.
      const shamStart = getPhysicsFrameCount(), initialTrack = deform(track, selection, parentArm.controls);
      for (let i = 0; i < probeCalls; i++) {
        const sham = probe(initialTrack, selection);
        if (JSON.stringify(sham) !== JSON.stringify(initial)) throw new Error("sham response changed");
      }
      const shamFull = scoreTrack(initialTrack, record), shamFrames = getPhysicsFrameCount() - shamStart;
      if (correctionFrames !== shamFrames || shamFull.valid !== parentArm.valid ||
          Math.abs(shamFull.score - baselineScore.score - parentArm.scoreDelta) > 1e-9) throw new Error("same-cost parent replay mismatch");
      const gainFraction = (current.features[0] - base.features[0]) / (selection.speed * request);
      const result = { name: parentArm.name, controls, request, available: true, accepted, reason, iterations,
        compatible: compatible(current), rawImpulseGain: current.features[0] - base.features[0], gainFraction,
        initialConstraintL2: norm(initialError.slice(1)), constraintL2: norm(error.slice(1)),
        reductionRatio: norm(error.slice(1)) / Math.max(norm(initialError.slice(1)), 1e-15),
        valid: full.valid, scoreDelta: full.score - baselineScore.score, missing: full.missing, offBeat: full.offBeat,
        currentAxes: full.gaps.find((g: any) => g.gapIndex === selection.gapIndex)?.axes,
        nextAxes: full.gaps.find((g: any) => g.gapIndex === selection.second.gapIndex)?.axes,
        sham: { valid: shamFull.valid, scoreDelta: parentArm.scoreDelta, compatible: compatible(initial),
          rawImpulseGain: initial.features[0] - base.features[0], frames: shamFrames },
        probeCalls, correctionFrames };
      if (accepted > 0 && result.compatible && full.valid && gainFraction >= 0.99 && result.scoreDelta > 0) {
        write(resolve(out, `${source.sourceId}-g${selection.gapIndex}-${parentArm.name}.track.json`), changed);
      }
      return result;
    });
    return { gapIndex: selection.gapIndex, available: true, arms };
  });
  write(resolve(out, `${source.sourceId}.json`), { schema: "line.impact-pair-corrector.v1", implementation,
    planSha256: hash(readFileSync(resolve(out, "plan.json"))), sourceId: source.sourceId, baselineAxesExact: true,
    baselineScore: baselineScore.score, states, physicsFrames: getPhysicsFrameCount() - frameStart, elapsedMs: performance.now() - started });
}

if (process.argv.includes("--plan")) {
  const path = resolve(out, "plan.json");
  if (existsSync(path)) throw new Error("frozen corrector plan already exists");
  const sources = parentPlan.sources.map((s: any) => ({ ...s, parentRecordSha256: hash(readFileSync(resolve(root, `${s.sourceId}.json`))) }));
  const plan = { schema: "line.impact-pair-corrector-plan.v1", implementation, parentPlanSha256, sources,
    law: { maximumCorrections: 4, finiteDifferenceSteps: [1e-5, 5e-6], richardson: true,
      maximumDerivativeDisagreement: 0.01, directionalStepFraction: 0.01,
      maximumStep: 0.001, maximumTotalControl: 0.002, ridge: 1e-6, constraintTolerance: 1e-7,
      actualAcceptance: "prefix/contact compatible, at least 10% constraint reduction, impact request within 1%, lower total residual",
      control: "unchanged parent command, identical local/full replay count and asserted identical frames",
      componentGate: "at least half of paired directions reduce constraint tenfold with >=99% impact retention; more positive valid complete tracks than sham",
      arms: ["first_surface", "contact_pair"] } };
  write(path, plan); console.log(JSON.stringify({ sources: sources.length, selections: sources.reduce((n: number, s: any) => n + s.selections.length, 0),
    planSha256: hash(readFileSync(path)) }));
} else {
  const plan = read(resolve(out, "plan.json")), planSha256 = hash(readFileSync(resolve(out, "plan.json")));
  if (plan.implementation !== implementation || plan.parentPlanSha256 !== parentPlanSha256) throw new Error("frozen corrector changed");
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
    const summary = { schema: "line.impact-pair-corrector-summary.v1", implementation, planSha256,
      sources: results.length, selections: states.length, available: states.filter((s: any) => s.available).length,
      baselineAxesExact: results.every((r: any) => r.baselineAxesExact),
      physicsFrames: results.reduce((s: number, r: any) => s + r.physicsFrames, 0),
      workerSeconds: results.reduce((s: number, r: any) => s + r.elapsedMs / 1000, 0),
      arms: Object.fromEntries(plan.law.arms.map((name: string) => {
        const arms = states.flatMap((s: any) => s.arms.filter((a: any) => a.name === name));
        const corrected = arms.filter((a: any) => a.accepted > 0 && a.compatible && a.gainFraction >= 0.99);
        const tenfold = corrected.filter((a: any) => a.reductionRatio <= 0.1);
        const good = corrected.filter((a: any) => a.valid && a.scoreDelta > 0);
        const shamGood = arms.filter((a: any) => a.sham.compatible && a.sham.valid && a.sham.rawImpulseGain > 0 && a.sham.scoreDelta > 0);
        return [name, { attempted: arms.length, changed: corrected.length, tenfold: tenfold.length,
          toleranceMet: corrected.filter((a: any) => a.constraintL2 <= plan.law.constraintTolerance).length,
          validComplete: arms.filter((a: any) => a.compatible && a.valid).length, positiveChangedComplete: good.length,
          shamPositiveComplete: shamGood.length, componentGate: tenfold.length >= arms.length / 2 && good.length > shamGood.length,
          medianReductionRatio: median(arms.map((a: any) => a.reductionRatio)),
          medianConstraintL2: median(arms.map((a: any) => a.constraintL2)),
          maximumPositiveChangedGain: Math.max(0, ...good.map((a: any) => a.scoreDelta)),
          sameCost: arms.every((a: any) => a.correctionFrames === a.sham.frames) }];
      })) };
    write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
  }
}
