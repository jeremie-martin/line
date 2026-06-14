/**
 * Per-compile state lifecycle registry.
 *
 * The compiler keeps mutable per-compile state in module-level singletons —
 * telemetry accumulators, stat counters, memo caches. The determinism contract
 * (same spec + same seed ⇒ bit-identical output, regardless of prior compiles in
 * the same long-lived worker process) requires every one of these to be cleared
 * at the start of each compile.
 *
 * The fragile way to do that is a hand-maintained list of resetX() calls in
 * compileHandoffInternal: it silently drifts the moment someone adds a global and
 * forgets the call, and the failure is invisible (a non-reproducible golden
 * headline or a contaminated archive, not a crash). Instead, each owning module
 * registers its per-compile reset HERE — right next to the state it owns — via
 * `registerCompileReset`. `compileHandoffInternal` calls `resetPerCompileState()`
 * once at entry and the registry clears everything that registered.
 *
 * A module that is never imported into the compile path never runs its top-level
 * `registerCompileReset`, so it costs nothing until it is wired in — at which
 * point its reset joins the lifecycle automatically (this is the safety net for
 * latent modules like optimizer/reachability.ts, whose memo would otherwise leak
 * across compiles the day it is added to the search).
 *
 * Two rules for registered resets:
 *   1. Order-independent — each reset clears only the state its module owns, so
 *      the registry makes no ordering guarantee beyond module-load order.
 *   2. Per-compile only — process-scoped study aggregators that intentionally
 *      accumulate across compiles (e.g. the catchability-telemetry histogram in
 *      optimizer/readiness.ts) must NOT register here; they own their own reset.
 */

type CompileResetFn = () => void;

const compileResets: CompileResetFn[] = [];

/**
 * Register a per-compile reset. Call once at module load, beside the state it
 * clears. The function must zero/clear only the per-compile state its module
 * owns and must be safe to call repeatedly.
 */
export function registerCompileReset(reset: CompileResetFn): void {
  compileResets.push(reset);
}

/** Clear all registered per-compile state. Called once at compile entry. */
export function resetPerCompileState(): void {
  for (const reset of compileResets) reset();
}

/** Number of registered resets (diagnostic / tests). */
export function registeredCompileResetCount(): number {
  return compileResets.length;
}
