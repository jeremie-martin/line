/**
 * Per-gap achieved air against the authored ask, measured with the evaluator's
 * own axis function on committed tracks.
 */
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { detect, extractRawTrajectory } from "../lib/detector.ts";
import { applyJolt } from "../produce/seed.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { effectiveAxes, sliceTimeline } from "./core/substrate.ts";
import { AXIS_MEASURE } from "./core/measure.ts";
import { loadSourceManifest, loadSourceSpec, resolveSources } from "./benchmark_v2/model.ts";
import { secToFrame } from "./types.ts";

function argument(argv: string[], name: string): string | undefined {
  return argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

const argv = process.argv.slice(2);
const sourceIds = (argument(argv, "sources") ??
  "dense_dialogue,sparse_lowline,river_reentry,open_hook,countercurrent,high_air_drive")
  .split(",").map((v) => v.trim()).filter(Boolean);
const seeds = (argument(argv, "seeds") ?? "0").split(",").map(Number);
const budget = Number(argument(argv, "budget") ?? 250_000);
const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));

type Row = { ask: number; got: number; gapFrames: number; capBinds: boolean };
const rows: Row[] = [];
for (const id of sourceIds) {
  const src = sources.find((s) => s.id === id);
  if (src === undefined) continue;
  const spec = applyJolt(await loadSourceSpec(src), -15);
  for (const seed of seeds) {
    const { track } = compileHandoff(spec, seed, { budget });
    // deno-lint-ignore no-explicit-any
    let engine: any = new LineRiderEngine().setStart(
      track.startPosition,
      track.riders[0].startVelocity,
    );
    for (const line of track.lines) engine = engine.addLine(createLineFromJson(line));
    const det = detect(extractRawTrajectory(engine, track.duration));
    const frames = [...spec.contacts].map((c) => secToFrame(c.t)).sort((a, b) => a - b);
    for (const gap of sliceTimeline(frames, secToFrame(spec.duration))) {
      const ask = effectiveAxes(gap, spec).air;
      if (ask === undefined) continue;
      const got = AXIS_MEASURE.air({ det, gap, gapLines: [], rangeEndFrame: gap.endFrame });
      if (got === undefined || !Number.isFinite(got)) continue;
      const N = Math.max(1, gap.endFrame - gap.startFrame);
      rows.push({ ask, got, gapFrames: N, capBinds: (1 - ask) * N > 0.55 * N });
    }
  }
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const rms = (xs: number[]): number => Math.sqrt(mean(xs.map((x) => x * x)));
const report = (label: string, subset: Row[]): void => {
  if (subset.length === 0) return;
  const err = subset.map((r) => r.got - r.ask);
  console.log(
    `${label.padEnd(22)} n=${String(subset.length).padStart(5)}  ask ${
      mean(subset.map((r) => r.ask)).toFixed(3)
    }  got ${mean(subset.map((r) => r.got)).toFixed(3)}  bias ${
      (mean(err) >= 0 ? "+" : "") + mean(err).toFixed(4)
    }  rms ${rms(err).toFixed(4)}`,
  );
};
report("all", rows);
report("cap binds", rows.filter((r) => r.capBinds));
report("cap free", rows.filter((r) => !r.capBinds));
