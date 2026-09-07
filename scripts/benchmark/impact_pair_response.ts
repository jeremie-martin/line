/** Bounded saved-track assay: can the next authored surface compensate?
 * The earlier 88 selections are fixed. Both arms observe the same complete
 * downstream packet and protect the following impact; no compiler search.
 */
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { detect, extractRawTrajectory, getPhysicsFrameCount } from "../lib/detector.ts";
import { contactRedirArcPxAtLanding, findAuthoredContactNearFrame } from "../v0/core/substrate.ts";
import { IMPACT_WINDOW } from "../v0/types.ts";
import { read, write, scoreTrack, deform, geometry, state, buildEngine } from "./impact_release_response.ts";

const arg = (key: string) => process.argv.slice(2).find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const input = resolve("generated/benchmark-v2/impact-delivery-650-new/selected-fit-trace");
const parentPath = resolve("generated/benchmark-v2/impact-delivery-650-new/release-response/plan.json");
const out = resolve("generated/benchmark-v2/impact-delivery-650-new/contact-pair-response");
const script = fileURLToPath(import.meta.url);
const solver = resolve("scripts/benchmark/impact_pair_solve.py");
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const implementation = [script, solver, "scripts/benchmark/impact_release_response.ts",
  "scripts/benchmark/impact_release_solve.py"].map(p => hash(readFileSync(p))).join(":");
const parent = read(parentPath), parentPlanSha256 = hash(readFileSync(parentPath));
const norm = (xs: number[]) => Math.hypot(...xs);
const median = (xs: number[]) => xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null;
mkdirSync(out, { recursive: true });

function makePlan(): any {
  const sources = parent.sources.map((source: any) => {
    const record = read(resolve(input, `${source.sourceId}.json`));
    const track = read(resolve(input, `${source.sourceId}.track.json`));
    const selections = source.selected.map((selection: any) => {
      const next = record.rows.find((r: any) => r.gapIndex === selection.gapIndex + 1);
      if (!next || next.actualFrame === null || !next.geometryMatches || next.nextGapFrames === null) {
        return { gapIndex: selection.gapIndex, eligible: false, reason: "next_contact_unavailable" };
      }
      const releaseFrame = Math.min(next.actualFrame + 12, next.targetFrame + next.nextGapFrames - 2);
      if (releaseFrame <= next.actualFrame + IMPACT_WINDOW) {
        return { gapIndex: selection.gapIndex, eligible: false, reason: "insufficient_release_window" };
      }
      const nextCoordinates = geometry(track, next);
      const coordinates = selection.coordinates.map((c: any) => ({ ...c, first: true }));
      for (const c of nextCoordinates) {
        if (!coordinates.some((v: any) => v.left === c.left && v.right === c.right)) coordinates.push({ ...c, first: false });
      }
      if (!coordinates.some((c: any) => !c.first)) {
        return { gapIndex: selection.gapIndex, eligible: false, reason: "no_additional_next_surface_coordinates" };
      }
      return { ...selection, coordinates, eligible: true, releaseFrame,
        second: { gapIndex: next.gapIndex, impactFrame: next.actualFrame, targetFrame: next.targetFrame,
          gapFrames: next.gapFrames, rawImpulse: next.rawImpulse } };
    });
    return { sourceId: source.sourceId, recordSha256: source.recordSha256, trackSha256: source.trackSha256, selections };
  });
  return { schema: "line.impact-pair-response-plan.v1", implementation, parentPlanSha256,
    engineHash: parent.engineHash, candidateFingerprint: parent.candidateFingerprint, input,
    law: { finiteDifferenceSteps: [0.001, 0.0005], maximumRelativeDerivativeDisagreement: 0.25,
      maximumVertexDisplacementInSpeedFrames: 0.001, releaseRidge: 1e-6,
      constraint: "60 downstream packet components plus next raw impulse, divided by first incoming speed",
      comparison: "same horizon, same first impulse request, reduced to common trust-limited linear gain",
      arms: ["first_surface", "contact_pair"], iterations: 1 }, sources };
}

function probe(track: any, selection: any): any {
  try {
    const engine = buildEngine(track), prefix = state(engine, selection.impactFrame - 1);
    const det = detect(extractRawTrajectory(engine, selection.releaseFrame));
    const release = state(engine, selection.releaseFrame);
    const contacts = [selection, selection.second].map(s =>
      findAuthoredContactNearFrame(det, s.targetFrame, 1, s.gapFrames)?.frame === s.impactFrame);
    return { prefix: prefix.key, release: release.values, intact: release.intact, contacts,
      impulse: contactRedirArcPxAtLanding(det, selection.impactFrame),
      secondImpulse: contactRedirArcPxAtLanding(det, selection.second.impactFrame) };
  } finally { disposeAllWasmEnginesForStudy(); }
}

