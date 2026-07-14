/**
 * Dedicated materialized inputs for the prospective long-carrier cohort.
 *
 * This is intentionally separate from `panel.ts`: the six reviewed sources
 * and their fixed capture transform must not inherit the legacy benchmark
 * registry merely to construct a compiler input.
 */
import acceleratingLowAir475 from "./validation_specs/accelerating_low_air_475.ts";
import deceleratingLowAir625 from "./validation_specs/decelerating_low_air_625.ts";
import ordinaryPartialAxes115 from "./validation_specs/ordinary_partial_axes_115.ts";
import rampedHighAirReentry195 from "./validation_specs/ramped_high_air_reentry_195.ts";
import sparseLowAir725 from "./validation_specs/sparse_low_air_725.ts";
import syncopatedLowAir425 from "./validation_specs/syncopated_low_air_425.ts";
import {
  LONG_CARRIER_REPLICATION_PROTOCOL,
  LONG_CARRIER_REPLICATION_SCOPE,
  type LongCarrierReplicationCase,
} from "./long_carrier_replication_protocol.ts";
import {
  buildTrajectoryCaptureSetup,
  type TrajectoryCaptureCase,
  type TrajectoryCaptureSetup,
} from "./capture_input.ts";
import type { Spec } from "../types.ts";

const SPECS: Readonly<Record<string, Spec>> = Object.freeze({
  syncopated_low_air_425: syncopatedLowAir425,
  accelerating_low_air_475: acceleratingLowAir475,
  decelerating_low_air_625: deceleratingLowAir625,
  sparse_low_air_725: sparseLowAir725,
  ordinary_partial_axes_115: ordinaryPartialAxes115,
  ramped_high_air_reentry_195: rampedHighAirReentry195,
});

export const LONG_CARRIER_REPLICATION_CAPTURE_CASES: readonly TrajectoryCaptureCase[] = Object.freeze(
  LONG_CARRIER_REPLICATION_PROTOCOL.cases.map((entry) => materializeCase(entry)),
);

export function getLongCarrierReplicationCaptureCase(id: string): TrajectoryCaptureCase {
  const panel = LONG_CARRIER_REPLICATION_CAPTURE_CASES.find((entry) => entry.id === id);
  if (panel === undefined) throw new Error(`unknown long-carrier replication case ${id}`);
  return panel;
}

export function buildLongCarrierReplicationCaptureSetup(panel: TrajectoryCaptureCase): TrajectoryCaptureSetup {
  const declared = LONG_CARRIER_REPLICATION_PROTOCOL.cases.find((entry) => entry.id === panel.id);
  if (declared === undefined || panel.studyScope !== LONG_CARRIER_REPLICATION_SCOPE) {
    throw new Error(`capture case ${panel.id} is outside the long-carrier replication scope`);
  }
  return buildTrajectoryCaptureSetup(panel, LONG_CARRIER_REPLICATION_PROTOCOL.capture.transform);
}

function materializeCase(entry: LongCarrierReplicationCase): TrajectoryCaptureCase {
  const spec = SPECS[entry.sourceId];
  if (spec === undefined) throw new Error(`missing long-carrier replication source ${entry.sourceId}`);
  return Object.freeze({
    id: entry.id,
    cohort: "validation",
    category: entry.category,
    spec,
    sourcePath: entry.sourcePath,
    seed: entry.publicSeed,
    targetGap: entry.targetGap,
    selectionRationale: entry.selectionRationale,
    expectedOutgoingFrames: entry.expectedOutgoingFrames,
    studyScope: LONG_CARRIER_REPLICATION_SCOPE,
  });
}
