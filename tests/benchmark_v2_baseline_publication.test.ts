import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { appendAttemptEvent, readEraState } from "../scripts/v0/benchmark_v2/attempts.ts";
import {
  discardUntouchedPendingBaselinePublication,
  publishBaselineWithLedger,
  recoverPendingBaselinePublication,
} from "../scripts/v0/benchmark_v2/baseline_publication.ts";
import { assertBaselineBundleLabel } from "../scripts/v0/benchmark_v2/rebaseline.ts";

let temporary: string | null = null;
afterEach(() => {
  if (temporary !== null) rmSync(temporary, { recursive: true, force: true });
  temporary = null;
});

function fixture() {
  temporary = mkdtempSync(join(tmpdir(), "line-v2-baseline-publication-"));
  const paths = {
    ledger: join(temporary, "attempts.jsonl"),
    projection: join(temporary, "era-state.json"),
  };
  const pendingPath = join(temporary, "pending.json");
  const bundlePath = join(temporary, "bundle.json");
  const baselinePath = join(temporary, "baseline.json");
  const frozenPath = join(temporary, "frozen.txt");
  writeFileSync(bundlePath, JSON.stringify({
    schema: "line.benchmark-v2.baseline-bundle.v3",
    label: "base-new",
  }));
  writeFileSync(baselinePath, JSON.stringify({ label: "base-old" }));
  appendAttemptEvent({
    type: "era-start",
    eraId: "era-1",
    cause: "bootstrap",
    baselineLabel: "base-old",
    budgetCap: 0.05,
  }, paths, "2026-07-12T00:00:00.000Z");
  appendAttemptEvent({
    type: "transition",
    reason: "test transition",
    operator: "test",
  }, paths, "2026-07-12T00:00:01.000Z");
  const freeze = (path: string): void => writeFileSync(frozenPath, readFileSync(path));
  const event = { type: "baseline-transition-complete", baselineLabel: "base-new" } as const;
  return { paths, pendingPath, bundlePath, baselinePath, frozenPath, freeze, event };
}

