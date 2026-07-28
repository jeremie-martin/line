/**
 * What does the rider RIDE during the six frames the impact metric can see?
 *
 * `study_impact_window` established that the scored turn is still climbing at
 * the deadline, that 32% of contacts are airborne by then, and that supported
 * contacts deliver 25% more impact for the same ask. It did not establish WHY
 * the rider leaves, and the two candidate causes want opposite geometry:
 *
 *   DROP-AWAY   the branch rotates toward the launch angle inside the window,
 *               so the surface curves down from under a rider that is still
 *               travelling along the angle it was caught at  -> rotate later
 *   EJECTION    the catch throws the rider off a surface that is still rising
 *               beneath it                                    -> turn softer
 *
 * They are distinguishable from the geometry alone: at the frame the rider
 * separates, compare the surface angle AHEAD of it with the surface angle it
 * was riding. A branch that has rotated DOWNWARD (larger angle, +y is down) is
 * dropping away; one that has rotated UPWARD is rising into the rider.
 *
 * Per authored impact contact this records the surface the rider is on at every
 * window frame, the branch's angle profile over the deadline distance
 * (`IMPACT_WINDOW * speed`, the only surface the metric can see), the frame it
 * separates, and the turn it had accrued by then.
 *
 *   npm exec tsx scripts/v0/study_impact_branch.ts -- \
 *     --sources=dense_dialogue,sparse_lowline --budget=250000 --seeds=0
 */
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { detect, extractRawTrajectory } from "../lib/detector.ts";
import { applyJolt } from "../produce/seed.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import {
  axesAtFrame,
  findAuthoredContactNearFrame,
  measurementLastFrame,
  positionAt,
  velocityAt,
  airborneAt,
} from "./core/substrate.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
} from "./benchmark_v2/model.ts";
import {
  authoredSpeedToPx,
  IMPACT_WINDOW,
  normImpact,
  secToFrame,
  wrapPi,
  type TrackLine,
} from "./types.ts";

const DEG = 180 / Math.PI;

type Row = {
  sourceId: string;
  seed: number;
  ask: number;
  speedIn: number;
  arrivalDeg: number;
  /** Surface angle of the line met at the landing frame (deg, +y down). */
  contactSurfaceDeg: number;
  incidenceDeg: number;
  /** Surface angle the branch reaches after the deadline distance. */
  deadlineSurfaceDeg: number;
  /** Surface angle at the end of the whole branch the rider is on. */
  branchEndSurfaceDeg: number;
  /** Length of contiguous branch ahead of the contact point (px). */
  branchAheadPx: number;
  deadlinePx: number;
  /** Arrival speed less the authored speed ask of the gap being ridden (px/frame). */
  speedSurplusPx: number;
  /** First window frame with no support, or -1 when supported throughout. */
  separationFrame: number;
  turnAtSeparation: number;
  turnByFrame: number[];
  supportedByFrame: boolean[];
  surfaceDegByFrame: number[];
  endTurn: number;
  achieved: number;
};

