/**
 * Runtime boundary for the sealed long-carrier replication.
 *
 * The study records source and candidate bytes; Node/tsx loader overrides
 * would otherwise be a second, unrecorded way to change their meaning. Keep
 * the launcher strict and give children only the host settings they need to
 * find Node's cache, temporary files, and `git`.
 */
const FORBIDDEN_NAMES = new Set([
  "NODE_OPTIONS",
  "NODE_PATH",
  "NODE_PRESERVE_SYMLINKS",
  "NODE_PRESERVE_SYMLINKS_MAIN",
  "LD_AUDIT",
  "LD_LIBRARY_PATH",
  "LD_PRELOAD",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
]);

const FORBIDDEN_PREFIXES = ["TSX_", "TS_NODE_"] as const;

const OPERATIONAL_CHILD_ENVIRONMENT_NAMES = [
  "HOME",
  "PATH",
  "TMPDIR",
  "TMP",
  "TEMP",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
] as const;

export function assertLongCarrierReplicationRuntimeEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  const forbidden = Object.keys(environment)
    .filter((name) => FORBIDDEN_NAMES.has(name) || FORBIDDEN_PREFIXES.some((prefix) => name.startsWith(prefix)))
    .sort();
  if (forbidden.length > 0) {
    throw new Error(
      `long-carrier replication forbids semantic loader/runtime environment variable(s): ${forbidden.join(", ")}`,
    );
  }
}

/** Construct the exact non-semantic environment passed to sealed child processes. */
export function longCarrierReplicationChildEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  assertLongCarrierReplicationRuntimeEnvironment(environment);
  const child: NodeJS.ProcessEnv = {};
  for (const name of OPERATIONAL_CHILD_ENVIRONMENT_NAMES) {
    const value = environment[name];
    if (value !== undefined) child[name] = value;
  }
  child.LR_ENGINE = "wasm";
  return child;
}
