import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { studySourceIdentity } from "../scripts/v0/trajectory/study_artifact.ts";

const RUNNER_PATH = "scripts/v0/study_continuous_support_curve.ts";

/**
 * The curve assay is calibration-only. Its static source closure must not pull
 * in compiler placement/search policy, benchmark policy, or fixture-panel
 * selection machinery. Check both the entry source and the resolver-backed
 * transitive closure so wrapping a forbidden module in a helper cannot bypass
 * the boundary.
 */
const FORBIDDEN_TRANSITIVE_SOURCE_FILES = [
  "scripts/v0/arc_placement.ts",
  "scripts/v0/core/candidate.ts",
  "scripts/v0/trajectory/exact_support_slice_assay.ts",
  "scripts/v0/trajectory/frozen_fixture.ts",
  "scripts/v0/trajectory/study_context.ts",
  "scripts/v0/trajectory/study_trace.ts",
  "scripts/v0/trajectory/study_artifact.ts",
  "scripts/v0/optimizer/handoff.ts",
  "scripts/v0/optimizer/sample.ts",
  "scripts/v0/trajectory/transition_contract.ts",
  "benchmark/v2/policy.ts",
  "scripts/v0/trajectory/panel.ts",
] as const;

const FORBIDDEN_ENTRY_IMPORT_SPECIFIERS = [
  "./arc_placement.ts",
  "./core/candidate.ts",
  "./trajectory/exact_support_slice_assay.ts",
  "./trajectory/frozen_fixture.ts",
  "./trajectory/study_context.ts",
  "./trajectory/study_trace.ts",
  "./trajectory/study_artifact.ts",
  "./optimizer/handoff.ts",
  "./optimizer/sample.ts",
  "./trajectory/transition_contract.ts",
  "../../benchmark/v2/policy.ts",
  "./trajectory/panel.ts",
] as const;

describe("continuous support curve runner isolation", () => {
  test("keeps compiler, benchmark, and panel dependencies out of its static source closure", () => {
    const source = readFileSync(RUNNER_PATH, "utf8");
    const directViolations = FORBIDDEN_ENTRY_IMPORT_SPECIFIERS.filter((specifier) => source.includes(specifier));
    const identity = studySourceIdentity(RUNNER_PATH);
    const transitiveViolations = FORBIDDEN_TRANSITIVE_SOURCE_FILES.filter((path) => identity.sourceFiles.includes(path));
    expect({ directViolations, transitiveViolations }).toEqual({
      directViolations: [],
      transitiveViolations: [],
    });
  });
});
