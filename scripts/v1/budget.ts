import type { Budget, CompileOptions, Spec } from "./types.ts";

export const DEFAULT_WORK_BASE_UNITS = 25_000;
export const DEFAULT_WORK_PER_CONTACT_UNITS = 15_000;
export const MINIMUM_WORK_BASE_UNITS = 5_000;
export const MINIMUM_WORK_PER_CONTACT_UNITS = 3_000;

export function defaultBudgetFor(spec: Spec): Budget {
  return {
    kind: "work",
    units: DEFAULT_WORK_BASE_UNITS + DEFAULT_WORK_PER_CONTACT_UNITS * Math.max(0, spec.contacts.length),
  };
}

export function minimumRecommendedBudgetFor(spec: Spec): Budget {
  return {
    kind: "work",
    units: MINIMUM_WORK_BASE_UNITS + MINIMUM_WORK_PER_CONTACT_UNITS * Math.max(0, spec.contacts.length),
  };
}

export function normalizeCompileOptions(
  spec: Spec,
  optsOrSeed?: CompileOptions | number,
): Required<CompileOptions> {
  if (typeof optsOrSeed === "number") {
    return { seed: optsOrSeed, budget: defaultBudgetFor(spec) };
  }
  return {
    seed: optsOrSeed?.seed ?? 0,
    budget: optsOrSeed?.budget ?? defaultBudgetFor(spec),
  };
}
