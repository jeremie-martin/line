/** Authoring-time alignment between the music and the compiled contacts. */
import { FPS, type Spec } from "../v0/types.ts";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";

// Felt-jolt alignment between the audio beat and the compiled contacts:
// contact time = authored time − ms/1000, so a positive offset makes contacts
// earlier and a negative one later. The default −15 ms (contacts 15 ms after the
// beat) is the owner's choice by ear from an A/B of 0 / −15 / −25 ms on Tiki
// (June 15). LR_JOLT_OFFSET_MS overrides; 0 disables. Authoring-layer only.
export const JOLT_DEFAULT_MS = -15;

export function resolveJoltMs(): number {
  const raw = process.env.LR_JOLT_OFFSET_MS;
  const v = raw === undefined || raw === "" ? JOLT_DEFAULT_MS : Number(raw);
  if (!Number.isFinite(v)) throw new Error("LR_JOLT_OFFSET_MS must be a finite number");
  return v;
}

export function applyJolt(spec: Spec, ms: number): Spec {
  if (ms === 0) return spec;
  const floorS = K_BOUNCE_LANDING / FPS; // clamp to the earliest catchable contact
  return { ...spec, contacts: spec.contacts.map((c) => ({ ...c, t: Math.max(floorS, c.t - ms / 1000) })) };
}
