/**
 * Is the impact undershoot a MAGNITUDE failure or a DEADLINE failure?
 *
 * [SUPERSEDED PREMISE — 2026-07-31: the scored impact is now the CONTACTED-frame
 * path integral `contactRedirArcPxAtLanding`. This study still measures the
 * endpoint (net) form below, so read it as a DEADLINE diagnostic for the legacy
 * metric, not as the production ruler.]
 *
 * The pre-promotion scored impact was endpoint-to-endpoint, not a path integral
 * (`substrate.ts contactRedirArcPxAtLanding`):
 *
 *   impact = |v(landing-1)| * |wrapPi( angle(v(landing+W)) - angle(v(landing-1)) )|
 *
 * `turn` is ASSIGNED inside the loop, not accumulated, so only the heading at
 * the deadline frame counts. Whatever the trajectory does between the contact
 * and `landing+W` is invisible — including a turn that is achieved and then
 * given back. And gravity gives it back: every airborne frame inside the window
 * adds `g` to the downward velocity, which rotates the heading back toward the
 * incoming one at roughly `atan(g/|v|)` per frame.
 *
 * So a contact that under-delivers is under-delivering for one of two reasons,
 * and they want opposite fixes:
 *
 *   MAGNITUDE  the geometry never produces the turn      -> turn harder
 *   DEADLINE   it produces it and loses it before +W     -> hold contact longer
 *
 * This measures the split directly: per authored contact it records the turn at
 * every frame of the window, the maximum reached, the value at the deadline, and
 * how much of the window the rider spends airborne. It re-simulates the final
 * committed track once per compile — no search, no hot path.
 *
 *   npm run study:impact-window -- --sources=dense_dialogue,sparse_lowline \
 *     --budget=250000 --seeds=0,1
 */
import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { detect, extractRawTrajectory } from "../lib/detector.ts";
import { applyJolt } from "../produce/seed.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import {
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
import { IMPACT_WINDOW, normImpact, secToFrame, wrapPi } from "./types.ts";

const DEG = 180 / Math.PI;

type ContactRow = {
  sourceId: string;
  seed: number;
  ask: number;
  speedIn: number;
  /** Angle between the touched surface and the arrival heading (deg). */
  incidenceDeg: number;
  /** Line length remaining ahead of the rider on the touched surface (px). */
  contactRunPx: number;
  /** |wrapPi(heading(f) - heading(landing-1))| for f in [landing, landing+W]. */
  turnByFrame: number[];
  airborneByFrame: boolean[];
  endTurn: number;
  maxTurn: number;
  maxFrameOffset: number;
  achieved: number;
  /** What the score would have been had the maximum been held to the deadline. */
  achievableAtMax: number;
};