function runSource(plan: any, source: any): void {
  const started = performance.now(), frameStart = getPhysicsFrameCount();
  const recordPath = resolve(input, `${source.sourceId}.json`), trackPath = resolve(input, `${source.sourceId}.track.json`);
  const record = read(recordPath), track = read(trackPath);
  if (hash(readFileSync(recordPath)) !== source.recordSha256 || hash(readFileSync(trackPath)) !== source.trackSha256) throw new Error("input changed");
  const baseline = scoreTrack(track, record);
  if (!baseline.valid || Math.abs(baseline.score - record.score) > 1e-9) throw new Error("baseline score mismatch");
  for (const row of record.rows) {
    const replay = baseline.gaps.find((g: any) => g.gapIndex === row.gapIndex);
    for (const [axis, value] of Object.entries(row.finalAxes) as Array<[string, any]>) {
      if (replay?.axes[axis]?.achieved !== value.achieved) throw new Error("baseline axis mismatch");
    }
  }
  const states = source.selections.map((selection: any) => {
    if (!selection.eligible) return selection;
    const zero = Array(selection.coordinates.length).fill(0), base = probe(track, selection);
    const row = record.rows.find((r: any) => r.gapIndex === selection.gapIndex);
    if (JSON.stringify(deform(track, selection, zero)) !== JSON.stringify(track) || !base.intact ||
        !base.contacts.every(Boolean) || Math.abs(base.impulse - row.rawImpulse) > 1e-9 ||
        Math.abs(base.secondImpulse - selection.second.rawImpulse) > 1e-9) throw new Error("baseline pair mismatch");
    const columns = selection.coordinates.map((coordinate: any, index: number) => {
      const stencil = [0.001, -0.001, 0.0005, -0.0005].map(step => {
        const u = zero.slice(); u[index] = step;
        return probe(deform(track, selection, u), selection);
      });
      if (stencil.some(p => !p.intact || !p.contacts.every(Boolean) || p.prefix !== base.prefix ||
          p.impulse === null || p.secondImpulse === null)) {
        return { index, first: coordinate.first, eligible: false, reason: "contact_or_prefix_changed" };
      }
      const derivative = (p: any, m: any, span: number) => [
        (p.impulse - m.impulse) / (span * selection.speed),
        ...p.release.map((v: number, i: number) => (v - m.release[i]) / (span * selection.speed)),
        (p.secondImpulse - m.secondImpulse) / (span * selection.speed) ];
      const broad = derivative(stencil[0], stencil[1], 0.002), fine = derivative(stencil[2], stencil[3], 0.001);
      const disagreement = norm(broad.map((v, i) => v - fine[i])) / Math.max(norm(fine), 1e-9);
      const impulseDisagreement = Math.abs(broad[0] - fine[0]) / Math.max(Math.abs(fine[0]), 1e-9);
      const reason = Math.max(disagreement, impulseDisagreement) > 0.25 ? "unstable_derivative" :
        norm(fine) <= 1e-9 ? "inactive_coordinate" : null;
      return { index, first: coordinate.first, eligible: reason === null, reason, disagreement,
        impulseDisagreement, impulseDerivative: fine[0], constraintDerivative: fine.slice(1) };
    });
    const stable = columns.filter((c: any) => c.eligible);
    const solved = stable.length ? JSON.parse(execFileSync("python", [solver], {
      input: JSON.stringify({ gradient: stable.map((c: any) => c.impulseDerivative), first: stable.map((c: any) => c.first),
        jacobian: Array.from({ length: 61 }, (_, i) => stable.map((c: any) => c.constraintDerivative[i])),
        request: selection.requestedRawGain / selection.speed }), encoding: "utf8",
      env: { ...process.env, OPENBLAS_NUM_THREADS: "1", OMP_NUM_THREADS: "1" },
    })) : { matched: false, arms: {}, reason: "no_stable_coordinates" };
    const arms = Object.entries(solved.arms).map(([name, solution]: [string, any]) => {
      if (!solution.controls) return { name, ...solution };
      const controls = zero.slice(); stable.forEach((c: any, i: number) => controls[c.index] = solution.controls[i]);
      const changed = deform(track, selection, controls), measured = probe(changed, selection);
      const full = scoreTrack(changed, record), rawImpulseGain = measured.impulse - base.impulse;
      const predictedRawGain = solution.predictedImpulseGain * selection.speed;
      const releaseL2 = norm(measured.release.map((v: number, i: number) => (v - base.release[i]) / selection.speed));
      const result = { name, ...solution, controls, prefixExact: measured.prefix === base.prefix,
        contacts: measured.contacts, intact: measured.intact, rawImpulseGain, predictedRawGain,
        secondRawImpulseChange: measured.secondImpulse - base.secondImpulse, releaseL2,
        derivativeRelativeError: Math.abs(rawImpulseGain - predictedRawGain) / Math.max(Math.abs(predictedRawGain), 1e-12),
        valid: full.valid, scoreDelta: full.score - baseline.score, missing: full.missing, offBeat: full.offBeat,
        terminus: full.terminus, currentAxes: full.gaps.find((g: any) => g.gapIndex === selection.gapIndex)?.axes,
        nextAxes: full.gaps.find((g: any) => g.gapIndex === selection.second.gapIndex)?.axes };
      if (result.prefixExact && result.contacts.every(Boolean) && result.intact && result.valid &&
          result.rawImpulseGain > 0 && result.scoreDelta > 0) write(resolve(out, `${source.sourceId}-g${selection.gapIndex}-${name}.track.json`), changed);
      return result;
    });
    return { gapIndex: selection.gapIndex, eligible: true, releaseFrame: selection.releaseFrame,
      dimensions: zero.length, stableDimensions: stable.length, columns, matched: solved.matched, arms };
  });
  write(resolve(out, `${source.sourceId}.json`), { schema: "line.impact-pair-response.v1", implementation,
    planSha256: hash(readFileSync(resolve(out, "plan.json"))), sourceId: source.sourceId, baselineAxesExact: true,
    baselineScore: baseline.score, states, physicsFrames: getPhysicsFrameCount() - frameStart, elapsedMs: performance.now() - started });
}

