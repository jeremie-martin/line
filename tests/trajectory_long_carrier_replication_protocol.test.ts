import { describe, expect, test } from "vitest";
import {
  LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES,
  LONG_CARRIER_REPLICATION_PROTOCOL,
  longCarrierReplicationArtifactPaths,
  longCarrierReplicationAssayArgv,
  longCarrierReplicationAssayScriptArgv,
  longCarrierReplicationCaptureArgv,
  longCarrierReplicationCaptureScriptArgv,
} from "../scripts/v0/trajectory/long_carrier_replication_protocol.ts";

describe("long-carrier replication command contract", () => {
  test("derives both Node and artifact argv from the one sealed template", () => {
    const entry = LONG_CARRIER_REPLICATION_PROTOCOL.cases[0]!;
    const fixture = "/evidence/fixtures/01-case.json";
    const assay = "/evidence/assays/01-case.json";

    const capture = longCarrierReplicationCaptureArgv(entry, fixture);
    const assayInvocation = longCarrierReplicationAssayArgv(fixture, assay);
    expect(capture).toEqual([
      "--import", "tsx", "scripts/v0/capture_trajectory_fixture.ts",
      `--case=${entry.id}`, "--cohort=validation", "--budget=500000", `--out=${fixture}`,
    ]);
    expect(longCarrierReplicationCaptureScriptArgv(entry, fixture)).toEqual(capture.slice(3));
    expect(assayInvocation).toEqual([
      "--import", "tsx", "scripts/v0/study_long_carrier_duration_response.ts",
      `--fixture=${fixture}`, `--out=${assay}`,
    ]);
    expect(longCarrierReplicationAssayScriptArgv(fixture, assay)).toEqual(assayInvocation.slice(3));
    expect(LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES.capture).toContain("--budget=500000");
  });

  test("uses one stable relative publication slot per declared ordinal", () => {
    const entry = LONG_CARRIER_REPLICATION_PROTOCOL.cases[0]!;
    expect(longCarrierReplicationArtifactPaths(1, entry.id)).toEqual({
      fixture: `fixtures/01-${entry.id}.json`,
      assay: `assays/01-${entry.id}.json`,
    });
  });
});
