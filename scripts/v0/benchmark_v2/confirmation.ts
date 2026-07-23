/**
 * Compatibility surface for historical benchmark fingerprints.
 *
 * The live workflow reads the accepted baseline directly.  Keeping this module
 * path stable preserves the identity of existing evidence without restoring
 * the former confirmation machinery.
 */
export {
  DEFAULT_BASELINE_PATH,
  readBaselineContract,
  type BaselineContract,
} from "./baseline_contract.ts";
