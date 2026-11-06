/** The compiler's definition of a valid ride, shared by search, production and
 * the gallery artifacts: the impact account decides, and it already requires the
 * ride to survive. */
export function validRide({impactEvaluation}: {impactEvaluation: {valid: boolean}}): boolean {
  return impactEvaluation.valid;
}
