import spec from "../../../../scripts/v0/specs/shelter_impact_sync.ts";
import { defineSpecCase } from "../case.ts";

export const benchmarkCase = defineSpecCase({
  metadata: {
    id: "shelter_impact_sync_81s",
    title: "Shelter Impact Sync",
    cohort: "qualification",
    originFamily: "production_reference",
    musicBacked: true,
    referencePulseSeconds: 0.6,
    eligibleComponents: ["sync", "survival", "air", "speed", "amplitude", "impact"],
    phases: [],
  },
  spec,
});

export default benchmarkCase.spec;