function argument(argv: string[], name: string): string | undefined {
  return argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function lineAngleDeg(line: TrackLine): number {
  return Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * DEG;
}

function lineLength(line: TrackLine): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

/**
 * The contiguous surface ahead of a point: successive lines whose start is the
 * previous line's end. The sampler emits each arc branch as exactly such a
 * chain, so this walks the branch the rider is riding without needing ids.
 */
function branchAhead(
  lines: readonly TrackLine[],
  start: TrackLine,
): TrackLine[] {
  const chain = [start];
  let tipX = start.x2;
  let tipY = start.y2;
  for (let guard = 0; guard < 64; guard++) {
    const next = lines.find((line) =>
      line !== chain[chain.length - 1] &&
      Math.abs(line.x1 - tipX) < 1e-6 && Math.abs(line.y1 - tipY) < 1e-6
    );
    if (next === undefined) break;
    chain.push(next);
    tipX = next.x2;
    tipY = next.y2;
  }
  return chain;
}

function surfaceDegAtDistance(chain: readonly TrackLine[], distancePx: number): number {
  let walked = 0;
  for (const line of chain) {
    walked += lineLength(line);
    if (walked >= distancePx) return lineAngleDeg(line);
  }
  return lineAngleDeg(chain[chain.length - 1]);
}

async function rowsFor(
  sourceId: string,
  seed: number,
  budget: number,
  manifestPath: string,
): Promise<Row[]> {
  const sources = resolveSources(loadSourceManifest(manifestPath));
  const source = sources.find((entry) => entry.id === sourceId);
  if (source === undefined) throw new Error(`${sourceId}: not in the source manifest`);
  const spec = applyJolt(await loadSourceSpec(source), -15);
  const { track } = compileHandoff(spec, seed, { budget });

  // deno-lint-ignore no-explicit-any
  let engine: any = new LineRiderEngine().setStart(
    track.startPosition,
    track.riders[0].startVelocity,
  );
  for (const line of track.lines) engine = engine.addLine(createLineFromJson(line));
  const det = detect(extractRawTrajectory(engine, track.duration));
  const last = measurementLastFrame(det);
  const byId = new Map(track.lines.map((line) => [line.id, line]));

  const rows: Row[] = [];
  for (const contact of spec.contacts) {
    if (contact.impact === undefined) continue;
    const landing = findAuthoredContactNearFrame(det, secToFrame(contact.t), 1);
    if (landing === undefined) continue;
    const v0 = velocityAt(det, landing.frame - 1) ?? velocityAt(det, landing.frame);
    if (v0 === undefined) continue;
    const speedIn = Math.hypot(v0.x, v0.y);
    if (speedIn <= 1e-9) continue;
    const aIn = Math.atan2(v0.y, v0.x);

    const contactIds = det.measurements.contactLineIds[landing.frame] ?? [];
    const contactLine = contactIds.length > 0 ? byId.get(contactIds[0]) : undefined;
    if (contactLine === undefined) continue;
    const chain = branchAhead(track.lines, contactLine);
    const here = positionAt(det, landing.frame);
    const usedPx = here === undefined
      ? 0
      : Math.hypot(here.x - contactLine.x1, here.y - contactLine.y1);
    const branchAheadPx = chain.reduce((sum, line) => sum + lineLength(line), 0) - usedPx;
    const deadlinePx = IMPACT_WINDOW * speedIn;

    const turnByFrame: number[] = [];
    const supportedByFrame: boolean[] = [];
    const surfaceDegByFrame: number[] = [];
    const end = Math.min(last, landing.frame + IMPACT_WINDOW);
    for (let f = landing.frame; f <= end; f++) {
      const v = velocityAt(det, f);
      if (v === undefined) continue;
      turnByFrame.push(Math.abs(wrapPi(Math.atan2(v.y, v.x) - aIn)) * DEG);
      supportedByFrame.push(airborneAt(det, f) !== true);
      const ids = det.measurements.contactLineIds[f] ?? [];
      const line = ids.length > 0 ? byId.get(ids[0]) : undefined;
      surfaceDegByFrame.push(line === undefined ? NaN : lineAngleDeg(line));
    }
    if (turnByFrame.length === 0) continue;
    const separationFrame = supportedByFrame.findIndex((supported) => !supported);
    rows.push({
      sourceId,
      seed,
      ask: contact.impact,
      speedIn,
      arrivalDeg: aIn * DEG,
      contactSurfaceDeg: lineAngleDeg(contactLine),
      incidenceDeg: Math.abs(wrapPi(lineAngleDeg(contactLine) / DEG - aIn)) * DEG,
      speedSurplusPx: (() => {
        const authored = axesAtFrame(landing.frame, spec).speed;
        return authored === undefined ? NaN : speedIn - authoredSpeedToPx(authored);
      })(),
      deadlineSurfaceDeg: surfaceDegAtDistance(chain, usedPx + deadlinePx),
      branchEndSurfaceDeg: lineAngleDeg(chain[chain.length - 1]),
      branchAheadPx,
      deadlinePx,
      separationFrame,
      turnAtSeparation: separationFrame < 0 ? NaN : turnByFrame[separationFrame],
      turnByFrame,
      supportedByFrame,
      surfaceDegByFrame,
      endTurn: turnByFrame[turnByFrame.length - 1],
      achieved: normImpact(speedIn * turnByFrame[turnByFrame.length - 1] / DEG),
    });
  }
  return rows;
}

const mean = (values: number[]): number => {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length === 0 ? NaN : clean.reduce((sum, v) => sum + v, 0) / clean.length;
};

function report(label: string, subset: Row[]): void {
  if (subset.length === 0) return;
  console.log(
    `${label.padEnd(28)} n=${String(subset.length).padStart(4)}` +
      `  ask ${mean(subset.map((r) => r.ask)).toFixed(3)}` +
      `  achieved ${mean(subset.map((r) => r.achieved)).toFixed(3)}` +
      `  vIn ${mean(subset.map((r) => r.speedIn)).toFixed(2)}` +
      `  surplus ${mean(subset.map((r) => r.speedSurplusPx)).toFixed(2)}` +
      `  turn ${mean(subset.map((r) => r.endTurn)).toFixed(2)}deg` +
      `  incid ${mean(subset.map((r) => r.incidenceDeg)).toFixed(2)}` +
      `  rotate-to-deadline ${
        mean(subset.map((r) => r.deadlineSurfaceDeg - r.contactSurfaceDeg)).toFixed(2)
      }` +
      `  rotate-to-end ${
        mean(subset.map((r) => r.branchEndSurfaceDeg - r.contactSurfaceDeg)).toFixed(2)
      }` +
      `  ahead/deadline ${
        mean(subset.map((r) => r.branchAheadPx / r.deadlinePx)).toFixed(2)
      }` +
      `  sep@ ${mean(subset.map((r) => r.separationFrame < 0 ? IMPACT_WINDOW + 1 : r.separationFrame)).toFixed(2)}`,
  );
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const sourceIds = (argument(argv, "sources") ?? "dense_dialogue,sparse_lowline")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const seeds = (argument(argv, "seeds") ?? "0").split(",").map(Number);
  const budget = Number(argument(argv, "budget") ?? 250_000);
  const manifestPath = argument(argv, "manifest") ??
    "benchmark/v2/compat/source-manifest.json";

  const rows: Row[] = [];
  for (const sourceId of sourceIds) {
    for (const seed of seeds) {
      const produced = await rowsFor(sourceId, seed, budget, manifestPath);
      rows.push(...produced);
      console.error(`  ${sourceId} seed ${seed}: ${produced.length} scored contacts`);
    }
  }
  if (rows.length === 0) throw new Error(`no scored contacts`);

  console.log(`\n=== ${rows.length} scored contacts ===\n`);
  report("all", rows);

  console.log(`\n-- by separation frame --`);
  for (let frame = 0; frame <= IMPACT_WINDOW; frame++) {
    report(`separates at +${frame}`, rows.filter((r) => r.separationFrame === frame));
  }
  report("never separates", rows.filter((r) => r.separationFrame < 0));

  console.log(`\n-- by branch rotation over the deadline distance --`);
  const bands: Array<[string, (r: Row) => boolean]> = [
    ["rotates up   < -6", (r) => r.deadlineSurfaceDeg - r.contactSurfaceDeg < -6],
    ["rotates up  -6..-2", (r) => {
      const d = r.deadlineSurfaceDeg - r.contactSurfaceDeg;
      return d >= -6 && d < -2;
    }],
    ["flat       -2..+2", (r) => {
      const d = r.deadlineSurfaceDeg - r.contactSurfaceDeg;
      return d >= -2 && d <= 2;
    }],
    ["rotates down +2..+6", (r) => {
      const d = r.deadlineSurfaceDeg - r.contactSurfaceDeg;
      return d > 2 && d <= 6;
    }],
    ["rotates down   > +6", (r) => r.deadlineSurfaceDeg - r.contactSurfaceDeg > 6],
  ];
  for (const [label, predicate] of bands) report(label, rows.filter(predicate));

  console.log(`\n-- by arrival speed against the gap's authored ask --`);
  const surplusBands: Array<[string, number, number]> = [
    ["surplus < -1.0", -Infinity, -1.0],
    ["surplus -1.0..-0.3", -1.0, -0.3],
    ["surplus -0.3..+0.3", -0.3, 0.3],
    ["surplus +0.3..+1.0", 0.3, 1.0],
    ["surplus > +1.0", 1.0, Infinity],
  ];
  for (const [label, lo, hi] of surplusBands) {
    report(label, rows.filter((r) => r.speedSurplusPx >= lo && r.speedSurplusPx < hi));
  }

  console.log(`\n-- surplus within one ask band (0.20..0.45), the control --`);
  const midRows = rows.filter((r) => r.ask >= 0.2 && r.ask <= 0.45);
  for (const [label, lo, hi] of surplusBands) {
    report(`mid ${label}`, midRows.filter((r) => r.speedSurplusPx >= lo && r.speedSurplusPx < hi));
  }
  console.log(`\n-- surplus within one ask band (0.45..0.75) --`);
  const highRows = rows.filter((r) => r.ask > 0.45 && r.ask <= 0.75);
  for (const [label, lo, hi] of surplusBands) {
    report(`high ${label}`, highRows.filter((r) => r.speedSurplusPx >= lo && r.speedSurplusPx < hi));
  }

  console.log(`\n-- by whether the branch reaches the deadline distance --`);
  report("branch shorter", rows.filter((r) => r.branchAheadPx < r.deadlinePx));
  report("branch reaches", rows.filter((r) => r.branchAheadPx >= r.deadlinePx));

  console.log(`\n-- mid-band asks only (0.20..0.45) --`);
  const mid = rows.filter((r) => r.ask >= 0.2 && r.ask <= 0.45);
  report("mid all", mid);
  for (const [label, predicate] of bands) report(`mid ${label}`, mid.filter(predicate));

  console.log(`\n-- per-frame means (turn deg / supported share / surface deg) --`);
  for (let index = 0; index <= IMPACT_WINDOW; index++) {
    const turn = mean(rows.map((r) => r.turnByFrame[index] ?? NaN));
    const supported = mean(
      rows.map((r) =>
        r.supportedByFrame[index] === undefined ? NaN : (r.supportedByFrame[index] ? 1 : 0)
      ),
    );
    const surface = mean(rows.map((r) => r.surfaceDegByFrame[index] ?? NaN));
    console.log(
      `  +${index}  turn ${turn.toFixed(2)}  supported ${(supported * 100).toFixed(0)}%` +
        `  surface ${surface.toFixed(2)}`,
    );
  }
}

await main();
