/** Public compiler routing and compatibility APIs.
 * Ordinary supported WASM requests use coherent normal arcs. The legacy prefix
 * search remains available for other axes, reference engines and diagnostic
 * options. Existing requests retain exactly the same routing conditions.
 */
import { FPS, type Spec } from "../types.ts";
import type { CompileCheckpoint } from "./types.ts";
import { compileConnectedArcs } from "./connected_arcs.ts";
import { normalizeCompilerTimeline, validateCompilerTelemetry } from "./compiler_input.ts";
import { compileLegacyHandoff, compileHandoffFromSnapshot,
  type CompileHandoffOptions, type HandoffNodeSnapshot } from "./legacy_handoff.ts";

// Preserve diagnostic and snapshot imports used by existing studies. New studies
// of the old search should import legacy_handoff.ts explicitly.
export * from "./legacy_handoff.ts";

export function handoffBackend(userSpec: Spec, opts: CompileHandoffOptions): "arcs" | "legacy" {
  return (process.env.LR_ENGINE ?? "wasm") === "wasm" &&
    Object.entries(opts).every(([key, value]) => value === undefined || key === "budget" || key === "budgetTelemetry") &&
    Object.keys(userSpec.axes).every(axis => ["air", "speed", "amplitude"].includes(axis)) &&
    userSpec.contacts.length > 0 && userSpec.contacts.every(c => Math.round(c.t * FPS) >= 6) &&
    opts.budget > 4 * (Math.round(userSpec.duration * FPS) + 20) ? "arcs" : "legacy";
}

export function compileHandoff(userSpec: Spec, seed = 0, opts: CompileHandoffOptions): CompileCheckpoint {
  userSpec = normalizeCompilerTimeline(userSpec);
  validateCompilerTelemetry(opts.budgetTelemetry);
  return handoffBackend(userSpec, opts) === "arcs"
    ? compileConnectedArcs(userSpec, seed, opts)
    : compileLegacyHandoff(userSpec, seed, opts);
}

/** Build a budget->checkpoint curve as N INDEPENDENT full runs from scratch (no
 *  anytime sharing) — the single place that defines "a curve is one compile per
 *  budget, merging the shared opts". `runOne` is the per-budget compile call. */
function budgetCurve(
  budgets: number[],
  opts: Omit<CompileHandoffOptions, "budget">,
  runOne: (o: CompileHandoffOptions) => CompileCheckpoint,
): CompileCheckpoint[] {
  return budgets.map((budget) => runOne({ ...opts, budget }));
}

/** Diagnostic helper: a budget->checkpoint curve as N independent `compileHandoff` runs. */
export function compileBudgetCurve(
  userSpec: Spec,
  seed: number,
  budgets: number[],
  opts: Omit<CompileHandoffOptions, "budget"> = {},
): CompileCheckpoint[] {
  return budgetCurve(budgets, opts, (o) => compileHandoff(userSpec, seed, o));
}

/** Snapshot-resumed variant of `compileBudgetCurve` (N independent suffix runs). */
export function compileBudgetCurveFromSnapshot(
  userSpec: Spec,
  seed: number,
  snapshot: HandoffNodeSnapshot,
  budgets: number[],
  opts: Omit<CompileHandoffOptions, "budget"> = {},
): CompileCheckpoint[] {
  return budgetCurve(budgets, opts, (o) => compileHandoffFromSnapshot(userSpec, seed, snapshot, o));
}

/** Find the checkpoint for `budget` in a `compileBudgetCurve*` result; throws if
 *  absent. Shared by the diagnostic oracle/probe scripts. */
export function checkpointAt(curve: CompileCheckpoint[], budget: number): CompileCheckpoint {
  const found = curve.find((c) => c.budget === budget);
  if (found === undefined) throw new Error(`missing checkpoint for budget ${budget}`);
  return found;
}
