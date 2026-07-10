/** Exact post-compile oracle for a small exit-pitch edit at the weakest gap. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { detect, extractRawTrajectory, K_BOUNCE_LANDING } from "../lib/detector.ts";
import { buildDriftReport, sliceTimeline, type GapFit } from "./core/substrate.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { scoreDriftReport } from "./score.ts";
import { secToFrame, type AxisValues, type Gap, type TrackLine } from "./types.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const defaultSpecs = [
  "drums_pendulum", "drums_dropout", "dense_echo_climb", "skyline_push",
  "drums_pulse", "drums_signature", "rhythm_ladder", "solo_run",
  "drums_crescendo", "ridge_pulse", "canyon_steps", "float_bounds",
].join(",");
const specArg = argValue("specs") ?? defaultSpecs;
const specs = (specArg === "all" ? [...GOLDEN_SPECS] : specArg.split(",")) as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0").split(",").map(Number);
const budget = Number(argValue("budget") ?? "200000");
const outPath = argValue("out");
const deltas = (argValue("deltas") ?? "-4,-2,2,4").split(",").map(Number);

for (const spec of specs) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) throw new Error(`unknown spec "${spec}"`);
}

type Track = {
  startPosition?: { x: number; y: number };
  riders?: Array<{ startVelocity?: { x: number; y: number } }>;
  lines?: TrackLine[];
};

type Variant = { delta: number; score: number; contractPassed: boolean };
type Row = {
  spec: GoldenSpecName;
  seed: number;
  baselineScore: number;
  weakGap: number;
  weakSse: number;
  variants: Variant[];
  bestDelta: number;
  bestScore: number;
};

function lineGroups(lines: readonly TrackLine[]): TrackLine[][] {
  const groups: TrackLine[][] = [];
  let group: TrackLine[] = [];
  for (const line of lines) {
    const previous = group.at(-1);
    if (previous !== undefined && line.x1 === previous.x2 && line.y1 === previous.y2) {
      group.push(line);
    } else {
      if (group.length > 0) groups.push(group);
      group = [line];
    }
  }
  if (group.length > 0) groups.push(group);
  return groups;
}

function pitchExit(lines: readonly TrackLine[], degrees: number): TrackLine[] {
  const tailCount = Math.max(1, Math.ceil(lines.length / 3));
  const split = lines.length - tailCount;
  const pivot = { x: lines[split].x1, y: lines[split].y1 };
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return lines.map((line, index) => {
    if (index < split) return { ...line };
    const rotate = (x: number, y: number): [number, number] => {
      const dx = x - pivot.x;
      const dy = y - pivot.y;
      return [pivot.x + dx * cos - dy * sin, pivot.y + dx * sin + dy * cos];
    };
    const [x1, y1] = rotate(line.x1, line.y1);
    const [x2, y2] = rotate(line.x2, line.y2);
    return { ...line, x1, y1, x2, y2 };
  });
}

function targetsFromReport(report: ReturnType<typeof compileHandoff>["report"], gaps: Gap[]): AxisValues[] {
  const targets = gaps.map(() => ({} as AxisValues));
  for (const gap of report.gaps) {
    for (const [axis, value] of Object.entries(gap.axes)) {
      (targets[gap.gap_index] as Record<string, number>)[axis] = value.target;
    }
    gaps[gap.gap_index].targets = { ...targets[gap.gap_index] };
  }
  return targets;
}

function weakestGap(report: ReturnType<typeof compileHandoff>["report"]): { index: number; sse: number } {
  return report.gaps.reduce((worst, gap) => {
    const sse = Object.values(gap.axes).reduce((sum, value) => sum + value.error * value.error, 0);
    return sse > worst.sse ? { index: gap.gap_index, sse } : worst;
  }, { index: -1, sse: -Infinity });
}

const rows: Row[] = [];
for (const specName of specs) {
  const userSpec = await loadGoldenSpec(specName, "base");
  const spec = {
    ...userSpec,
    preroll: undefined,
    contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= K_BOUNCE_LANDING),
  };
  const durationFrames = secToFrame(spec.duration);
  const contactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  for (const seed of seeds) {
    const started = Date.now();
    const checkpoint = compileHandoff(userSpec, seed, { budget });
    const track = checkpoint.track as Track;
    const lines = track.lines ?? [];
    const groups = lineGroups(lines);
    const hasStartGroup = groups.length > 0 && groups[0][0].x1 <= (track.startPosition?.x ?? 0);
    const offset = hasStartGroup ? 1 : 0;
    if (groups.length !== checkpoint.report.contacts.length + offset) {
      console.error(`  ${specName}/s${seed}: line grouping ${groups.length}, skipped`);
      continue;
    }

    const gaps = sliceTimeline(contactFrames, durationFrames);
    const gapTargets = targetsFromReport(checkpoint.report, gaps);
    const fits = gaps.map((gap): GapFit | null => {
      if (!gap.endsWithContact) return null;
      const gapLines = groups[offset + gap.index];
      return gapLines === undefined
        ? null
        : { arc: null, geometry: "lines", lines: gapLines, achieved: {}, cost: 0 };
    });
    const weak = weakestGap(checkpoint.report);
    const weakGroup = groups[offset + weak.index];
    if (weak.index < 0 || weakGroup === undefined) continue;

    const simulate = (candidateLines: TrackLine[]): Variant => {
      let engine = new LineRiderEngine();
      engine = engine.setStart(
        track.startPosition ?? { x: 0, y: 0 },
        track.riders?.[0]?.startVelocity ?? { x: 0.4, y: 0 },
      );
      engine = engine.addLine(candidateLines.map(createLineFromJson));
      const det = detect(extractRawTrajectory(engine, durationFrames + 20));
      const report = buildDriftReport(det, spec, gaps, contactFrames, durationFrames, [], fits, gapTargets);
      const score = scoreDriftReport(report, { totalFrames: durationFrames });
      return { delta: 0, score: score.score, contractPassed: score.contract_passed };
    };

    const baseline = simulate(lines);
    const variants = deltas.map((delta) => {
      const replacement = pitchExit(weakGroup, delta);
      const replacementById = new Map(replacement.map((line) => [line.id, line]));
      const result = simulate(lines.map((line) => replacementById.get(line.id) ?? line));
      return { ...result, delta };
    });
    const best = variants
      .filter((variant) => variant.contractPassed)
      .reduce((winner, variant) => variant.score > winner.score ? variant : winner, {
        delta: 0,
        score: baseline.score,
        contractPassed: baseline.contractPassed,
      });
    rows.push({
      spec: specName,
      seed,
      baselineScore: baseline.score,
      weakGap: weak.index,
      weakSse: weak.sse,
      variants,
      bestDelta: best.delta,
      bestScore: best.score,
    });
    console.error(
      `  ${specName}/s${seed}: ${baseline.score.toFixed(2)} -> ${best.score.toFixed(2)} ` +
        `(${best.delta}deg) ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}

const lifts = rows.map((row) => row.bestScore - row.baselineScore);
const result = {
  budget,
  specs,
  seeds,
  deltas,
  summary: {
    rows: rows.length,
    improved: lifts.filter((lift) => lift > 1e-9).length,
    meanLift: lifts.reduce((sum, lift) => sum + lift, 0) / Math.max(1, lifts.length),
    maxLift: Math.max(0, ...lifts),
    validVariants: rows.reduce(
      (sum, row) => sum + row.variants.filter((variant) => variant.contractPassed).length,
      0,
    ),
  },
  rows,
};
console.log(JSON.stringify(result.summary, null, 2));
if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`rows -> ${outPath}`);
}
