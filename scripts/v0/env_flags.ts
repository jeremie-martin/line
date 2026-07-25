/**
 * Environment flags sampled once per compile instead of once per call.
 *
 * `process.env.X` is not a property read. It is an interceptor call into the
 * host environment, measured on this host at ~268 ns against ~0.8 ns for a
 * cached boolean — 330x. A flag consulted on a per-candidate path therefore
 * costs real compile time: `LR_PROJECTED_RECOVERABILITY` was 4.4% of an entire
 * compile while being read only once per scored gap.
 *
 * A compile is the coarsest scope that still honors how every test, study and
 * script actually uses these flags: set the variable, then run a compile. The
 * value cannot change during one compile anyway — compilation is synchronous —
 * so nothing observable is given up by reading it at the start instead of
 * 111,000 times along the way.
 */

let epoch = 0;

/** Invalidate every compile-scoped flag. Called when a compile begins. */
export function beginEnvFlagEpoch(): void {
  epoch++;
}

/**
 * A reader for one environment variable whose value is fetched at most once per
 * compile. Bind it at module scope, call it wherever the flag is needed.
 */
export function compileScopedEnv(name: string): () => string | undefined {
  let readEpoch = -1;
  let value: string | undefined;
  return () => {
    if (readEpoch !== epoch) {
      value = (globalThis as {
        process?: { env?: Record<string, string | undefined> };
      }).process?.env?.[name];
      readEpoch = epoch;
    }
    return value;
  };
}
