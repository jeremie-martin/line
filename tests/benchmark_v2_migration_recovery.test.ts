import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { appendAttemptEvent } from "../scripts/v0/benchmark_v2/attempts.ts";
import { recoverPendingMigration } from "../scripts/v0/benchmark_v2/migrate.ts";

let temporary: string | null = null;

afterEach(() => {
  if (temporary !== null) rmSync(temporary, { recursive: true, force: true });
  temporary = null;
});

describe("migration publication recovery", () => {
  test("recovers exactly once after the publisher is killed behind the durable journal", async () => {
    temporary = mkdtempSync(join(tmpdir(), "line-v2-migration-kill-"));
    const paths = {
      ledger: join(temporary, "attempts.jsonl"),
      projection: join(temporary, "era-state.json"),
    };
    const pendingPath = join(temporary, "migration-pending.json");
    const conflictingPendingPath = join(temporary, "baseline-pending.json");
    const migrationsLedgerPath = join(temporary, "migrations.jsonl");
    const baselinePath = join(temporary, "baseline.json");
    const fixturePath = join(temporary, "fixture.json");
    const inputPath = join(temporary, "input.json");
    const readyPath = join(temporary, "journal-ready");
    const baselineBefore = `${JSON.stringify({ label: "old" })}\n`;
    const baselineAfter = `${JSON.stringify({ label: "new" })}\n`;
    const fixture = `${JSON.stringify({ stable: true })}\n`;
    writeFileSync(baselinePath, baselineBefore);
    writeFileSync(fixturePath, fixture);
    appendAttemptEvent({
      type: "era-start",
      eraId: "era-test",
      cause: "bootstrap",
      baselineLabel: "old",
      budgetCap: 0.05,
    }, paths, "2026-07-12T00:00:00.000Z");

    const hash = (value: string): string => createHash("sha256").update(value).digest("hex");
    const record = {
      schema: "line.benchmark-v2.migration-record.v1",
      migrationId: "migration-kill-test",
      effectiveScope: "protocol",
      restamped: { baselineSha256: hash(baselineAfter) },
      conformance: { fixture: { afterSha256: hash(fixture) } },
    };
    writeFileSync(inputPath, `${JSON.stringify({
      record,
      previousMigrationId: null,
      baselinePath,
      baselineBeforeSha256: hash(baselineBefore),
      baselineBytes: baselineAfter,
      baseline: { label: "new" },
      fixtureBeforeSha256: hash(fixture),
      fixtureBytes: null,
    })}\n`);

    const source = `
      import { readFileSync, writeFileSync } from "node:fs";
      import { publishMigration } from "./scripts/v0/benchmark_v2/migrate.ts";
      const input = JSON.parse(readFileSync(process.env.INPUT, "utf8"));
      publishMigration(input, {
        attemptPaths: { ledger: process.env.ATTEMPTS, projection: process.env.PROJECTION },
        pendingPath: process.env.PENDING,
        conflictingPendingPath: process.env.CONFLICTING,
        migrationsLedgerPath: process.env.MIGRATIONS,
        fixturePath: process.env.FIXTURE,
        restampBaselineDoc: () => {},
        afterJournal: () => {
          writeFileSync(process.env.READY, "ready\\n");
          process.stdout.write("journal-durable\\n");
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60_000);
        },
      });
    `;
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", source], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        INPUT: inputPath,
        ATTEMPTS: paths.ledger,
        PROJECTION: paths.projection,
        PENDING: pendingPath,
        CONFLICTING: conflictingPendingPath,
        MIGRATIONS: migrationsLedgerPath,
        FIXTURE: fixturePath,
        READY: readyPath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForFile(readyPath);
    child.kill("SIGKILL");
    await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));

    expect(existsSync(pendingPath)).toBe(true);
    expect(readFileSync(baselinePath, "utf8")).toBe(baselineBefore);
    const options = {
      attemptPaths: paths,
      pendingPath,
      conflictingPendingPath,
      migrationsLedgerPath,
      fixturePath,
      restampBaselineDoc: () => {},
    };
    expect(recoverPendingMigration(options)?.migrationId).toBe(record.migrationId);
    expect(readFileSync(baselinePath, "utf8")).toBe(baselineAfter);
    expect(readFileSync(migrationsLedgerPath, "utf8").trim().split("\n")).toHaveLength(1);
    expect(existsSync(pendingPath)).toBe(false);
    expect(recoverPendingMigration(options)).toBeNull();
  }, 15_000);
});

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${path}`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
}
