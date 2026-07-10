import spec from "../../../../scripts/v0/specs/amour_de_ma_vie_short.ts";
import { defineSpecCase } from "../case.ts";

export const benchmarkCase = defineSpecCase({
  metadata: {
    id: "amour_de_ma_vie_short_44s",
    title: "Amour De Ma Vie Short",
    cohort: "qualification",
    originFamily: "production_reference",
    musicBacked: true,
    referencePulseSeconds: 0.67,
    eligibleComponents: ["sync", "survival", "impact"],
    diagnosticComponents: ["air", "speed"],
    phases: [],
    notes: "Air and speed remain diagnostic because the source labels them as placeholders.",
  },
  spec,
});

export default benchmarkCase.spec;
