/** Capture the sealed held-out fixture cohort for the recursive transient study. */
import {
  activeRecursiveTransientHeldoutCases,
  buildRecursiveTransientHeldoutSetup,
  getRecursiveTransientHeldoutCase,
} from "./trajectory/recursive_transient_heldout_panel.ts";
import { runTrajectoryFixtureCapture } from "./trajectory/fixture_capture_runner.ts";

runTrajectoryFixtureCapture(process.argv.slice(2), {
  entryPath: "scripts/v0/capture_recursive_transient_heldout_fixture.ts",
  defaultOutDir: "generated/studies/trajectory-fixtures/recursive-transient-heldout-2026-07-17",
  allowedCohorts: ["validation"],
  activeCases: () => activeRecursiveTransientHeldoutCases(),
  getCase: getRecursiveTransientHeldoutCase,
  buildSetup: buildRecursiveTransientHeldoutSetup,
  usage: [
    "Usage: capture_recursive_transient_heldout_fixture.ts --case=NAME|all [--cohort=validation] [--budget=500000] [--out=FILE] [--out-dir=DIR]",
    "",
    "Captures the predeclared prospective fixtures without importing the legacy calibration panel.",
  ],
});
