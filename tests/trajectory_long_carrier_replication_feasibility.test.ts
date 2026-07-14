import { describe, expect, test } from "vitest";
import {
  assertFixtureMatchesLongCarrierReplicationFeasibility,
  assertLongCarrierReplicationFeasibility,
  assertQualifiedLongCarrierReplicationFeasibility,
} from "../scripts/v0/trajectory/long_carrier_replication_feasibility.ts";
import { sealReplicationRecord } from "../scripts/v0/trajectory/long_carrier_replication_records.ts";
import {
  LONG_CARRIER_REPLICATION_PROTOCOL,
} from "../scripts/v0/trajectory/long_carrier_replication_protocol.ts";
import { sha256, stableJson } from "../scripts/v0/trajectory/postimpact_study_inputs.ts";
import {
  LONG_CARRIER_TEST_FEASIBILITY_BINDING,
  fixtureFor,
  qualifiedLongCarrierReplicationFeasibility,
} from "./support/long_carrier_replication_evidence.ts";

function reseal(
  mutate: (record: Record<string, any>) => void,
) {
  const record = structuredClone(qualifiedLongCarrierReplicationFeasibility()) as Record<string, any>;
  delete record.recordFingerprint;
  mutate(record);
  return sealReplicationRecord(record);
}

function resealFixture(fixture: Record<string, any>): void {
  fixture.physicalPrefixFingerprint = sha256(stableJson(fixture.physicalPrefix));
  const { fixtureFingerprint: _previous, ...payload } = fixture;
  fixture.fixtureFingerprint = sha256(stableJson(payload));
}

describe("long-carrier mechanical feasibility qualification", () => {
  test("accepts a complete score-free qualified record and its matching fixture", () => {
    const feasibility = qualifiedLongCarrierReplicationFeasibility();
    const entry = LONG_CARRIER_REPLICATION_PROTOCOL.cases[0]!;

    assertLongCarrierReplicationFeasibility(feasibility, LONG_CARRIER_TEST_FEASIBILITY_BINDING);
    assertQualifiedLongCarrierReplicationFeasibility(feasibility, LONG_CARRIER_TEST_FEASIBILITY_BINDING);
    expect(() => assertFixtureMatchesLongCarrierReplicationFeasibility(fixtureFor(entry), entry, feasibility)).not.toThrow();
  });

  test("rejects efficacy contamination at every sealed mechanical boundary", () => {
    const topLevelScore = reseal((record) => {
      record.score = 700;
    });
    expect(() => assertLongCarrierReplicationFeasibility(topLevelScore)).toThrow("unsupported field");

    const witnessHeadline = reseal((record) => {
      record.rows[0].witness.headline = 700;
    });
    expect(() => assertLongCarrierReplicationFeasibility(witnessHeadline)).toThrow("unsupported field");

    const identityAssay = reseal((record) => {
      record.identities.assay = { score: 700 };
    });
    expect(() => assertLongCarrierReplicationFeasibility(identityAssay)).toThrow("unsupported field");
  });

  test("preserves unavailable versus invalid failure semantics and donor bounds", () => {
    const unavailableCaptureError = reseal((record) => {
      record.rows[0].status = "unavailable";
      record.rows[0].failureCode = "capture_error";
      record.rows[0].witness = null;
      record.qualified = false;
    });
    expect(() => assertLongCarrierReplicationFeasibility(unavailableCaptureError)).toThrow("invalid structural failure");

    const invalidUnreachable = reseal((record) => {
      record.rows[0].status = "invalid";
      record.rows[0].failureCode = "target_unreached";
      record.rows[0].witness = null;
      record.qualified = false;
    });
    expect(() => assertLongCarrierReplicationFeasibility(invalidUnreachable)).toThrow("invalid structural failure");

    const impossibleDonor = reseal((record) => {
      record.rows[0].witness.donorGap = record.rows[0].materializedGapCount;
    });
    expect(() => assertLongCarrierReplicationFeasibility(impossibleDonor)).toThrow("invalid physical witness");
  });

  test("rejects a stale runtime/candidate binding and a fixture that differs from the qualified prefix", () => {
    const feasibility = qualifiedLongCarrierReplicationFeasibility();
    expect(() => assertQualifiedLongCarrierReplicationFeasibility(feasibility, {
      ...LONG_CARRIER_TEST_FEASIBILITY_BINDING,
      captureRuntimeFingerprint: "0".repeat(64),
    })).toThrow("stale");

    const entry = LONG_CARRIER_REPLICATION_PROTOCOL.cases[0]!;
    const fixture = fixtureFor(entry) as Record<string, any>;
    fixture.physicalPrefix.prefixNextLineId = 2;
    resealFixture(fixture);
    expect(() => assertFixtureMatchesLongCarrierReplicationFeasibility(fixture, entry, feasibility))
      .toThrow("does not reproduce");
  });

  test("binds every accepted fixture to the declared outgoing geometry and runtime endpoints", () => {
    const feasibility = qualifiedLongCarrierReplicationFeasibility();
    const entry = LONG_CARRIER_REPLICATION_PROTOCOL.cases[0]!;

    const changedOutgoing = fixtureFor(entry) as Record<string, any>;
    changedOutgoing.panel.outgoingGap = entry.targetGap + 2;
    changedOutgoing.panel.outgoingFrame += 10;
    changedOutgoing.panel.outgoingIntervalFrames += 10;
    resealFixture(changedOutgoing);
    expect(() => assertFixtureMatchesLongCarrierReplicationFeasibility(changedOutgoing, entry, feasibility))
      .toThrow("declared current/outgoing geometry");

    const changedMaterialized = fixtureFor(entry) as Record<string, any>;
    changedMaterialized.materialized.gaps[0].targets.impact = 0.91;
    changedMaterialized.materializedFingerprint = sha256(stableJson(changedMaterialized.materialized));
    resealFixture(changedMaterialized);
    expect(() => assertFixtureMatchesLongCarrierReplicationFeasibility(changedMaterialized, entry, feasibility))
      .toThrow("does not reproduce");

    const changedRuntime = fixtureFor(entry) as Record<string, any>;
    changedRuntime.capture.identityCheck.captureRuntimeFingerprintAtStart = "0".repeat(64);
    changedRuntime.capture.identityCheck.captureRuntimeFingerprintAtEnd = "0".repeat(64);
    resealFixture(changedRuntime);
    expect(() => assertFixtureMatchesLongCarrierReplicationFeasibility(changedRuntime, entry, feasibility))
      .toThrow("runtime identity does not bind");
  });
});
