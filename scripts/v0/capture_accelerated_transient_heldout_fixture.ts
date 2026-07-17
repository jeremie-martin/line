/** Capture the sealed validation fixtures for the tangential-impulse transient release. */
import {
  activeAcceleratedTransientHeldoutCases,
  buildAcceleratedTransientHeldoutSetup,
  getAcceleratedTransientHeldoutCase,
} from "./trajectory/accelerated_transient_heldout_panel.ts";
import { runTrajectoryFixtureCapture } from "./trajectory/fixture_capture_runner.ts";

runTrajectoryFixtureCapture(process.argv.slice(2), {
  entryPath: "scripts/v0/capture_accelerated_transient_heldout_fixture.ts",
  defaultOutDir: "generated/studies/trajectory-fixtures/transient-accelerated-release-heldout-2026-07-17",
  allowedCohorts: ["validation"],
  activeCases: () => activeAcceleratedTransientHeldoutCases(),
  getCase: getAcceleratedTransientHeldoutCase,
  buildSetup: buildAcceleratedTransientHeldoutSetup,
  usage: [
    "Usage: capture_accelerated_transient_heldout_fixture.ts --case=NAME|all [--cohort=validation] [--budget=500000] [--out=FILE] [--out-dir=DIR]",
    "",
    "Captures the prospective tangential-impulse transient fixtures without importing a prior trajectory cohort.",
  ],
});
