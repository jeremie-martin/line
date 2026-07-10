/** Exact post-compile oracle for a bounded edit at the weakest gap. */
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
const mode = argValue("mode") ?? "pitch";
if (
  mode !== "pitch" &&
  mode !== "parent-pitch" &&
  mode !== "parent-pitch-sweep" &&
  mode !== "contact-pitch" &&
  mode !== "contact-normal" &&
  mode !== "contact-normal-all" &&
  mode !== "contact-normal-sweep" &&
  mode !== "entry-accel"
) {
  throw new Error(`unknown mode "${mode}"`);
}

for (const spec of specs) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) throw new Error(`unknown spec "${spec}"`);
}

type Track = {
  startPosition?: { x: number; y: number };
  riders?: Array<{ startVelocity?: { x: number; y: number } }>;
  lines?: TrackLine[];
};

type Variant = {
  delta: number;
  score: number;
  contractPassed: boolean;
  targetLineId?: number;
  targetGap?: number;
};
type Row = {
  spec: GoldenSpecName;
  seed: number;
  baselineScore: number;
  weakGap: number;
  weakSse: number;
  variants: Variant[];
  acceptedEdits?: Variant[];
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

function pitchLine(line: TrackLine, degrees: number): TrackLine {
  const pivot = { x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 };
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotate = (x: number, y: number): [number, number] => {
    const dx = x - pivot.x;
    const dy = y - pivot.y;
    return [pivot.x + dx * cos - dy * sin, pivot.y + dx * sin + dy * cos];
  };
  const [x1, y1] = rotate(line.x1, line.y1);
  const [x2, y2] = rotate(line.x2, line.y2);
  return { ...line, x1, y1, x2, y2 };
}

function shiftLineNormal(line: TrackLine, pixels: number): TrackLine {
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { ...line };
  const shiftX = -dy / length * pixels;
  const shiftY = dx / length * pixels;
  return {
    ...line,
    x1: line.x1 + shiftX,
    y1: line.y1 + shiftY,
    x2: line.x2 + shiftX,
    y2: line.y2 + shiftY,
  };
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
    const impact = gap.axes.impact;
    const sse = mode === "entry-accel"
      ? impact !== undefined && impact.achieved < impact.target ? impact.error * impact.error : -Infinity
      : Object.values(gap.axes).reduce((sum, value) => sum + value.error * value.error, 0);
    return sse > worst.sse ? { index: gap.gap_index, sse } : worst;
  }, { index: -1, sse: -Infinity });
}

