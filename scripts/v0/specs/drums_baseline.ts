/**
 * drums baseline — single section with air=0.7. Reference point against which
 * other drums-spec variations are compared.
 */
import { drumsSpec } from "./_drums.ts";

const spec = drumsSpec([{ t0: 0, t1: 30, air: 0.7 }]);
export default spec;
