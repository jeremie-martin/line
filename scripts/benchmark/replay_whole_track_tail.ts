/** Correct the early transport studies' omitted rideout validation. */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { detect, extractRawTrajectory, getPhysicsFrameCount } from "../lib/detector.ts";
import { buildDriftReport } from "../v0/core/substrate.ts";
import { buildAxisContract, scoreV2Report } from "../v0/benchmark_v2/evaluator.ts";

const hash = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const read = (p: string) => {
  const b = readFileSync(p);
  if (readFileSync(`${p}.sha256`, "utf8").split(/\s/)[0] !== hash(b)) throw new Error(`checksum mismatch: ${p}`);
  return JSON.parse(b.toString());
};
const root = resolve("generated/benchmark-v2/unrestricted-650");
const captureRoot = resolve("generated/benchmark-v2/impact-delivery-650-new/interrupted-support-capture");
const baseline = JSON.parse(readFileSync("benchmark/v2/campaign-baseline.json", "utf8"));
const engineHash = hash(readFileSync("engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm"));
if (process.env.LR_ENGINE !== "wasm" || engineHash !== baseline.engine_artifact_fingerprint) throw new Error("frozen exact engine required");
const suite = JSON.parse(readFileSync("benchmark/v2/compat/suite-manifest.json", "utf8"));
const rows: any[] = [], cache = new Map<string, any>();
const start = getPhysicsFrameCount(), started = performance.now();
for (const directory of ["energy-pilot-typed", "geometry-pilot", "geometry-discovery", "restore-pilot"]) {
  for (const file of readdirSync(resolve(root, directory)).filter(n => n.endsWith(".track.json"))) {
    const sourceId = developmentCases.find(e => file.startsWith(`${e.case.metadata.id}-`))!.case.metadata.id;
    const path = resolve(root, directory, file), track = read(path);
    const capture = read(resolve(captureRoot, `${sourceId}.capture.json`)), ctx = capture.context;
    const spec = applyJolt(developmentCases.find(e => e.case.metadata.id === sourceId)!.case.spec, benchmarkPolicy.transform.joltMs);
    const contract = buildAxisContract(spec, Object.keys(benchmarkPolicy.componentWeights) as any);
    const previous = scoreV2Report(read(path.replace(".track.json", ".report.json")), spec.contacts.length, contract, suite);
    const key = `${sourceId}:${hash(JSON.stringify(track))}`;
    let replay = cache.get(key);
    if (!replay) {
      try {
        const engine = new LineRiderEngine().setStart(track.startPosition, track.riders[0].startVelocity)
          .addLine(track.lines.map(createLineFromJson));
        const byId = new Map(track.lines.map((l: any) => [l.id, l]));
        const fits = capture.snapshot.node.search.prefixFits.map((f: any) => f === null ? null :
          { ...f, lines: f.lines.map((l: any) => byId.get(l.id)) });
        const report = buildDriftReport(detect(extractRawTrajectory(engine, track.duration)), spec,
          ctx.gaps, ctx.allContactFrames, ctx.durationFrames, [], fits, ctx.gapAxisTargets);
        replay = scoreV2Report(report, spec.contacts.length, contract, suite);
        cache.set(key, replay);
      } finally { disposeAllWasmEnginesForStudy(); }
    }
    rows.push({ directory, file, sourceId, trackSha256: hash(readFileSync(path)), previous, replay,
      scoreUnchanged: previous.score === replay.score, valid: replay.valid });
  }
}
const result = { schema: "line.transport-full-tail-audit.v1", implementation: hash(readFileSync(new URL(import.meta.url))),
  engineHash, rows, tracks: rows.length, uniqueReplays: cache.size, invalid: rows.filter(r => !r.valid).length,
  scoreChanges: rows.filter(r => !r.scoreUnchanged).length, frames: getPhysicsFrameCount() - start, elapsedMs: performance.now() - started };
const path = resolve(root, "transport-full-tail-audit.json"), body = `${JSON.stringify(result)}\n`;
writeFileSync(path, body); writeFileSync(`${path}.sha256`, `${hash(body)}  ${basename(path)}\n`);
console.log(JSON.stringify({ tracks: result.tracks, uniqueReplays: result.uniqueReplays, invalid: result.invalid,
  scoreChanges: result.scoreChanges, frames: result.frames, elapsedMs: result.elapsedMs }));
