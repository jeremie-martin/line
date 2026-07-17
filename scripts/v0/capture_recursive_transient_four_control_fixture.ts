/** Capture the sealed V4 four-control recursive-transient fixture cohort. */
import {
  activeRecursiveTransientFourControlCases,
  buildRecursiveTransientFourControlSetup,
  getRecursiveTransientFourControlCase,
} from "./trajectory/recursive_transient_four_control_panel.ts";
import { runTrajectoryFixtureCapture } from "./trajectory/fixture_capture_runner.ts";

runTrajectoryFixtureCapture(process.argv.slice(2), {
  entryPath: "scripts/v0/capture_recursive_transient_four_control_fixture.ts",
  defaultOutDir: "generated/studies/trajectory-fixtures/recursive-transient-four-control-2026-07-17",
  allowedCohorts: ["validation"],
  activeCases: () => activeRecursiveTransientFourControlCases(),
  getCase: getRecursiveTransientFourControlCase,
  buildSetup: buildRecursiveTransientFourControlSetup,
  usage: [
    "Usage: capture_recursive_transient_four_control_fixture.ts --case=NAME|all [--cohort=validation] [--budget=500000] [--out=FILE] [--out-dir=DIR]",
    "",
    "Captures the predeclared V4 four-control fixtures without importing prior trajectory cohorts.",
  ],
});
