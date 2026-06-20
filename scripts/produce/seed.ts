/**
 * Compile + measure ONE seed — the single source of truth both `characterize`
 * and `produce` build on. Everything downstream (the distribution study, the
 * live gate) consumes the same {track, report, metrics} triple, so they can
 * never disagree on what a seed scored.
 *
 * This stage is pure CPU/WASM (compile + a one-pass trace re-sim): it is safe to
 * run inside a worker_thread. Rendering is NOT — it drives a real browser — so it
 * lives in render.ts on the main process.
 */
import { resolve } from "node:path";
import { compileHandoff } from "../v0/optimizer/handoff.ts";
import { extractTrace } from "../v0/core/trace.ts";
import { FPS, type Spec } from "../v0/types.ts";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";
import { measure, type SeedMetrics } from "./measure.ts";

// Felt-jolt beat alignment (production default, matches run.ts): the slam the
// viewer feels trails first contact by ~2-3 frames, so shifting every contact
// earlier puts the slam — not the touch — on the beat. LR_JOLT_OFFSET_MS
// overrides; 0 disables. This is an authoring-layer transform; the golden suite
// stays offset-free by calling compileHandoff directly.
export const JOLT_DEFAULT_MS = -15;

export function resolveJoltMs(): number {
  const raw = process.env.LR_JOLT_OFFSET_MS;
  const v = raw === undefined || raw === "" ? JOLT_DEFAULT_MS : Number(raw);
  return Number.isFinite(v) ? v : JOLT_DEFAULT_MS;
}

export function applyJolt(spec: Spec, ms: number): Spec {
  if (ms === 0) return spec;
  const floorS = K_BOUNCE_LANDING / FPS; // clamp to the earliest catchable contact
  return { ...spec, contacts: spec.contacts.map((c) => ({ ...c, t: Math.max(floorS, c.t - ms / 1000) })) };
}

export type RunSeedInput = { specPath: string; seed: number; budget: number; jolt: number };

/** Load the spec, apply the jolt, compile at `seed`/`budget`, trace it, and
 *  measure. Returns the full triple so callers can also persist the track. */
export async function runSeed(inp: RunSeedInput): Promise<{
  track: ReturnType<typeof compileHandoff>["track"];
  report: ReturnType<typeof compileHandoff>["report"];
  metrics: SeedMetrics;
}> {
  const mod = await import(resolve(inp.specPath));
  const spec = applyJolt(mod.default as Spec, inp.jolt);
  const { track, report } = compileHandoff(spec, inp.seed, { budget: inp.budget });
  const trace = extractTrace(track);
  return { track, report, metrics: measure(inp.seed, track, report, trace) };
}
