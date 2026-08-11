import { describe, expect, it } from "vitest";
import {
  IMPACT_RESPONSE_MODEL_THRESHOLD_LOGIT,
  impactResponseModelLogit,
} from "../scripts/v0/optimizer/impact_response_model.ts";

describe("impact response model", () => {
  it("matches the frozen training pipeline on a retained candidate row", () => {
    const features = [
      0.72, 0.3875119755773785, 0.22399920912100713, 4,
      0.36097896323152096, 0.20870011798457855, 0.43396106020444614,
      0.026718156686702584, 0.10516801359563527, 0.362349938480664,
      0.7632140528560876, 0.3802849347193118, 92.03848895724482, 11,
      8.367135359749529, 8.045725727761214, 11.581231679632511,
      11.428828007168022, 10, 6, 89.5511608699903, 9.24597137672891,
      9.241157657850787, 0.2983150047115632, 0, 9.40017460032932,
      7.282901348002969, 0.5, 16, 0.026533012345857532,
      0.015299091136428578, 5.752405559827801, 5.596947554374394,
    ];
    expect(impactResponseModelLogit(features)).toBeCloseTo(-1.0792676234, 8);
  });

  it("uses the probability-0.80 logit threshold", () => {
    expect(IMPACT_RESPONSE_MODEL_THRESHOLD_LOGIT).toBeCloseTo(1.38629436112, 10);
    expect(() => impactResponseModelLogit([1, 2])).toThrow();
  });
});