describe("recoverable baseline publication", () => {
  test("refuses a transition bundle whose label differs from the ledger label", () => {
    temporary = mkdtempSync(join(tmpdir(), "line-v2-baseline-label-"));
    const dir = temporary;
    const bundle = join(dir, "bundle.json");
    writeFileSync(bundle, JSON.stringify({
      schema: "line.benchmark-v2.baseline-bundle.v3",
      label: "bundle-label",
    }));
    expect(() => assertBaselineBundleLabel(bundle, "cli-label"))
      .toThrow(/does not match bundle label/);
    expect(() => assertBaselineBundleLabel(bundle, "bundle-label")).not.toThrow();
  });
  test("recovers a crash after baseline files but before the ledger event", () => {
    const input = fixture();
    expect(() => publishBaselineWithLedger(input.bundlePath, input.event, {
      paths: input.paths,
      pendingPath: input.pendingPath,
      freeze: input.freeze,
      afterFreeze: () => { throw new Error("injected crash"); },
    })).toThrow(/injected crash/);
    expect(existsSync(input.pendingPath)).toBe(true);
    expect(readEraState(input.paths).baselineLabel).toBe("base-old");

    const recovered = recoverPendingBaselinePublication({
      paths: input.paths,
      pendingPath: input.pendingPath,
      freeze: input.freeze,
    });
    expect(recovered?.baselineLabel).toBe("base-new");
    expect(recovered?.transitionPending).toBe(false);
    expect(existsSync(input.pendingPath)).toBe(false);
  });

  test("does not mistake a reused transition label for an appended completion", () => {
    const input = fixture();
    writeFileSync(input.bundlePath, JSON.stringify({
      schema: "line.benchmark-v2.baseline-bundle.v3",
      label: "base-old",
    }));
    const sameLabelEvent = {
      type: "baseline-transition-complete",
      baselineLabel: "base-old",
    } as const;
    expect(() => publishBaselineWithLedger(input.bundlePath, sameLabelEvent, {
      paths: input.paths,
      pendingPath: input.pendingPath,
      freeze: input.freeze,
      afterFreeze: () => { throw new Error("injected same-label crash"); },
    })).toThrow(/same-label crash/);
    expect(readEraState(input.paths).transitionPending).toBe(true);

    const recovered = recoverPendingBaselinePublication({
      paths: input.paths,
      pendingPath: input.pendingPath,
      freeze: input.freeze,
    });
    expect(recovered?.baselineLabel).toBe("base-old");
    expect(recovered?.transitionPending).toBe(false);
    expect(existsSync(input.pendingPath)).toBe(false);
  });

  test("refuses publication while a migration journal exists", () => {
    const input = fixture();
    const migrationPending = join(temporary!, "migration-pending.json");
    writeFileSync(migrationPending, "{}\n");
    expect(() => publishBaselineWithLedger(input.bundlePath, input.event, {
      paths: input.paths,
      pendingPath: input.pendingPath,
      conflictingPendingPath: migrationPending,
      freeze: input.freeze,
    })).toThrow(/migration publication is pending/);
    expect(readEraState(input.paths).transitionPending).toBe(true);
    expect(existsSync(input.pendingPath)).toBe(false);
  });

  test("pins and revalidates the bundle label inside publication", () => {
    const input = fixture();
    writeFileSync(input.bundlePath, JSON.stringify({
      schema: "line.benchmark-v2.baseline-bundle.v3",
      label: "different-label",
    }));
    expect(() => publishBaselineWithLedger(input.bundlePath, input.event, {
      paths: input.paths,
      pendingPath: input.pendingPath,
      conflictingPendingPath: join(temporary!, "no-migration.json"),
      freeze: input.freeze,
    })).toThrow(/does not match pinned bundle label/);
    expect(readEraState(input.paths).transitionPending).toBe(true);
  });

  test("cleans a journal after the ledger event was already committed", () => {
    const input = fixture();
    expect(() => publishBaselineWithLedger(input.bundlePath, input.event, {
      paths: input.paths,
      pendingPath: input.pendingPath,
      freeze: input.freeze,
      afterLedgerAppend: () => { throw new Error("injected crash after ledger"); },
    })).toThrow(/injected crash after ledger/);
    expect(readEraState(input.paths).baselineLabel).toBe("base-new");
    expect(existsSync(input.pendingPath)).toBe(true);

    const recovered = recoverPendingBaselinePublication({
      paths: input.paths,
      pendingPath: input.pendingPath,
      freeze: input.freeze,
    });
    expect(recovered?.baselineLabel).toBe("base-new");
    expect(existsSync(input.pendingPath)).toBe(false);
  });

  test("refuses recovery if the journaled bundle changed", () => {
    const input = fixture();
    expect(() => publishBaselineWithLedger(input.bundlePath, input.event, {
      paths: input.paths,
      pendingPath: input.pendingPath,
      freeze: input.freeze,
      afterFreeze: () => { throw new Error("injected crash"); },
    })).toThrow(/injected crash/);
    writeFileSync(input.bundlePath, "different bundle\n");
    expect(() => recoverPendingBaselinePublication({
      paths: input.paths,
      pendingPath: input.pendingPath,
      freeze: input.freeze,
    })).toThrow(/bundle changed after publication was journaled/);
    expect(existsSync(input.pendingPath)).toBe(true);
    expect(readEraState(input.paths).baselineLabel).toBe("base-old");
  });

  test("discards only a journal that reached neither baseline nor ledger", () => {
    const input = fixture();
    expect(() => publishBaselineWithLedger(input.bundlePath, input.event, {
      paths: input.paths,
      pendingPath: input.pendingPath,
      freeze: input.freeze,
      afterFreeze: () => { throw new Error("injected pre-publication crash"); },
    })).toThrow(/pre-publication crash/);
    discardUntouchedPendingBaselinePublication({
      paths: input.paths,
      pendingPath: input.pendingPath,
      baselinePath: input.baselinePath,
    });
    expect(existsSync(input.pendingPath)).toBe(false);
    expect(readEraState(input.paths).baselineLabel).toBe("base-old");
  });

  test("refuses to discard a journal if baseline files may have changed", () => {
    const input = fixture();
    expect(() => publishBaselineWithLedger(input.bundlePath, input.event, {
      paths: input.paths,
      pendingPath: input.pendingPath,
      freeze: input.freeze,
      afterFreeze: () => { throw new Error("injected pre-publication crash"); },
    })).toThrow(/pre-publication crash/);
    writeFileSync(input.baselinePath, JSON.stringify({ label: "base-new" }));
    expect(() => discardUntouchedPendingBaselinePublication({
      paths: input.paths,
      pendingPath: input.pendingPath,
      baselinePath: input.baselinePath,
    })).toThrow(/may have changed baseline files/);
    expect(existsSync(input.pendingPath)).toBe(true);
  });
});
