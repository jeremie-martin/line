/** Premise audit for a relative-state suffix join. No compiler candidate. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPhysicsFrameCount } from "../lib/detector.ts";
import { read, write, scoreTrack } from "./impact_release_response.ts";

const input = resolve("generated/benchmark-v2/impact-delivery-650-new/selected-fit-trace");
const gridPeriod = process.argv.includes("--grid-period");
const out = resolve(`generated/benchmark-v2/impact-delivery-650-new/translation-${gridPeriod ? "grid-period" : "invariance"}`);
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const implementation = [fileURLToPath(import.meta.url), "scripts/benchmark/impact_release_response.ts"].map(p => hash(readFileSync(p))).join(":");
const census = read(resolve(input, "summary.json")), censusSha256 = hash(readFileSync(resolve(input, "summary.json")));
// The 14px period is read from the frozen engine, not fitted to outcomes.
const displacement = gridPeriod ? 14 : 1;
const shifts = [[displacement, 0], [-displacement, 0], [0, displacement], [0, -displacement]];
mkdirSync(out, { recursive: true });
const request = { schema: "line.impact-translation-invariance-request.v1", implementation, censusSha256, shifts,
  purpose: "audit engine/scorer translation equivariance; no candidate selection",
  sources: census.perSource.map((s: any) => ({ sourceId: s.sourceId,
    trackSha256: hash(readFileSync(resolve(input, `${s.sourceId}.track.json`))),
    recordSha256: hash(readFileSync(resolve(input, `${s.sourceId}.json`))) })) };
const path = resolve(out, "request.json");
if (existsSync(path)) {
  if (JSON.stringify(read(path)) !== JSON.stringify(request)) throw new Error("frozen request changed");
} else write(path, request);

for (const source of request.sources) {
  const output = resolve(out, `${source.sourceId}.json`);
  if (existsSync(output)) {
    const old = read(output);
    if (old.implementation !== implementation || old.censusSha256 !== censusSha256) throw new Error("incompatible checkpoint");
    continue;
  }
  const started = performance.now(), frameStart = getPhysicsFrameCount();
  const record = read(resolve(input, `${source.sourceId}.json`)), track = read(resolve(input, `${source.sourceId}.track.json`));
  const base = scoreTrack(track, record);
  if (!base.valid || Math.abs(base.score - record.score) > 1e-9) throw new Error("baseline replay mismatch");
  for (const row of record.rows) {
    const replay = base.gaps.find((g: any) => g.gapIndex === row.gapIndex);
    for (const [axis, value] of Object.entries(row.finalAxes) as Array<[string, any]>) {
      if (replay?.axes[axis]?.achieved !== value.achieved) throw new Error("baseline axis mismatch");
    }
  }
  const rows = shifts.map(([dx, dy]) => {
    const translated = { ...track, startPosition: { ...track.startPosition, x: track.startPosition.x + dx, y: track.startPosition.y + dy },
      lines: track.lines.map((l: any) => ({ ...l, x1: l.x1 + dx, y1: l.y1 + dy, x2: l.x2 + dx, y2: l.y2 + dy })) };
    const full = scoreTrack(translated, record);
    const differences = base.gaps.flatMap((g: any) => {
      const replay = full.gaps.find((v: any) => v.gapIndex === g.gapIndex);
      return Object.entries(g.axes).map(([axis, value]: [string, any]) => {
        const achieved = replay?.axes[axis]?.achieved;
        return { gapIndex: g.gapIndex, axis, missing: achieved === undefined,
          difference: achieved === undefined ? null : achieved - value.achieved };
      });
    });
    return { dx, dy, valid: full.valid, scoreDelta: full.score - base.score, missing: full.missing, offBeat: full.offBeat,
      maximumAxisDifference: Math.max(0, ...differences.map((d: any) => Math.abs(d.difference ?? 0))),
      missingAxes: differences.filter((d: any) => d.missing).length, differences };
  });
  write(output, { schema: "line.impact-translation-invariance.v1", implementation, censusSha256,
    sourceId: source.sourceId, baselineScore: base.score, baselineAxesExact: true, rows,
    physicsFrames: getPhysicsFrameCount() - frameStart, elapsedMs: performance.now() - started });
}
const results = request.sources.map((s: any) => read(resolve(out, `${s.sourceId}.json`))), rows = results.flatMap((r: any) => r.rows);
const summary = { schema: "line.impact-translation-invariance-summary.v1", implementation, censusSha256,
  sources: results.length, shifts: rows.length, valid: rows.filter((r: any) => r.valid).length,
  axesWithin1e9: rows.filter((r: any) => r.maximumAxisDifference <= 1e-9 && !r.missingAxes).length,
  maximumAxisDifference: Math.max(...rows.map((r: any) => r.maximumAxisDifference)),
  maximumAbsoluteScoreDelta: Math.max(...rows.map((r: any) => Math.abs(r.scoreDelta))),
  physicsFrames: results.reduce((s: number, r: any) => s + r.physicsFrames, 0),
  workerSeconds: results.reduce((s: number, r: any) => s + r.elapsedMs / 1000, 0) };
write(resolve(out, "summary.json"), summary); console.log(JSON.stringify(summary, null, 2));
