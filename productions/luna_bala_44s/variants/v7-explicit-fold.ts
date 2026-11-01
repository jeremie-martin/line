/**
 * luna_bala_44s, V7 explicit request (stratum E): folds requested on three groove passages.
 * The song's spec.ts unchanged; three consecutive gaps ask for fold (rail offered)
 * early, in the middle and late (productions/explicit_requests.ts). It tests
 * whether the construction can be realized; it is reported apart from the
 * V7 headline.
 */
import spec from "../spec.ts";
import { explicitRequest } from "../../explicit_requests.ts";
export { overlayMeta } from "../spec.ts";
export default spec;
export const bench = explicitRequest(spec, "fold", "offered", "folds requested on three groove passages");
