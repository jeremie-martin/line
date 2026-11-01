/**
 * amour_de_ma_vie_44s, V7 explicit request (stratum E): terraces requested on three groove passages.
 * The song's spec.ts unchanged; three consecutive gaps ask for terraces (rail offered)
 * early, in the middle and late (productions/explicit_requests.ts). It tests
 * whether the construction can be realized; it is reported apart from the
 * V7 headline.
 */
import spec from "../spec.ts";
import { explicitRequest } from "../../explicit_requests.ts";

export default spec;
export const bench = explicitRequest(spec, "terraces", "offered", "terraces requested on three groove passages");