function argument(argv: string[], name: string): string | undefined {
  return argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function contactRows(
  sourceId: string,
  seed: number,
  budget: number,
  manifestPath: string,
): Promise<ContactRow[]> {
  return (async () => {
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

    const rows: ContactRow[] = [];
    for (const contact of spec.contacts) {
      if (contact.impact === undefined) continue;
      const targetFrame = secToFrame(contact.t);
      const landing = findAuthoredContactNearFrame(det, targetFrame, 1);
      if (landing === undefined) continue;
      const v0 = velocityAt(det, landing.frame - 1) ?? velocityAt(det, landing.frame);
      if (v0 === undefined) continue;
      const speedIn = Math.hypot(v0.x, v0.y);
      if (speedIn <= 1e-9) continue;
      const aIn = Math.atan2(v0.y, v0.x);

      const turnByFrame: number[] = [];
      const airborneByFrame: boolean[] = [];
      const end = Math.min(last, landing.frame + IMPACT_WINDOW);
      for (let f = landing.frame; f <= end; f++) {
        const v = velocityAt(det, f);
        if (v === undefined) continue;
        turnByFrame.push(Math.abs(wrapPi(Math.atan2(v.y, v.x) - aIn)));
        airborneByFrame.push(airborneAt(det, f) === true);
      }
      if (turnByFrame.length === 0) continue;
      const endTurn = turnByFrame[turnByFrame.length - 1];
      let maxTurn = turnByFrame[0];
      let maxFrameOffset = 0;
      for (const [index, turn] of turnByFrame.entries()) {
        if (turn > maxTurn) {
          maxTurn = turn;
          maxFrameOffset = index;
        }
      }
      /*
       * The surface the rider actually met, and how it was oriented against the
       * velocity that met it. A catch can only redirect what it intercepts: a
       * line lying along the incoming velocity passes the rider through, a line
       * across it turns the rider. `incidenceDeg` is that angle, signed away
       * from the arrival heading, and `contactRunPx` is how much line the rider
       * had ahead of it on that surface.
       */
      const lineIds = det.measurements.contactLineIds[landing.frame] ?? [];
      let incidenceDeg = NaN;
      let contactRunPx = NaN;
      if (lineIds.length > 0) {
        const line = track.lines.find((candidate) => candidate.id === lineIds[0]);
        if (line !== undefined) {
          const surface = Math.atan2(line.y2 - line.y1, line.x2 - line.x1);
          incidenceDeg = Math.abs(wrapPi(surface - aIn)) * DEG;
          const here = positionAt(det, landing.frame);
          if (here !== undefined) {
            const along = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
            const used = Math.hypot(here.x - line.x1, here.y - line.y1);
            contactRunPx = Math.max(0, along - used);
          }
        }
      }
      rows.push({
        sourceId,
        seed,
        ask: contact.impact,
        speedIn,
        incidenceDeg,
        contactRunPx,
        turnByFrame,
        airborneByFrame,
        endTurn,
        maxTurn,
        maxFrameOffset,
        achieved: normImpact(speedIn * endTurn),
        achievableAtMax: normImpact(speedIn * maxTurn),
      });
    }
    return rows;
  })();
}

function mean(values: number[]): number {
  return values.length === 0 ? NaN : values.reduce((sum, v) => sum + v, 0) / values.length;
}

async function main(argv = process.argv.slice(2)): Promise<void> {
  const sourceIds = (argument(argv, "sources") ?? "dense_dialogue,sparse_lowline")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const seeds = (argument(argv, "seeds") ?? "0").split(",").map(Number);
  const budget = Number(argument(argv, "budget") ?? 250_000);
  const manifestPath = argument(argv, "manifest") ??
    "benchmark/v2/compat/source-manifest.json";

  const rows: ContactRow[] = [];
  for (const sourceId of sourceIds) {
    for (const seed of seeds) {
      const produced = await contactRows(sourceId, seed, budget, manifestPath);
      rows.push(...produced);
      console.error(`  ${sourceId} seed ${seed}: ${produced.length} scored contacts`);
    }
  }
  if (rows.length === 0) throw new Error(`no scored contacts`);

  const report = (label: string, subset: ContactRow[]): void => {
    if (subset.length === 0) return;
    const askMean = mean(subset.map((r) => r.ask));
    const achieved = mean(subset.map((r) => r.achieved));
    const atMax = mean(subset.map((r) => r.achievableAtMax));
    const giveBack = mean(subset.map((r) => r.achievableAtMax - r.achieved));
    const airShare = mean(subset.map((r) =>
      r.airborneByFrame.filter(Boolean).length / r.airborneByFrame.length
    ));
    const heldToDeadline = subset.filter((r) => r.maxFrameOffset >= r.turnByFrame.length - 1).length;
    console.log(
      `${label.padEnd(30)} n=${String(subset.length).padStart(5)}  ` +
        `ask ${askMean.toFixed(3)}  achieved ${achieved.toFixed(3)}  ` +
        `at-max ${atMax.toFixed(3)}  give-back ${giveBack.toFixed(3)}  ` +
        `airborne-in-window ${(airShare * 100).toFixed(0)}%  ` +
        `peak-at-deadline ${(heldToDeadline / subset.length * 100).toFixed(0)}%  ` +
        `endTurn ${(mean(subset.map((r) => r.endTurn)) * DEG).toFixed(1)}deg  ` +
        `maxTurn ${(mean(subset.map((r) => r.maxTurn)) * DEG).toFixed(1)}deg`,
    );
  };

  console.log(`\nimpact window W=${IMPACT_WINDOW}, budget ${budget}, ${rows.length} contacts\n`);
  report("ALL", rows);
  console.log("");
  for (const [lo, hi] of [[0, 0.2], [0.2, 0.45], [0.45, 0.65], [0.65, 1.01]] as const) {
    report(`ask ${lo.toFixed(2)}-${hi.toFixed(2)}`, rows.filter((r) => r.ask >= lo && r.ask < hi));
  }
  console.log("");
  for (const sourceId of sourceIds) report(sourceId, rows.filter((r) => r.sourceId === sourceId));

  console.log("\nturn (deg) by frame offset from the landing, mean over all contacts:");
  for (let offset = 0; offset <= IMPACT_WINDOW; offset++) {
    const present = rows.filter((r) => r.turnByFrame.length > offset);
    if (present.length === 0) continue;
    const turn = mean(present.map((r) => r.turnByFrame[offset])) * DEG;
    const air = mean(present.map((r) => (r.airborneByFrame[offset] ? 1 : 0))) * 100;
    console.log(
      `  +${offset}  turn ${turn.toFixed(2).padStart(6)}deg   airborne ${air.toFixed(0).padStart(3)}%   n=${present.length}`,
    );
  }

  const grounded = rows.filter((r) => !r.airborneByFrame.some(Boolean));
  const anyAir = rows.filter((r) => r.airborneByFrame.some(Boolean));
  console.log("");
  report("supported through window", grounded);
  report("airborne somewhere inside", anyAir);

  /*
   * WHY the rider separates. Two candidates with opposite fixes: the
   * post-contact line RAN OUT (fix = longer ride) or the surface curved away
   * beneath the rider (fix = a shallower post-contact branch). The distance
   * travelled along the surface before separation discriminates them, because
   * the sampled ride-out is 28-220px: separations clustered near the far end of
   * that range are the line ending, separations at 10-40px are not.
   */
  console.log("\nseparation: first airborne frame offset, and distance travelled by then");
  const separations = rows.filter((r) => r.airborneByFrame.some(Boolean));
  const byOffset = new Map<number, ContactRow[]>();
  for (const row of separations) {
    const offset = row.airborneByFrame.findIndex(Boolean);
    byOffset.set(offset, [...(byOffset.get(offset) ?? []), row]);
  }
  for (const offset of [...byOffset.keys()].sort((a, b) => a - b)) {
    const subset = byOffset.get(offset)!;
    const distance = mean(subset.map((r) => r.speedIn * offset));
    console.log(
      `  +${offset}  n=${String(subset.length).padStart(4)}  ` +
        `distance ${distance.toFixed(1).padStart(6)}px  ` +
        `achieved ${mean(subset.map((r) => r.achieved)).toFixed(3)}  ` +
        `ask ${mean(subset.map((r) => r.ask)).toFixed(3)}`,
    );
  }
  /*
   * Does an EARLY turn survive to the deadline? The metric requires no contact —
   * only that the heading at +W differs from the heading at -1. A rider that is
   * fully redirected at +2 and then flies loses only what gravity unwinds, which
   * is `g / |v|` per airborne frame, about 1 degree at ordinary speeds. If that
   * is what happens, "turn sharply then launch" beats "hold on and keep
   * turning", and the six-frame window stops competing with the gap's flight.
   */
  console.log("\nturn AFTER separation, by the frame the rider left the surface:");
  for (const offset of [...byOffset.keys()].sort((a, b) => a - b)) {
    const subset = byOffset.get(offset)!;
    if (subset.length < 8) continue;
    const trail = [];
    for (let f = offset; f <= IMPACT_WINDOW; f++) {
      const present = subset.filter((r) => r.turnByFrame.length > f);
      if (present.length === 0) break;
      trail.push(`+${f} ${(mean(present.map((r) => r.turnByFrame[f])) * DEG).toFixed(1)}`);
    }
    const drift = (() => {
      const present = subset.filter((r) => r.turnByFrame.length > IMPACT_WINDOW);
      if (present.length === 0) return NaN;
      const perFrame = present.map((r) =>
        (r.turnByFrame[IMPACT_WINDOW] - r.turnByFrame[offset]) / Math.max(1, IMPACT_WINDOW - offset)
      );
      return mean(perFrame) * DEG;
    })();
    console.log(
      `  left at +${offset} (n=${String(subset.length).padStart(3)}):  ${trail.join("  ")}` +
        `   -> ${drift >= 0 ? "+" : ""}${drift.toFixed(2)}deg/frame after leaving`,
    );
  }

  const glancing = rows.filter((r) => {
    const left = r.airborneByFrame.findIndex(Boolean);
    return left >= 0 && left <= 3;
  });
  const engaged = rows.filter((r) => {
    const left = r.airborneByFrame.findIndex(Boolean);
    return left < 0 || left >= 4;
  });
  const withIncidence = (subset: ContactRow[]): ContactRow[] =>
    subset.filter((r) => Number.isFinite(r.incidenceDeg));
  console.log("\nGLANCING (left by +3) vs ENGAGED, by contact geometry:");
  for (const [label, subset] of [["glancing", glancing], ["engaged", engaged]] as const) {
    const usable = withIncidence(subset);
    if (usable.length === 0) continue;
    console.log(
      `  ${label.padEnd(9)} n=${String(usable.length).padStart(4)}  ` +
        `incidence ${mean(usable.map((r) => r.incidenceDeg)).toFixed(2).padStart(6)}deg  ` +
        `run-ahead ${mean(usable.map((r) => r.contactRunPx)).toFixed(1).padStart(6)}px  ` +
        `ask ${mean(usable.map((r) => r.ask)).toFixed(3)}  ` +
        `achieved ${mean(usable.map((r) => r.achieved)).toFixed(3)}  ` +
        `speed ${mean(usable.map((r) => r.speedIn)).toFixed(2)}`,
    );
  }

  console.log("\nincidence vs engagement WITHIN an ask band (controls for carrier pressure):");
  for (const [lo, hi] of [[0.20, 0.35], [0.35, 0.50], [0.50, 0.70], [0.70, 1.01]] as const) {
    const band = rows.filter((r) => r.ask >= lo && r.ask < hi && Number.isFinite(r.incidenceDeg));
    if (band.length < 12) continue;
    const g = band.filter((r) => {
      const left = r.airborneByFrame.findIndex(Boolean);
      return left >= 0 && left <= 3;
    });
    const e = band.filter((r) => {
      const left = r.airborneByFrame.findIndex(Boolean);
      return left < 0 || left >= 4;
    });
    if (g.length < 4 || e.length < 4) continue;
    console.log(
      `  ask ${lo.toFixed(2)}-${hi.toFixed(2)}  ` +
        `glancing n=${String(g.length).padStart(3)} incidence ${mean(g.map((r) => r.incidenceDeg)).toFixed(2).padStart(5)}deg achieved ${mean(g.map((r) => r.achieved)).toFixed(3)}  |  ` +
        `engaged n=${String(e.length).padStart(3)} incidence ${mean(e.map((r) => r.incidenceDeg)).toFixed(2).padStart(5)}deg achieved ${mean(e.map((r) => r.achieved)).toFixed(3)}`,
    );
  }

  const separationDistance = separations.map((r) =>
    r.speedIn * r.airborneByFrame.findIndex(Boolean)
  );
  separationDistance.sort((a, b) => a - b);
  const quantile = (q: number): number =>
    separationDistance[Math.min(separationDistance.length - 1, Math.floor(q * separationDistance.length))];
  console.log(
    `  distance travelled before separation: p10 ${quantile(0.1).toFixed(0)}px  ` +
      `p50 ${quantile(0.5).toFixed(0)}px  p90 ${quantile(0.9).toFixed(0)}px  ` +
      `(sampled ride-out range is 28-220px)`,
  );
}

await main();
