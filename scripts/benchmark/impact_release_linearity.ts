/** Step-halving audit of the already frozen response directions.
 * This calibrates model validity and suffix tolerance; no dose is selected for
 * compiler integration and no direction is refitted from these outcomes.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPhysicsFrameCount } from "../lib/detector.ts";
import { read, write, probe, scoreTrack, deform } from "./impact_release_response.ts";

const root = resolve("generated/benchmark-v2/impact-delivery-650-new/release-response");
const input = resolve("generated/benchmark-v2/impact-delivery-650-new/selected-fit-trace");
const out = resolve("generated/benchmark-v2/impact-delivery-650-new/release-linearity");
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const implementation = hash(readFileSync(fileURLToPath(import.meta.url))) + ":" +
  hash(readFileSync("scripts/benchmark/impact_release_response.ts"));
const plan = read(resolve(root, "plan.json"));
const planSha256 = hash(readFileSync(resolve(root, "plan.json")));
const steps = [0.001, 0.0005, 0.00025];
mkdirSync(out, { recursive: true });
write(resolve(out, "request.json"), { schema: "line.impact-release-linearity-request.v1",
  implementation, parentPlanSha256: planSha256, steps,
  direction: "parent command normalized to fixed maximum component; no refit",
  sources: plan.sources.map((s: any) => s.sourceId) });

for (const source of plan.sources) {
  const path = resolve(out, `${source.sourceId}.json`);
  if (existsSync(path)) {
    const old = read(path);
    if (old.implementation !== implementation || old.parentPlanSha256 !== planSha256) throw new Error("incompatible checkpoint");
    continue;
  }
  const started = performance.now(), frameStart = getPhysicsFrameCount();
  const parentPath = resolve(root, `${source.sourceId}.json`), parent = read(parentPath);
  if (parent.implementation !== plan.implementation || parent.planSha256 !== planSha256) throw new Error("parent experiment mismatch");
  const trackPath = resolve(input, `${source.sourceId}.track.json`), recordPath = resolve(input, `${source.sourceId}.json`);
  const track = read(trackPath), record = read(recordPath);
  if (hash(readFileSync(trackPath)) !== source.trackSha256 || hash(readFileSync(recordPath)) !== source.recordSha256) throw new Error("input mismatch");
  const baseScore = scoreTrack(track, record);
  if (!baseScore.valid || Math.abs(baseScore.score - record.score) > 1e-9) throw new Error("baseline replay mismatch");
  const rows: any[] = [];
  for (const selection of source.selected) {
    const base = probe(track, selection);
    const response = parent.states.find((s: any) => s.gapIndex === selection.gapIndex);
    for (const arm of response.arms) {
      if (!arm.controls) continue;
      const maximum = Math.max(...arm.controls.map(Math.abs));
      if (!(maximum > 0)) continue;
      for (const step of steps) {
        const scale = step / maximum;
        const controls = arm.controls.map((x: number) => x * scale);
        const changed = deform(track, selection, controls);
        const measured = probe(changed, selection), full = scoreTrack(changed, record);
        const rawImpulseGain = measured.impulse - base.impulse;
        const predictedRawGain = arm.predictedImpulseGain * selection.speed * scale;
        const releaseL2 = Math.hypot(...measured.release.map((x: number, i: number) => (x - base.release[i]) / selection.speed));
        const value = { gapIndex: selection.gapIndex, arm: arm.name, step,
          rawImpulseGain, predictedRawGain, releaseL2, predictedReleaseL2: arm.predictedReleaseL2 * scale,
          derivativeRelativeError: Math.abs(rawImpulseGain - predictedRawGain) / Math.max(Math.abs(predictedRawGain), 1e-12),
          prefixExact: measured.prefix === base.prefix, contact: measured.contact, intact: measured.intact,
          valid: full.valid, scoreDelta: full.score - baseScore.score, missing: full.missing, offBeat: full.offBeat,
          terminus: full.terminus };
        rows.push(value);
        if (value.prefixExact && value.contact && value.intact && value.valid && rawImpulseGain > 0 && value.scoreDelta > 0) {
          write(resolve(out, `${source.sourceId}-g${selection.gapIndex}-${arm.name}-${step}.track.json`), changed);
        }
      }
    }
  }
  write(path, { schema: "line.impact-release-linearity.v1", implementation, parentPlanSha256: planSha256,
    parentRecordSha256: hash(readFileSync(parentPath)), sourceId: source.sourceId, rows,
    physicsFrames: getPhysicsFrameCount() - frameStart, elapsedMs: performance.now() - started });
  process.stderr.write(`${source.sourceId}: ${rows.length} exact step-halving replays\n`);
}
const results = plan.sources.map((s: any) => read(resolve(out, `${s.sourceId}.json`)));
const rows = results.flatMap((s: any) => s.rows);
const median = (xs: number[]) => { const sorted = xs.slice().sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null; };
const summary = { schema: "line.impact-release-linearity-summary.v1", implementation, parentPlanSha256: planSha256,
  sources: results.length, trials: rows.length,
  physicsFrames: results.reduce((s: number, r: any) => s + r.physicsFrames, 0),
  workerSeconds: results.reduce((s: number, r: any) => s + r.elapsedMs / 1000, 0),
  groups: plan.law.arms.flatMap((arm: string) => steps.map(step => {
    const group = rows.filter((row: any) => row.arm === arm && row.step === step);
    const good = group.filter((r: any) => r.prefixExact && r.contact && r.intact && r.valid);
    return { arm, step, trials: group.length, validComplete: good.length,
      positiveComplete: good.filter((r: any) => r.rawImpulseGain > 0 && r.scoreDelta > 0).length,
      medianDerivativeRelativeError: median(group.map((r: any) => r.derivativeRelativeError)),
      medianReleaseL2: median(group.map((r: any) => r.releaseL2)),
      medianPredictedReleaseL2: median(group.map((r: any) => r.predictedReleaseL2)),
      validScoreDeltaSum: good.reduce((s: number, r: any) => s + r.scoreDelta, 0),
      maximumValidScoreGain: Math.max(0, ...good.map((r: any) => r.scoreDelta)) };
  })) };
write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
