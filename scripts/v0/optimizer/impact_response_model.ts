/**
 * Cheap response-safety screen for locally better impact candidates.
 *
 * Logistic regression trained on the exact H..H+6 response labels in
 * `current-pool-efficient-candidates-critical-seed784-750k.jsonl`. The model
 * was frozen before testing on seeds 860-861: held-out ROC AUC 0.823; selecting
 * the best non-admitted candidate above probability 0.80 yielded 23.1% exact
 * response-safe precision, versus 3.9% prevalence. Inputs are ordinary
 * candidate geometry, settled quality, and closed-form next-gap projection;
 * no engine response frame is read.
 */

export const IMPACT_RESPONSE_MODEL_THRESHOLD_LOGIT = Math.log(4);

const MEDIANS = [
  0.68, 0.232463365111, 0.150946358178, 44, 0.116255419794,
  0.098471853484, 0.674429983382, 0.020083746366, 0.067480878401,
  0.402659329813, 0.658436302917, 0.368622061411, 104.680775304945,
  8, 12.808593487984, 10.699505676697, 17.766535595816,
  11.027260958321, 10, 8, 97.118921595042, 10.046056560509,
  9.978690407747, -0.457123942643, 0, 10.110398878525,
  5.449882226104, 0.5, 19, 0.081936226533, 0.037074106721,
  5.786261887215, 5.45277036953,
] as const;

const WEIGHTS = [
  1.979877779264, -4.138819797637, -6.485293083159, -0.002514004687,
  5.656501463924, -3.782240999582, -3.429801752151, 5.663038759075,
  -5.019509573052, -0.657593123219, -0.16274479021, 0.900968053825,
  0.013074403842, -0.051103989398, 0.022210399149, -0.038174039488,
  -0.010909470005, -0.087618088376, 0.338499228086, -0.092442365613,
  -0.060072677978, 1.991955090277, 0.792161072636, 0.057844521997,
  0, -1.383009489796, 0.035510159251, -6.003189645152,
  0.202774051141, -16.785856536782, -13.007244138483, 0.097020327933,
  -0.241560314898,
] as const;

const INTERCEPT = -7.466700821619542;

export function impactResponseModelLogit(
  features: readonly (number | null | undefined)[],
): number {
  if (features.length !== WEIGHTS.length) {
    throw new Error(
      `impact response model needs ${WEIGHTS.length} features, got ${features.length}`,
    );
  }
  let value = INTERCEPT;
  for (let index = 0; index < WEIGHTS.length; index++) {
    const feature = features[index];
    value += WEIGHTS[index] *
      (typeof feature === "number" && Number.isFinite(feature) ? feature : MEDIANS[index]);
  }
  return value;
}