function accelerateLine(line: TrackLine): TrackLine {
  return {
    ...line,
    type: 2,
    x1: line.x2,
    y1: line.y2,
    x2: line.x1,
    y2: line.y1,
    flipped: !line.flipped,
    leftExtended: line.rightExtended,
    rightExtended: line.leftExtended,
  };
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
    const pitchGroup = mode === "parent-pitch"
      ? groups[offset + weak.index - 1]
      : weakGroup;
    if ((mode === "pitch" || mode === "parent-pitch") && pitchGroup === undefined) continue;

    const simulate = (candidateLines: TrackLine[]) => {
      let engine = new LineRiderEngine();
      engine = engine.setStart(
        track.startPosition ?? { x: 0, y: 0 },
        track.riders?.[0]?.startVelocity ?? { x: 0.4, y: 0 },
      );
      engine = engine.addLine(candidateLines.map(createLineFromJson));
      const det = detect(extractRawTrajectory(engine, durationFrames + 20));
      const candidateById = new Map(candidateLines.map((line) => [line.id, line]));
      const candidateFits = fits.map((fit) => fit === null
        ? null
        : { ...fit, lines: fit.lines.map((line) => candidateById.get(line.id) ?? line) });
      const report = buildDriftReport(
        det, spec, gaps, contactFrames, durationFrames, [], candidateFits, gapTargets,
      );
      const score = scoreDriftReport(report, { totalFrames: durationFrames });
      return {
        variant: { delta: 0, score: score.score, contractPassed: score.contract_passed },
        det,
      };
    };

    const baselineRun = simulate(lines);
    const baseline = baselineRun.variant;
    const acceptedEdits: Variant[] = [];
    let sweepBest: Variant | null = null;
    const variants = mode === "parent-pitch-sweep"
      ? (() => {
        const tested: Variant[] = [];
        let currentLines = [...lines];
        let currentBest: Variant = baseline;
        const gapOrder = checkpoint.report.gaps
          .map((gap) => ({
            index: gap.gap_index,
            sse: Object.values(gap.axes).reduce(
              (sum, value) => sum + value.error * value.error,
              0,
            ),
          }))
          .filter(({ index }) => index > 0)
          .sort((a, b) => b.sse - a.sse || a.index - b.index);
        for (const { index: gapIndex } of gapOrder) {
          const owner = gapIndex - 1;
          const currentById = new Map(currentLines.map((line) => [line.id, line]));
          const parentGroup = (groups[offset + owner] ?? [])
            .map((line) => currentById.get(line.id) ?? line);
          if (parentGroup.length === 0) continue;
          let winner: { variant: Variant; lines: TrackLine[] } | null = null;
          for (const delta of deltas) {
            const replacement = pitchExit(parentGroup, delta);
            const replacementById = new Map(replacement.map((line) => [line.id, line]));
            const candidateLines = currentLines.map(
              (line) => replacementById.get(line.id) ?? line,
            );
            const variant: Variant = {
              ...simulate(candidateLines).variant,
              delta,
              targetGap: owner,
            };
            tested.push(variant);
            if (
              variant.contractPassed &&
              variant.score > currentBest.score &&
              (winner === null || variant.score > winner.variant.score)
            ) {
              winner = { variant, lines: candidateLines };
            }
          }
          if (winner !== null) {
            currentBest = winner.variant;
            currentLines = winner.lines;
            acceptedEdits.push(winner.variant);
          }
        }
        sweepBest = currentBest;
        return tested;
      })()
      : mode === "contact-normal-sweep"
      ? (() => {
        const tested: Variant[] = [];
        let currentLines = [...lines];
        let currentRun = baselineRun;
        let currentBest: Variant = baseline;
        const gapOrder = checkpoint.report.gaps
          .map((gap) => ({
            index: gap.gap_index,
            sse: Object.values(gap.axes).reduce(
              (sum, value) => sum + value.error * value.error,
              0,
            ),
          }))
          .sort((a, b) => b.sse - a.sse || a.index - b.index);
        for (const { index: gapIndex } of gapOrder) {
          const contactIds = new Set(
            currentRun.det.measurements.contactLineIds[gaps[gapIndex].endFrame] ?? [],
          );
          const currentById = new Map(currentLines.map((line) => [line.id, line]));
          const targets = (groups[offset + gapIndex] ?? [])
            .flatMap((line) => contactIds.has(line.id) ? [currentById.get(line.id) ?? line] : []);
          let gapWinner: {
            variant: Variant;
            lines: TrackLine[];
            run: ReturnType<typeof simulate>;
          } | null = null;
          for (const target of targets) {
            for (const delta of deltas) {
              const replacement = shiftLineNormal(target, delta);
              const candidateLines = currentLines.map(
                (line) => line.id === target.id ? replacement : line,
              );
              const run = simulate(candidateLines);
              const variant: Variant = {
                ...run.variant,
                delta,
                targetLineId: target.id,
                targetGap: gapIndex,
              };
              tested.push(variant);
              if (
                variant.contractPassed &&
                variant.score > currentBest.score &&
                (gapWinner === null || variant.score > gapWinner.variant.score)
              ) {
                gapWinner = { variant, lines: candidateLines, run };
              }
            }
          }
          if (gapWinner !== null) {
            currentBest = gapWinner.variant;
            currentLines = gapWinner.lines;
            currentRun = gapWinner.run;
            acceptedEdits.push(gapWinner.variant);
          }
        }
        sweepBest = currentBest;
        return tested;
      })()
      : mode === "pitch" || mode === "parent-pitch"
      ? deltas.map((delta): Variant => {
        const replacement = pitchExit(pitchGroup!, delta);
        const replacementById = new Map(replacement.map((line) => [line.id, line]));
        const result = simulate(lines.map((line) => replacementById.get(line.id) ?? line)).variant;
        return {
          ...result,
          delta,
          targetGap: mode === "parent-pitch" ? weak.index - 1 : weak.index,
        };
      })
      : mode === "contact-pitch" || mode === "contact-normal" || mode === "contact-normal-all"
        ? (() => {
          const targetGaps = mode === "contact-normal-all"
            ? gaps.flatMap((gap) => gap.endsWithContact ? [gap.index] : [])
            : [weak.index];
          return targetGaps.flatMap((gapIndex) => {
            const contactIds = new Set(
              baselineRun.det.measurements.contactLineIds[gaps[gapIndex].endFrame] ?? [],
            );
            return (groups[offset + gapIndex] ?? [])
              .filter((line) => contactIds.has(line.id))
              .flatMap((target) => deltas.map((delta): Variant => {
                const replacement = mode === "contact-pitch"
                  ? pitchLine(target, delta)
                  : shiftLineNormal(target, delta);
                const result = simulate(
                  lines.map((line) => line.id === target.id ? replacement : line),
                ).variant;
                return { ...result, delta, targetLineId: target.id, targetGap: gapIndex };
              }));
          });
        })()
        : (() => {
          const contactIds = new Set(
            baselineRun.det.measurements.contactLineIds[gaps[weak.index].endFrame] ?? [],
          );
          const firedIndices = weakGroup.flatMap(
            (line, index) => contactIds.has(line.id) ? [index] : [],
          );
          const candidateIndices = [...new Set(firedIndices.flatMap((index) => [index - 1, index]))]
            .filter((index) => index >= 0 && weakGroup[index]?.type === 0);
          return candidateIndices.map((index): Variant => {
            const entry = weakGroup[index];
            const result = simulate(
              lines.map((line) => line.id === entry.id ? accelerateLine(line) : line),
            ).variant;
            return { ...result, delta: index - Math.min(...firedIndices) };
          });
        })();
    const best = sweepBest ?? variants
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
      ...(acceptedEdits.length === 0 ? {} : { acceptedEdits }),
      bestDelta: best.delta,
      bestScore: best.score,
    });
    console.error(
      `  ${specName}/s${seed}: ${baseline.score.toFixed(2)} -> ${best.score.toFixed(2)} ` +
        `(${best.delta}${mode.includes("normal") ? "px" : "deg"}` +
        `${best.targetLineId === undefined ? "" : `/line${best.targetLineId}`}` +
        `${best.targetGap === undefined ? "" : `/gap${best.targetGap}`}) ` +
        `${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  }
}

const lifts = rows.map((row) => row.bestScore - row.baselineScore);
const result = {
  budget,
  mode,
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
    acceptedEdits: rows.reduce((sum, row) => sum + (row.acceptedEdits?.length ?? 0), 0),
  },
  rows,
};
console.log(JSON.stringify(result.summary, null, 2));
if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`rows -> ${outPath}`);
}
