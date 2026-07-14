import { describe, expect, test } from "vitest";
import {
  LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES,
  LONG_CARRIER_REPLICATION_AUTHORING_INPUT_PATHS,
  LONG_CARRIER_REPLICATION_DEFINITION_PATHS,
  LONG_CARRIER_REPLICATION_PROTOCOL,
  isLongCarrierReplicationAuthoringInputPath,
  longCarrierReplicationArtifactPaths,
  longCarrierReplicationAssayArgv,
  longCarrierReplicationAssayScriptArgv,
  longCarrierReplicationCaptureArgv,
  longCarrierReplicationCaptureScriptArgv,
  longCarrierReplicationSelfVerifierArgv,
} from "../scripts/v0/trajectory/long_carrier_replication_protocol.ts";

describe("long-carrier replication command contract", () => {
  test("pins the shared curve interpreter as an immutable authored input", () => {
    expect(LONG_CARRIER_REPLICATION_AUTHORING_INPUT_PATHS).toEqual(["scripts/v0/core/curves.ts"]);
    expect(LONG_CARRIER_REPLICATION_DEFINITION_PATHS).toContain("scripts/v0/core/curves.ts");
    expect(LONG_CARRIER_REPLICATION_PROTOCOL.authoringInputPaths).toEqual(
      LONG_CARRIER_REPLICATION_AUTHORING_INPUT_PATHS,
    );
    expect(isLongCarrierReplicationAuthoringInputPath("scripts/v0/core/curves.ts")).toBe(true);
    expect(isLongCarrierReplicationAuthoringInputPath("scripts/v0/core/aim.ts")).toBe(false);
  });

  test("derives both Node and artifact argv from the one sealed template", () => {
    const entry = LONG_CARRIER_REPLICATION_PROTOCOL.cases[0]!;
    const fixture = "/evidence/fixtures/01-case.json";
    const assay = "/evidence/assays/01-case.json";

    const capture = longCarrierReplicationCaptureArgv(entry, fixture);
    const assayInvocation = longCarrierReplicationAssayArgv(fixture, assay);
    expect(capture).toEqual([
      "--import", "tsx", "scripts/v0/capture_long_carrier_replication_fixture.ts",
      `--case=${entry.id}`, "--cohort=validation", "--budget=500000", `--out=${fixture}`,
    ]);
    expect(longCarrierReplicationCaptureScriptArgv(entry, fixture)).toEqual(capture.slice(3));
    expect(assayInvocation).toEqual([
      "--import", "tsx", "scripts/v0/study_long_carrier_duration_response.ts",
      `--fixture=${fixture}`, `--out=${assay}`,
    ]);
    expect(longCarrierReplicationAssayScriptArgv(fixture, assay)).toEqual(assayInvocation.slice(3));
    expect(longCarrierReplicationSelfVerifierArgv("/evidence")).toEqual([
      "--import", "tsx", "scripts/v0/verify_long_carrier_replication.ts",
      "--out-dir=/evidence", "--require-current-identity",
    ]);
    expect(LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES.capture).toContain("--budget=500000");
    expect(LONG_CARRIER_REPLICATION_PROTOCOL.capture.transform).toEqual({
      kind: "production_felt_jolt",
      joltMs: -15,
    });
    expect(LONG_CARRIER_REPLICATION_PROTOCOL.capture.prefixProjectionRule)
      .toBe("max_unskipped_gap_then_earliest_callback.v1");
  });

  test("uses one stable relative publication slot per declared ordinal", () => {
    const entry = LONG_CARRIER_REPLICATION_PROTOCOL.cases[0]!;
    expect(longCarrierReplicationArtifactPaths(1, entry.id)).toEqual({
      fixture: `fixtures/01-${entry.id}.json`,
      assay: `assays/01-${entry.id}.json`,
    });
  });
});
