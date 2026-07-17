/** Capture the sealed inputs for the compact tangential-impulse force comparison. */
import {
  activeCompactForceComparisonCases,
  buildCompactForceComparisonSetup,
  getCompactForceComparisonCase,
} from "./trajectory/compact_force_comparison_panel.ts";
import { runTrajectoryFixtureCapture } from "./trajectory/fixture_capture_runner.ts";

runTrajectoryFixtureCapture(process.argv.slice(2), {
  entryPath: "scripts/v0/capture_compact_force_comparison_fixture.ts",
  defaultOutDir: "generated/studies/trajectory-fixtures/transient-compact-force-comparison-2026-07-17",
  allowedCohorts: ["validation"],
  activeCases: () => activeCompactForceComparisonCases(),
  getCase: getCompactForceComparisonCase,
  buildSetup: buildCompactForceComparisonSetup,
  usage: [
    "Usage: capture_compact_force_comparison_fixture.ts --case=NAME|all [--cohort=validation] [--budget=500000] [--out=FILE] [--out-dir=DIR]",
    "",
    "Captures the predeclared compact tangential-impulse force/solid comparison inputs.",
  ],
});
