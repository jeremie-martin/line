/** Locate first state/collision divergence under a frozen whole-track shift. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { getPhysicsFrameCount } from "../lib/detector.ts";
import { read, write, state, buildEngine } from "./impact_release_response.ts";

const input = resolve("generated/benchmark-v2/impact-delivery-650-new/selected-fit-trace");
const out = resolve("generated/benchmark-v2/impact-delivery-650-new/translation-divergence");
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const implementation = [fileURLToPath(import.meta.url), "scripts/benchmark/impact_release_response.ts"].map(p => hash(readFileSync(p))).join(":");
const census = read(resolve(input, "summary.json"));
const shifts = [[1, 0], [0, 1], [14, 0], [0, 14]];
const events = (engine: any, frame: number): string[] => engine.getUpdatesAtFrame(frame)
  .filter((u: any) => u.type === "CollisionUpdate").map((u: any) => `${u.id}:${u.updated.map((p: any) => p.id).join(",")}`);
mkdirSync(out, { recursive: true });
const request = { schema: "line.impact-translation-trace-request.v1", implementation, shifts, stateTolerance: 1e-9,
  sources: census.perSource.map((s: any) => ({ sourceId: s.sourceId,
    trackSha256: hash(readFileSync(resolve(input, `${s.sourceId}.track.json`))) })) };
const requestPath = resolve(out, "request.json");
if (existsSync(requestPath)) {
  if (JSON.stringify(read(requestPath)) !== JSON.stringify(request)) throw new Error("request changed");
} else write(requestPath, request);
for (const source of request.sources) {
  const path = resolve(out, `${source.sourceId}.json`);
  if (existsSync(path)) {
    if (read(path).implementation !== implementation) throw new Error("incompatible checkpoint");
    continue;
  }
  const started = performance.now(), frameStart = getPhysicsFrameCount();
  const trackPath = resolve(input, `${source.sourceId}.track.json`), track = read(trackPath);
  if (hash(readFileSync(trackPath)) !== source.trackSha256) throw new Error("track changed");
  let engine = buildEngine(track);
  const baseline = Array.from({ length: track.duration + 1 }, (_, frame) => ({
    values: state(engine, frame).values, collisions: events(engine, frame) }));
  disposeAllWasmEnginesForStudy();
  const rows = shifts.map(([dx, dy]) => {
    const translated = { ...track, startPosition: { ...track.startPosition, x: track.startPosition.x + dx, y: track.startPosition.y + dy },
      lines: track.lines.map((l: any) => ({ ...l, x1: l.x1 + dx, y1: l.y1 + dy, x2: l.x2 + dx, y2: l.y2 + dy })) };
    engine = buildEngine(translated);
    let firstState: any = null, firstCollision: any = null, previousError = 0, initialError = 0, checkedThrough = 0;
    try {
      for (let frame = 0; frame <= track.duration; frame++) {
        const values = state(engine, frame).values;
        const differences = values.map((v: number, i: number) => v - baseline[frame].values[i] -
          (i % 6 === 0 || i % 6 === 2 ? dx : i % 6 === 1 || i % 6 === 3 ? dy : 0));
        const error = Math.max(...differences.map(Math.abs)), collisions = events(engine, frame);
        if (frame === 0) initialError = error;
        if (firstState === null && error > 1e-9) firstState = { frame, maximumError: error, previousError };
        if (firstCollision === null && JSON.stringify(collisions) !== JSON.stringify(baseline[frame].collisions)) {
          firstCollision = { frame, previousError, maximumError: error, baseline: baseline[frame].collisions, translated: collisions,
            sameMultiset: JSON.stringify(collisions.slice().sort()) === JSON.stringify(baseline[frame].collisions.slice().sort()) };
        }
        previousError = error; checkedThrough = frame;
        if (firstState !== null && firstCollision !== null) break;
      }
      return { dx, dy, initialError, firstState, firstCollision, checkedThrough };
    } finally { disposeAllWasmEnginesForStudy(); }
  });
  write(path, { schema: "line.impact-translation-trace.v1", implementation, sourceId: source.sourceId, rows,
    physicsFrames: getPhysicsFrameCount() - frameStart, elapsedMs: performance.now() - started });
}
const results = request.sources.map((s: any) => read(resolve(out, `${s.sourceId}.json`))), rows = results.flatMap((r: any) => r.rows);
const summary = { schema: "line.impact-translation-trace-summary.v1", implementation, sources: results.length,
  groups: [1, 14].map(displacement => {
    const group = rows.filter((r: any) => r.dx === displacement || r.dy === displacement);
    return { displacement, traces: group.length,
      stateBeforeCollision: group.filter((r: any) => r.firstState && (!r.firstCollision || r.firstState.frame < r.firstCollision.frame)).length,
      simultaneous: group.filter((r: any) => r.firstState && r.firstCollision && r.firstState.frame === r.firstCollision.frame).length,
      collisionBeforeState: group.filter((r: any) => r.firstCollision && (!r.firstState || r.firstCollision.frame < r.firstState.frame)).length,
      neither: group.filter((r: any) => !r.firstState && !r.firstCollision).length,
      sameCollisionMultiset: group.filter((r: any) => r.firstCollision?.sameMultiset).length,
      maximumInitialError: Math.max(...group.map((r: any) => r.initialError)) };
  }), physicsFrames: results.reduce((s: number, r: any) => s + r.physicsFrames, 0),
  workerSeconds: results.reduce((s: number, r: any) => s + r.elapsedMs / 1000, 0) };
write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
