import { describe, expect, test } from "vitest";
import { assessLongCarrierReplication } from "../scripts/v0/trajectory/long_carrier_replication_assessment.ts";
import {
  LONG_CARRIER_TEST_IDENTITIES,
  resealArtifact,
  resealFixtureAndRebindAssay,
  validLongCarrierReplicationCohort,
} from "./support/long_carrier_replication_evidence.ts";

describe("long-carrier replication assessment", () => {
  test("supports only the fixed local duration-response claim on a complete valid roster", () => {
    const assessment = assessLongCarrierReplication(validLongCarrierReplicationCohort(), LONG_CARRIER_TEST_IDENTITIES);

    expect(assessment.verdict).toBe("supported_local_duration_response");
    expect(assessment.primarySources).toHaveLength(4);
    expect(assessment.controls).toHaveLength(4);
    expect(assessment.cases.filter((entry) => entry.role === "primary_low_air").every((entry) => entry.status === "supported"))
      .toBe(true);
    expect(assessment.controls.every((entry) => entry.status === "reported")).toBe(true);
    expect(assessment.cases[0]!.completeRows[0]!.terminalSpeedRetention).toBeCloseTo(2 / 3);
  });

  test("falsifies the ordering when any complete primary row is non-monotone", () => {
    const cohort = validLongCarrierReplicationCohort();
    const primary = cohort.find((entry) => entry.id.includes("syncopated"))!;
    resealArtifact(primary, (artifact) => {
      artifact.rows[0].measurement.primary.monotone = false;
      artifact.rows[0].measurement.primary.arms[2].airFraction = 0.9;
      artifact.rows[0].measurement.arms[2].window.airFraction = 0.9;
      artifact.summary.monotoneRows = 0;
      artifact.summary.nonMonotoneRows = 1;
    });

    const assessment = assessLongCarrierReplication(cohort, LONG_CARRIER_TEST_IDENTITIES);

    expect(assessment.verdict).toBe("falsified");
    expect(assessment.primarySources.find((source) => source.sourceId === "syncopated_low_air_425")!.status)
      .toBe("falsified");
  });

  test("keeps a monotone but sub-threshold endpoint response inconclusive", () => {
    const cohort = validLongCarrierReplicationCohort();
    for (const entry of cohort.filter((candidate) => candidate.id.includes("syncopated"))) {
      resealArtifact(entry, (artifact) => {
        for (const arm of artifact.rows[0].measurement.primary.arms) arm.airFraction = 0.8;
        for (const arm of artifact.rows[0].measurement.arms) arm.window.airFraction = 0.8;
      });
    }

    const assessment = assessLongCarrierReplication(cohort, LONG_CARRIER_TEST_IDENTITIES);

    expect(assessment.verdict).toBe("inconclusive");
    expect(assessment.primarySources.find((source) => source.sourceId === "syncopated_low_air_425")!.status)
      .toBe("inert");
  });

  test("rejects a non-five-arm row and a stale artifact checksum", () => {
    const nonFiveArm = validLongCarrierReplicationCohort();
    resealArtifact(nonFiveArm[0]!, (artifact) => {
      artifact.rows[0].measurement.primary.arms.pop();
      artifact.rows[0].measurement.arms.pop();
    });
    expect(assessLongCarrierReplication(nonFiveArm, LONG_CARRIER_TEST_IDENTITIES).verdict).toBe("invalid");

    const staleChecksum = validLongCarrierReplicationCohort();
    const tampered = structuredClone(staleChecksum[0]!.assay.artifact) as Record<string, any>;
    tampered.summary.armErrors = 1;
    staleChecksum[0]!.assay.artifact = tampered;
    expect(assessLongCarrierReplication(staleChecksum, LONG_CARRIER_TEST_IDENTITIES).verdict).toBe("invalid");

    const staleIdentity = validLongCarrierReplicationCohort();
    resealArtifact(staleIdentity[0]!, (artifact) => {
      artifact.artifactIdentity.fingerprint = "0".repeat(64);
    });
    expect(assessLongCarrierReplication(staleIdentity, LONG_CARRIER_TEST_IDENTITIES).verdict).toBe("invalid");
  });

  test("rejects a sealed prefix/materialized transition that no longer matches the declared target", () => {
    const cohort = validLongCarrierReplicationCohort();
    resealFixtureAndRebindAssay(cohort[0]!, (fixture) => {
      fixture.physicalPrefix.gapIndex = 999;
    });

    expect(assessLongCarrierReplication(cohort, LONG_CARRIER_TEST_IDENTITIES).verdict).toBe("invalid");
  });

  test("does not discard missing, unavailable, or unreported control records", () => {
    const missing = validLongCarrierReplicationCohort().slice(1);
    expect(assessLongCarrierReplication(missing, LONG_CARRIER_TEST_IDENTITIES).verdict).toBe("invalid");

    const unavailablePrimary = validLongCarrierReplicationCohort();
    unavailablePrimary[0] = {
      id: unavailablePrimary[0]!.id,
      capture: { exitCode: 1, fixture: null, failureKind: "unavailable" },
      assay: { exitCode: null, artifact: null },
    };
    expect(assessLongCarrierReplication(unavailablePrimary, LONG_CARRIER_TEST_IDENTITIES).verdict).toBe("inconclusive");

    const unavailableControl = validLongCarrierReplicationCohort();
    const controlIndex = unavailableControl.findIndex((entry) => entry.id.includes("ordinary_partial"));
    unavailableControl[controlIndex] = {
      id: unavailableControl[controlIndex]!.id,
      capture: { exitCode: 1, fixture: null, failureKind: "unavailable" },
      assay: { exitCode: null, artifact: null },
    };
    expect(assessLongCarrierReplication(unavailableControl, LONG_CARRIER_TEST_IDENTITIES).verdict).toBe("inconclusive");

    const noCompleteRow = validLongCarrierReplicationCohort();
    for (const entry of noCompleteRow.filter((entry) => entry.id.includes("syncopated"))) {
      resealArtifact(entry, (artifact) => {
        artifact.status.descriptiveDurationResponseEligible = false;
        artifact.status.protocolStatus = "complete_without_eligible_evidence";
        artifact.rows = [{ measurement: { status: "construction_unavailable", primary: null, arms: [] } }];
        artifact.summary.completeFiveArmRows = 0;
        artifact.summary.monotoneRows = 0;
        artifact.summary.unavailableRows = 1;
      });
    }
    expect(assessLongCarrierReplication(noCompleteRow, LONG_CARRIER_TEST_IDENTITIES).verdict).toBe("inconclusive");
  });

  test("rejects source/runtime declaration drift and artifacts published after a failed child", () => {
    const cohort = validLongCarrierReplicationCohort();
    expect(assessLongCarrierReplication(cohort, {
      ...LONG_CARRIER_TEST_IDENTITIES,
      captureCandidateFingerprint: "0".repeat(64),
    }).verdict).toBe("invalid");

    cohort[0]!.assay.exitCode = 1;
    expect(assessLongCarrierReplication(cohort, LONG_CARRIER_TEST_IDENTITIES).verdict).toBe("invalid");
  });

  test("keeps a valid primary falsification even when a scope control is unavailable", () => {
    const cohort = validLongCarrierReplicationCohort();
    resealArtifact(cohort[0]!, (artifact) => {
      artifact.rows[0].measurement.primary.monotone = false;
      artifact.rows[0].measurement.primary.arms[2].airFraction = 0.9;
      artifact.rows[0].measurement.arms[2].window.airFraction = 0.9;
      artifact.summary.monotoneRows = 0;
      artifact.summary.nonMonotoneRows = 1;
    });
    const controlIndex = cohort.findIndex((entry) => entry.id.includes("ordinary_partial"));
    cohort[controlIndex] = {
      id: cohort[controlIndex]!.id,
      capture: { exitCode: 1, fixture: null, failureKind: "unavailable" },
      assay: { exitCode: null, artifact: null },
    };

    expect(assessLongCarrierReplication(cohort, LONG_CARRIER_TEST_IDENTITIES).verdict).toBe("falsified");
  });
});
