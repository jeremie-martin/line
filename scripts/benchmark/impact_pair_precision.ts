/** Fixed-direction derivative audit. No new controller or scored candidate.
 * Separates Jacobian cancellation error from finite-step nonlinear response.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { detect, extractRawTrajectory, getPhysicsFrameCount } from "../lib/detector.ts";
import { contactRedirArcPxAtLanding, findAuthoredContactNearFrame } from "../v0/core/substrate.ts";
import { read, write, deform, state, buildEngine } from "./impact_release_response.ts";

const root = resolve("generated/benchmark-v2/impact-delivery-650-new/contact-pair-response");
const input = resolve("generated/benchmark-v2/impact-delivery-650-new/selected-fit-trace");
const out = resolve("generated/benchmark-v2/impact-delivery-650-new/contact-pair-precision");
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const implementation = [fileURLToPath(import.meta.url), "scripts/benchmark/impact_release_response.ts"]
  .map(p => hash(readFileSync(p))).join(":");
const plan = read(resolve(root, "plan.json")), parentPlanSha256 = hash(readFileSync(resolve(root, "plan.json")));
const norm = (xs: number[]) => Math.hypot(...xs);
const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
const median = (xs: number[]) => xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null;
mkdirSync(out, { recursive: true });
const requestPath = resolve(out, "request.json");
const request = { schema: "line.impact-pair-precision-request.v1", implementation, parentPlanSha256,
  commandScales: [1, -1, 0.001, -0.001, 0.0005, -0.0005],
  purpose: "fixed-direction central derivative and even response; no scored candidate" };
if (existsSync(requestPath)) {
  if (JSON.stringify(read(requestPath)) !== JSON.stringify(request)) throw new Error("request changed");
} else write(requestPath, request);

function probe(track: any, selection: any): any {
  try {
    const engine = buildEngine(track), prefix = state(engine, selection.impactFrame - 1);
    const det = detect(extractRawTrajectory(engine, selection.releaseFrame)), release = state(engine, selection.releaseFrame);
    const contacts = [selection, selection.second].map(s =>
      findAuthoredContactNearFrame(det, s.targetFrame, 1, s.gapFrames)?.frame === s.impactFrame);
    return { prefix: prefix.key, intact: release.intact, contacts,
      impulse: contactRedirArcPxAtLanding(det, selection.impactFrame),
      response: [...release.values, contactRedirArcPxAtLanding(det, selection.second.impactFrame)] };
  } finally { disposeAllWasmEnginesForStudy(); }
}

for (const source of plan.sources) {
  const path = resolve(out, `${source.sourceId}.json`);
  if (existsSync(path)) {
    const old = read(path);
    if (old.implementation !== implementation || old.parentPlanSha256 !== parentPlanSha256) throw new Error("incompatible checkpoint");
    continue;
  }
  const started = performance.now(), frameStart = getPhysicsFrameCount();
  const parentPath = resolve(root, `${source.sourceId}.json`), parent = read(parentPath);
  if (parent.implementation !== plan.implementation || parent.planSha256 !== parentPlanSha256) throw new Error("parent changed");
  const trackPath = resolve(input, `${source.sourceId}.track.json`), track = read(trackPath);
  if (hash(readFileSync(trackPath)) !== source.trackSha256) throw new Error("track changed");
  const rows: any[] = [];
  for (const selection of source.selections.filter((s: any) => s.eligible)) {
    const base = probe(track, selection), response = parent.states.find((s: any) => s.gapIndex === selection.gapIndex);
    for (const arm of response.arms.filter((a: any) => a.controls)) {
      const predicted = Array.from({ length: 61 }, (_, i) => response.columns.filter((c: any) => c.eligible)
        .reduce((sum: number, c: any) => sum + c.constraintDerivative[i] * arm.controls[c.index], 0));
      const samples = request.commandScales.map(scale => {
        const measured = probe(deform(track, selection, arm.controls.map((u: number) => u * scale)), selection);
        return { scale, compatible: measured.prefix === base.prefix && measured.intact && measured.contacts.every(Boolean),
          response: sub(measured.response, base.response).map(v => v / selection.speed),
          impulseChange: (measured.impulse - base.impulse) / selection.speed };
      });
      const coarse = sub(samples[2].response, samples[3].response).map(v => v / 0.002);
      const fine = sub(samples[4].response, samples[5].response).map(v => v / 0.001);
      const even = samples[0].response.map((v, i) => (v + samples[1].response[i]) / 2);
      const value = { gapIndex: selection.gapIndex, arm: arm.name,
        compatible: samples.every(s => s.compatible), predicted, coarse, fine, even, samples,
        predictedConstraintL2: norm(predicted), actualUnitConstraintL2: norm(samples[0].response),
        fineDerivativeL2: norm(fine), derivativeAgreementL2: norm(sub(coarse, fine)),
        jacobianCancellationErrorL2: norm(sub(fine, predicted)),
        nonlinearRemainderL2: norm(sub(samples[0].response, fine)), evenResponseL2: norm(even) };
      if (Math.abs(norm(samples[0].response.slice(0, 60)) - arm.releaseL2) > 1e-9) throw new Error("unit-command replay changed");
      rows.push(value);
    }
  }
  write(path, { schema: "line.impact-pair-precision.v1", implementation, parentPlanSha256,
    parentRecordSha256: hash(readFileSync(parentPath)), sourceId: source.sourceId, rows,
    physicsFrames: getPhysicsFrameCount() - frameStart, elapsedMs: performance.now() - started });
}
const results = plan.sources.map((s: any) => read(resolve(out, `${s.sourceId}.json`))), rows = results.flatMap((r: any) => r.rows);
const summary = { schema: "line.impact-pair-precision-summary.v1", implementation, parentPlanSha256,
  sources: results.length, directions: rows.length,
  physicsFrames: results.reduce((s: number, r: any) => s + r.physicsFrames, 0),
  workerSeconds: results.reduce((s: number, r: any) => s + r.elapsedMs / 1000, 0),
  arms: Object.fromEntries(plan.law.arms.map((arm: string) => {
    const group = rows.filter((r: any) => r.arm === arm);
    const statistics = Object.fromEntries(["predictedConstraintL2", "actualUnitConstraintL2", "fineDerivativeL2",
      "derivativeAgreementL2", "jacobianCancellationErrorL2", "nonlinearRemainderL2", "evenResponseL2"]
      .map(key => [key, median(group.map((r: any) => r[key]))]));
    return [arm, { directions: group.length, compatible: group.filter((r: any) => r.compatible).length, median: statistics,
      medianCancellationFraction: median(group.map((r: any) => r.jacobianCancellationErrorL2 / Math.max(r.actualUnitConstraintL2, 1e-15))),
      medianNonlinearFraction: median(group.map((r: any) => r.nonlinearRemainderL2 / Math.max(r.actualUnitConstraintL2, 1e-15))) }];
  })) };
write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
