import spec from "../../../../productions/tiki_tiki_48s/spec.ts";
import { defineSpecCase } from "../case.ts";

export const benchmarkCase = defineSpecCase({
  metadata: {
    id: "tiki_tiki_48s",
    title: "Tiki Tiki",
    cohort: "qualification",
    originFamily: "production_reference",
    musicBacked: true,
    referencePulseSeconds: 0.87,
    eligibleComponents: ["sync", "survival", "air", "speed", "amplitude", "impact"],
    phases: [],
  },
  spec,
});

export default benchmarkCase.spec;
