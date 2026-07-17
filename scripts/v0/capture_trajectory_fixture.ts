/** Capture an immutable prefix fixture from the legacy declared trajectory panel. */
import {
  activeTrajectoryPanelCases,
  buildTrajectoryPanelSetup,
  getTrajectoryPanelCase,
} from "./trajectory/panel.ts";
import { runTrajectoryFixtureCapture } from "./trajectory/fixture_capture_runner.ts";

runTrajectoryFixtureCapture(process.argv.slice(2), {
  entryPath: "scripts/v0/capture_trajectory_fixture.ts",
  defaultOutDir: "generated/studies/trajectory-fixtures",
  allowedCohorts: ["calibration", "validation"],
  activeCases: activeTrajectoryPanelCases,
  getCase: getTrajectoryPanelCase,
  buildSetup: buildTrajectoryPanelSetup,
  usage: [
    "Usage: capture_trajectory_fixture.ts --case=NAME|all [--cohort=calibration|validation] [--budget=500000] [--out=FILE] [--out-dir=DIR]",
    "",
    "Captures a current compiler prefix once, then serializes enough physical and provenance state for later trajectory studies to replay it without search.",
    "A requested cohort with no active rows is an error; V2 reserve rows are quarantined, not validation.",
  ],
});
