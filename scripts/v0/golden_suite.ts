import { resolve } from "node:path";
import type { Spec } from "./types.ts";

export const GOLDEN_SPECS = [
  "drums_signature",
  "drums_pendulum",
  "drums_crescendo",
  "dense_sprint",
  "syncopated_switchback",
  "opening_burst",
  "grain_staircase",
  "rhythm_ladder",
  "cold_start",
  "mini_burst",
] as const;

export const REPORT_VARIANTS = [
  "contact_phase_plus_25ms",
  "time_stretch_102",
] as const;

export const GOLDEN_SEEDS = [0, 1, 2] as const;

/**
 * Runtime budgets scale affinely with contact count, the unit of decision-
 * making for the compiler. A 6-contact mini-spec should not get the same
 * generous budget as a 55-contact drums spec.
 *
 *   soft_ms = SOFT_BASE + SOFT_PER_CONTACT * numContacts
 *   hard_ms = HARD_BASE + HARD_PER_CONTACT * numContacts
 *
 * Worker timeout is `hard_ms + buffer`, clamped to a sensible floor/ceiling.
 */
export const SOFT_BUDGET_BASE_MS = 5_000;
export const SOFT_BUDGET_PER_CONTACT_MS = 1_000;
export const HARD_BUDGET_BASE_MS = 7_500;
export const HARD_BUDGET_PER_CONTACT_MS = 1_500;
export const WORKER_TIMEOUT_BUFFER_MS = 5_000;
export const WORKER_TIMEOUT_FLOOR_MS = 60_000;
export const WORKER_TIMEOUT_CAP_MS = 180_000;

export function softBudgetMs(numContacts: number): number {
  return SOFT_BUDGET_BASE_MS + SOFT_BUDGET_PER_CONTACT_MS * Math.max(0, numContacts);
}

export function hardBudgetMs(numContacts: number): number {
  return HARD_BUDGET_BASE_MS + HARD_BUDGET_PER_CONTACT_MS * Math.max(0, numContacts);
}

export function workerTimeoutMs(numContacts: number): number {
  const raw = hardBudgetMs(numContacts) + WORKER_TIMEOUT_BUFFER_MS;
  return Math.min(WORKER_TIMEOUT_CAP_MS, Math.max(WORKER_TIMEOUT_FLOOR_MS, raw));
}

export type GoldenSpecName = typeof GOLDEN_SPECS[number];
export type VariantName = "base" | typeof REPORT_VARIANTS[number];
export type SuiteCase = { specName: GoldenSpecName; variant: VariantName };

export function headlineCases(): SuiteCase[] {
  return GOLDEN_SPECS.map((specName) => ({ specName, variant: "base" }));
}

export function variantCases(): SuiteCase[] {
  return GOLDEN_SPECS.flatMap((specName) =>
    REPORT_VARIANTS.map((variant) => ({ specName, variant })),
  );
}

function cloneSpec(spec: Spec): Spec {
  return {
    duration: spec.duration,
    contacts: spec.contacts.map((contact) => ({ ...contact })),
    sections: spec.sections.map((section) => ({ ...section })),
    ...(spec.defaults ? { defaults: { ...spec.defaults } } : {}),
    ...(spec.start ? { start: { ...spec.start } } : {}),
    ...(spec.preroll !== undefined ? { preroll: spec.preroll } : {}),
  };
}

export function assertValidSpec(spec: Spec, label: string): void {
  if (!Number.isFinite(spec.duration) || spec.duration <= 0) {
    throw new Error(`${label}: invalid duration ${spec.duration}`);
  }
  let lastContact = -Infinity;
  for (const contact of spec.contacts) {
    if (!Number.isFinite(contact.t) || contact.t < 0 || contact.t > spec.duration) {
      throw new Error(`${label}: contact outside duration at ${contact.t}`);
    }
    if (contact.t < lastContact) {
      throw new Error(`${label}: contacts must be sorted`);
    }
    lastContact = contact.t;
  }
  for (const section of spec.sections) {
    if (
      !Number.isFinite(section.t0) ||
      !Number.isFinite(section.t1) ||
      section.t0 < 0 ||
      section.t1 > spec.duration ||
      section.t1 <= section.t0
    ) {
      throw new Error(`${label}: invalid section ${section.t0}-${section.t1}`);
    }
  }
}

export function applyVariant(base: Spec, variant: VariantName): Spec {
  const spec = cloneSpec(base);
  if (variant === "base") {
    assertValidSpec(spec, "base");
    return spec;
  }

  if (variant === "contact_phase_plus_25ms") {
    const shifted: Spec = {
      ...spec,
      contacts: spec.contacts.map((contact) => ({
        t: Number((contact.t + 0.025).toFixed(3)),
      })),
    };
    assertValidSpec(shifted, variant);
    return shifted;
  }

  if (variant === "time_stretch_102") {
    const factor = 1.02;
    const scaled: Spec = {
      ...spec,
      duration: Number((spec.duration * factor).toFixed(3)),
      contacts: spec.contacts.map((contact) => ({
        t: Number((contact.t * factor).toFixed(3)),
      })),
      sections: spec.sections.map((section) => ({
        ...section,
        t0: Number((section.t0 * factor).toFixed(3)),
        t1: Number((section.t1 * factor).toFixed(3)),
      })),
    };
    assertValidSpec(scaled, variant);
    return scaled;
  }

  const exhaustive: never = variant;
  throw new Error(`unknown variant ${exhaustive}`);
}

export async function loadGoldenSpec(name: GoldenSpecName, variant: VariantName): Promise<Spec> {
  const mod = await import(resolve(`specs/golden/${name}.ts`));
  return applyVariant(mod.default as Spec, variant);
}
