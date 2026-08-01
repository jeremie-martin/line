/**
 * Recurrence guard for a whole-benchmark outage.
 *
 * `scripts/v0/benchmark_v2/runner.ts` is its own worker entry: it spawns
 * `new Worker(new URL(import.meta.url))`, and those worker threads load the
 * module WITHOUT the tsx loader — plain Node type stripping, which refuses any
 * TypeScript that needs transformation rather than erasure (constructor
 * parameter properties, enums, namespaces, non-`type` re-exports...).
 *
 * A TS constructor parameter property shipped in round_progress.ts, which the
 * runner imports. Every worker died at import; every benchmark run was broken
 * until someone read a worker's stderr. Nothing in the suite caught it, because
 * every test loads the module through tsx.
 *
 * This test therefore does what the worker does: a plain `process.execPath`
 * child, no loader, dynamic import of the runner. Module-level code may still
 * throw for want of runtime context — that happens AFTER the module parsed, so
 * only loader/parse failures fail this test.
 */

import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const MARKER = "__STRIP_ONLY_RESULT__";
const RUNNER = fileURLToPath(new URL("../scripts/v0/benchmark_v2/runner.ts", import.meta.url));

/** Loader-level failures: the module never became executable code. */
const LOADER_ERROR_CODES = new Set([
  "ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX",
  "ERR_INVALID_TYPESCRIPT_SYNTAX",
  "ERR_UNKNOWN_FILE_EXTENSION",
  "ERR_MODULE_NOT_FOUND",
  "ERR_UNSUPPORTED_DIR_IMPORT",
  "ERR_SYNTAX_ERROR",
]);

type LoadOutcome = { phase: "loaded" } | {
  phase: "failed";
  name: string;
  code: string;
  message: string;
};

/**
 * Import `modulePath` in a child Node with no loader and no inherited
 * NODE_OPTIONS, exactly as a worker thread would see it.
 */
function loadWithoutLoader(modulePath: string): LoadOutcome {
  const script = `
    const marker = ${JSON.stringify(MARKER)};
    import(${JSON.stringify(modulePath)}).then(
      () => process.stderr.write(marker + JSON.stringify({ phase: "loaded" }) + "\\n"),
      (error) => process.stderr.write(marker + JSON.stringify({
        phase: "failed",
        name: String(error && error.constructor && error.constructor.name),
        code: String(error && error.code),
        message: String(error && error.message).slice(0, 400),
      }) + "\\n"),
    );
  `;
  // Strip any tsx/ts-node registration the test runner put in the environment:
  // the point of this test is the bare-Node path.
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.TSX_TSCONFIG_PATH;
  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: resolve(fileURLToPath(new URL("..", import.meta.url))),
    encoding: "utf8",
    env,
    timeout: 60_000,
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const line = output.split("\n").find((entry) => entry.includes(MARKER));
  if (line === undefined) {
    throw new Error(
      `child produced no ${MARKER} line (status=${result.status}, signal=${result.signal}):\n${output}`,
    );
  }
  return JSON.parse(line.slice(line.indexOf(MARKER) + MARKER.length)) as LoadOutcome;
}

describe("benchmark v2 runner under strip-only type stripping", () => {
  test("the worker entry loads in bare Node, without the tsx loader", () => {
    const outcome = loadWithoutLoader(RUNNER);
    if (outcome.phase === "loaded") return;
    // A post-load runtime throw is acceptable: the worker would have parsed the
    // module and then failed on missing context. A loader/parse failure is not.
    const loaderFailure = LOADER_ERROR_CODES.has(outcome.code) ||
      /is not supported|strip-only|Unexpected token|Unknown file extension|Cannot find module/i
        .test(outcome.message);
    expect(
      loaderFailure,
      `runner.ts failed to LOAD under Node's strip-only type stripping — benchmark ` +
        `worker threads import it exactly this way, so every worker would die.\n` +
        `${outcome.name} [${outcome.code}]: ${outcome.message}`,
    ).toBe(false);
  }, 90_000);
});
