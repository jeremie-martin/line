/** Authoring-time alignment between the music and the compiled contacts. */
import { FPS, type Spec } from "../v0/types.ts";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";

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
