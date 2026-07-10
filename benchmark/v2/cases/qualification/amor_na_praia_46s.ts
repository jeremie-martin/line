import spec from "../../../../productions/amor_na_praia_46s/spec.ts";
import { defineSpecCase } from "../case.ts";

export const benchmarkCase = defineSpecCase({
  metadata: {
    id: "amor_na_praia_46s",
    title: "Amor Na Praia",
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