if (process.argv.includes("--plan")) {
  if (existsSync(resolve(out, "plan.json"))) throw new Error("frozen plan already exists");
  const plan = makePlan(); write(resolve(out, "plan.json"), plan);
  const selections = plan.sources.flatMap((s: any) => s.selections);
  console.log(JSON.stringify({ sources: plan.sources.length, retainedSelections: selections.length,
    eligible: selections.filter((s: any) => s.eligible).length, exclusions: selections.filter((s: any) => !s.eligible),
    planSha256: hash(readFileSync(resolve(out, "plan.json"))) }));
} else {
  const plan = read(resolve(out, "plan.json")), planSha256 = hash(readFileSync(resolve(out, "plan.json")));
  if (plan.implementation !== implementation || plan.parentPlanSha256 !== parentPlanSha256) throw new Error("frozen implementation changed");
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
      const previous = read(path);
      if (previous.implementation !== implementation || previous.planSha256 !== planSha256) throw new Error("incompatible checkpoint");
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
    const results = plan.sources.map((s: any) => read(resolve(out, `${s.sourceId}.json`)));
    const states = results.flatMap((r: any) => r.states), eligible = states.filter((s: any) => s.eligible);
    const summary = { schema: "line.impact-pair-response-summary.v1", implementation, planSha256,
      sources: results.length, selections: states.length, eligible: eligible.length,
      matched: eligible.filter((s: any) => s.matched).length, baselineAxesExact: results.every((r: any) => r.baselineAxesExact),
      physicsFrames: results.reduce((s: number, r: any) => s + r.physicsFrames, 0),
      workerSeconds: results.reduce((s: number, r: any) => s + r.elapsedMs / 1000, 0),
      arms: Object.fromEntries(plan.law.arms.map((name: string) => {
        const arms = eligible.flatMap((s: any) => s.arms.filter((a: any) => a.name === name && a.controls));
        const good = arms.filter((a: any) => a.prefixExact && a.contacts.every(Boolean) && a.intact && a.valid);
        return [name, { attempted: arms.length, validComplete: good.length,
          positiveComplete: good.filter((a: any) => a.rawImpulseGain > 0 && a.scoreDelta > 0).length,
          medianRawImpulseGain: median(arms.map((a: any) => a.rawImpulseGain)),
          medianReleaseL2: median(arms.map((a: any) => a.releaseL2)),
          medianPredictedReleaseL2: median(arms.map((a: any) => a.predictedReleaseL2)),
          medianDerivativeRelativeError: median(arms.map((a: any) => a.derivativeRelativeError)),
          validScoreDeltaSum: good.reduce((s: number, a: any) => s + a.scoreDelta, 0),
          maximumValidScoreGain: Math.max(0, ...good.map((a: any) => a.scoreDelta)) }];
      })) };
    write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
  }
}
