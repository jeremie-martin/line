import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { LineRiderEngine as Judge, disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { getRiderMetered, getPhysicsFrameCount, extractRawTrajectory } from "../lib/detector.ts";
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const backend = resolve(arg("backend")!), out = resolve(arg("out")!);
const input = resolve(arg("input") ?? "generated/benchmark-v2/impact-delivery-650-new/interrupted-support-capture");
const hash = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const read = (p: string) => {
  const b = readFileSync(p);
  if (hash(b) !== readFileSync(p + ".sha256", "utf8").split(/\s/)[0]) throw new Error(`checksum: ${p}`);
  return JSON.parse(b.toString());
};
const manifest = read(resolve(backend, "manifest.json"));
for (const [p, h] of Object.entries(manifest.generated)) if (hash(readFileSync(resolve(backend, p))) !== h) throw new Error("backend changed");
const { LineRiderEngine: Search, disposeAllWasmEnginesForStudy: disposeSearch } = await import(pathToFileURL(resolve(backend, "engine.ts")).href);
const sources = arg("sources")?.split(",") ?? ["amplitude_tides", "frontier_dense_recovery", "regression_transition_mosaic", "believer_impact_56s"];
const rows: any[] = [], started = getPhysicsFrameCount();
for (const sourceId of sources) {
  const capture = read(resolve(input, `${sourceId}.capture.json`)), track = read(resolve(input, `${sourceId}.track.json`));
  const fits = capture.snapshot.node.search.prefixFits, startLines = capture.snapshot.node.startLines;
  try {
    const start = (Engine: any) => new Engine().setStart(track.startPosition, track.riders[0].startVelocity).addLine(startLines);
    let search = start(Search), judge = start(Judge), detachedReads = 0, tracedReads = 0, maxProjection = 0;
    for (let i = 0; i < fits.length; i++) {
      if (!fits[i]) continue;
      const frame = capture.context.gaps[i].endFrame + 4;
      search = search.addLine(fits[i].lines); judge = judge.addLine(fits[i].lines);
      const expected = JSON.stringify(getRiderMetered(judge, frame).ballisticState());
      if (JSON.stringify(getRiderMetered(search, frame).ballisticState()) !== expected) throw new Error("prefix differs from fixed physics");
      if (search.prepareCollisionTrace) {
        search.prepareCollisionTrace(frame);
        const beforeTrace = getPhysicsFrameCount();
        const after = getRiderMetered(search, frame).ballisticState();
        if (JSON.stringify(after) !== expected || getPhysicsFrameCount() - beforeTrace !== 1) throw new Error("trace replay or metering changed");
        const trace = search.readCollisionTrace();
        if (trace.length !== 6) throw new Error("incomplete solver trace");
        for (const key of Object.keys(after.points)) {
          const p = trace[5][key], q = after.points[key];
          if (!Object.values(p).every(Number.isFinite)) throw new Error("nonfinite solver trace");
          maxProjection = Math.max(maxProjection, Math.hypot(p.x - q.x, p.y - q.y));
        }
        tracedReads++;
      }
      const old = search, before = getPhysicsFrameCount();
      search = old.detach();
      if (JSON.stringify(getRiderMetered(search, frame).ballisticState()) !== expected) throw new Error("detached packet changed");
      if (getPhysicsFrameCount() !== before) throw new Error("cache copy integrated physics");
      // Fork both sides with a physical near-contact surface, then read the old
      // branch again. This exercises invalidation after independent cache copy.
      const reference = fits[i].lines[0];
      const extra = { ...reference, id: 2000000 + i, x1: reference.x1 + 0.01, x2: reference.x2 + 0.01 };
      const a = search.addLine(extra), b = judge.addLine(extra);
      if (JSON.stringify(getRiderMetered(a, frame + 3).ballisticState()) !==
          JSON.stringify(getRiderMetered(b, frame + 3).ballisticState())) throw new Error("forked collision response changed");
      if (JSON.stringify(getRiderMetered(search, frame).ballisticState()) !== expected) throw new Error("restored branch changed");
      Search.retainOnly([search]); detachedReads++;
    }
    const actual = extractRawTrajectory(search, track.duration), expected = extractRawTrajectory(judge, track.duration);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("full trajectory changed");
    rows.push({ sourceId, detachedReads, tracedReads, maxProjection, trajectorySha256: hash(JSON.stringify(actual)) });
  } finally { disposeSearch(); disposeAllWasmEnginesForStudy(); }
}
const report = { schema: "line.planner-cache-audit.v1", backendManifestSha256: hash(readFileSync(resolve(backend, "manifest.json"))),
  frames: getPhysicsFrameCount() - started, rows };
const body = JSON.stringify(report) + "\n";
writeFileSync(out, body); writeFileSync(out + ".sha256", hash(body) + "\n");
console.log(body);
