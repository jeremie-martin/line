import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { BENCHMARK_EXECUTION_PROTOCOL } from "../../../benchmark/v2/decision-policy.ts";

export const RUNNER_COMPATIBILITY_SCHEMA = "line.benchmark-v2.runner-compatibility.v1" as const;
export const DEFAULT_RUNNER_COMPATIBILITY_PATH = "benchmark/v2/runner-compatibility.json";

export type RunnerCompatibilityApproval = {
  fromImplementationFingerprint: string;
  toImplementationFingerprint: string;
  executionProtocol: typeof BENCHMARK_EXECUTION_PROTOCOL;
  suiteFingerprint: string;
  reviewedBy: string;
  reviewedAt: string;
  rationale: string;
  evidence: { path: string; sha256: string; result: "bit-identical" };
};

/**
 * The bit-level row canonicalization used by runner-compatibility evidence:
 * semantic task fields only (manifest paths are machine-local absolute paths
 * whose CONTENT is already bound by the suite and source fingerprints),
 * plus the complete scored outcome of the compile.
 */
export function canonicalArchiveRows(
  archive: { runs?: Array<Record<string, any>> },
  label: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const run of archive.runs ?? []) {
    if (run.status !== "ok") throw new Error(`${label}: non-ok run ${run.task?.sourceId}`);
    const key = [run.task.sourceId, run.task.budget, run.task.seedSlot, run.task.actualSeed].join("\u0000");
    map.set(key, JSON.stringify({
      task: {
        mode: run.task.mode,
        sourceId: run.task.sourceId,
        budget: run.task.budget,
        seedSlot: run.task.seedSlot,
        actualSeed: run.task.actualSeed,
        joltMs: run.task.joltMs,
      },
      report: run.report,
      score: run.score,
      trackHash: run.trackHash,
      authoredContacts: run.authoredContacts,
    }));
  }
  return map;
}

export function compareArchiveRows(
  retained: { runs?: Array<Record<string, any>> },
  replay: { runs?: Array<Record<string, any>> },
): { comparedRows: number; mismatches: string[] } {
  const retainedRows = canonicalArchiveRows(retained, "retained");
  const replayRows = canonicalArchiveRows(replay, "replay");
  if (retainedRows.size !== replayRows.size) {
    throw new Error(`row counts differ: retained ${retainedRows.size} vs replay ${replayRows.size}`);
  }
  const mismatches: string[] = [];
  for (const [key, row] of retainedRows) {
    if (replayRows.get(key) !== row) mismatches.push(key.replaceAll("\u0000", "/"));
  }
  return { comparedRows: retainedRows.size, mismatches };
}

export function runnerCompatibilityApproval(
  fromImplementationFingerprint: string,
  toImplementationFingerprint: string,
  suiteFingerprint: string,
  path = DEFAULT_RUNNER_COMPATIBILITY_PATH,
): RunnerCompatibilityApproval | null {
  if (fromImplementationFingerprint === toImplementationFingerprint) return null;
  const manifest = JSON.parse(readFileSync(path, "utf8")) as {
    schema: string;
    approvals: RunnerCompatibilityApproval[];
  };
  if (manifest.schema !== RUNNER_COMPATIBILITY_SCHEMA || !Array.isArray(manifest.approvals)) {
    throw new Error(`unsupported runner compatibility manifest`);
  }
  const approval = manifest.approvals.find((entry) =>
    entry.fromImplementationFingerprint === fromImplementationFingerprint &&
    entry.toImplementationFingerprint === toImplementationFingerprint &&
    entry.executionProtocol === BENCHMARK_EXECUTION_PROTOCOL &&
    entry.suiteFingerprint === suiteFingerprint
  );
  if (approval === undefined) {
    throw new Error(`runner implementation fingerprints differ without an approved compatibility record`);
  }
  assertValidApproval(approval);
  return approval;
}

/**
 * Require runner equivalence for a baseline assembled from retained evidence.
 * Besides an ordinary direct approval, accept exactly one simple transitive
 * form: both implementations independently replayed bit-identically against
 * the same frozen anchor under the same suite/protocol.  This is equality by
 * shared evidence, not a general approval graph.
 */
export function assertRunnerImplementationsCompatible(
  firstImplementationFingerprint: string,
  secondImplementationFingerprint: string,
  suiteFingerprint: string,
  path = DEFAULT_RUNNER_COMPATIBILITY_PATH,
): void {
  if (firstImplementationFingerprint === secondImplementationFingerprint) return;
  const manifest = JSON.parse(readFileSync(path, "utf8")) as {
    schema: string;
    approvals: RunnerCompatibilityApproval[];
  };
  if (manifest.schema !== RUNNER_COMPATIBILITY_SCHEMA || !Array.isArray(manifest.approvals)) {
    throw new Error(`unsupported runner compatibility manifest`);
  }
  const matching = manifest.approvals.filter((entry) =>
    entry.executionProtocol === BENCHMARK_EXECUTION_PROTOCOL &&
    entry.suiteFingerprint === suiteFingerprint,
  );
  const direct = matching.find((entry) =>
    entry.fromImplementationFingerprint === firstImplementationFingerprint &&
    entry.toImplementationFingerprint === secondImplementationFingerprint,
  );
  if (direct !== undefined) {
    assertValidApproval(direct);
    return;
  }
  const firstProofs = matching.filter((entry) => entry.toImplementationFingerprint === firstImplementationFingerprint);
  const secondProofs = matching.filter((entry) => entry.toImplementationFingerprint === secondImplementationFingerprint);
  for (const firstProof of firstProofs) {
    const secondProof = secondProofs.find((entry) =>
      entry.fromImplementationFingerprint === firstProof.fromImplementationFingerprint,
    );
    if (secondProof !== undefined) {
      assertValidApproval(firstProof);
      assertValidApproval(secondProof);
      return;
    }
  }
  throw new Error(`runner implementation fingerprints differ without direct or common-anchor compatibility evidence`);
}

function assertValidApproval(approval: RunnerCompatibilityApproval): void {
  if (
    approval.reviewedBy.trim() === "" || !Number.isFinite(Date.parse(approval.reviewedAt)) ||
    approval.rationale.trim() === "" || approval.evidence.result !== "bit-identical" ||
    !existsSync(approval.evidence.path)
  ) {
    throw new Error(`runner compatibility approval is incomplete`);
  }
  const evidenceSha256 = createHash("sha256").update(readFileSync(approval.evidence.path)).digest("hex");
  if (evidenceSha256 !== approval.evidence.sha256) {
    throw new Error(`runner compatibility evidence checksum mismatch`);
  }
}
