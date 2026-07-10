import spec from "../../../../productions/luna_bala_44s/spec.ts";
import { defineSpecCase } from "../case.ts";

export const benchmarkCase = defineSpecCase({
  metadata: {
    id: "luna_bala_44s",
    title: "Luna Bala",
    cohort: "qualification",
    originFamily: "production_reference",
    musicBacked: true,
    referencePulseSeconds: 0.55,
    eligibleComponents: ["sync", "survival", "air", "speed", "impact"],
    phases: [],
  },
  spec,
});

export default benchmarkCase.spec;
