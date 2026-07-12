import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { appendAttemptEvent } from "../scripts/v0/benchmark_v2/attempts.ts";

let temporary: string | null = null;

afterEach(() => {
  if (temporary !== null) rmSync(temporary, { recursive: true, force: true });
  temporary = null;
});

describe("eval declaration freshness", () => {
  test("refuses when a serialized baseline mutation lands before the declaration append", async () => {
    temporary = mkdtempSync(join(tmpdir(), "line-v2-declaration-race-"));
    const ledger = join(temporary, "attempts.jsonl");
    const projection = join(temporary, "era-state.json");
    const baselinePath = join(temporary, "baseline.json");
    const ready = join(temporary, "holder-ready");
    const release = join(temporary, "release-holder");
    const baseline = JSON.parse(readFileSync("benchmark/v2/baseline.json", "utf8"));
    writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
    appendAttemptEvent({
      type: "era-start",
      eraId: "era-race",
      cause: "bootstrap",
      baselineLabel: baseline.label,
      budgetCap: 0.05,
    }, { ledger, projection }, "2026-07-12T00:00:00.000Z");

    const holderSource = `
      import { existsSync, readFileSync, writeFileSync } from "node:fs";
      import { withAttemptLedgerTransaction } from "./scripts/v0/benchmark_v2/attempts.ts";
      withAttemptLedgerTransaction({ ledger: process.env.LEDGER, projection: process.env.PROJECTION }, () => {
        writeFileSync(process.env.READY, "ready\\n");
        while (!existsSync(process.env.RELEASE)) {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
        }
        const baseline = JSON.parse(readFileSync(process.env.BASELINE, "utf8"));
        baseline.label = baseline.label + "-migrated";
        writeFileSync(process.env.BASELINE, JSON.stringify(baseline, null, 2) + "\\n");
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
      });
    `;
    const validatorSource = `
      import { withAttemptLedgerTransaction } from "./scripts/v0/benchmark_v2/attempts.ts";
      import { revalidateDeclarationUnderLock } from "./scripts/v0/benchmark_v2/eval.ts";
      import { loadSourceManifest, resolveSources } from "./scripts/v0/benchmark_v2/model.ts";
      import { suiteIdentity } from "./scripts/v0/benchmark_v2/suite_model.ts";
      const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
      const identity = suiteIdentity(
        "benchmark/v2/compat/suite-manifest.json",
        "benchmark/v2/compat/source-manifest.json",
        sources,
      );
      try {
        withAttemptLedgerTransaction({ ledger: process.env.LEDGER, projection: process.env.PROJECTION }, (transaction) => {
          revalidateDeclarationUnderLock({
            state: transaction.state,
            expectedSuiteFingerprint: identity.suiteFingerprint,
            sources,
            baselinePath: process.env.BASELINE,
            mode: "improvement",
            margin: null,
            depth: 48,
          });
        });
        process.stdout.write("committed");
      } catch (error) {
        process.stdout.write("refused:" + error.message);
      }
    `;
    const environment = {
      ...process.env,
      LEDGER: ledger,
      PROJECTION: projection,
      BASELINE: baselinePath,
      READY: ready,
      RELEASE: release,
    };
    const holder = spawnNode(holderSource, environment);
    await waitForFile(ready);
    const validator = spawnNode(validatorSource, environment);
    writeFileSync(release, "release\n");
    const [holderResult, validatorResult] = await Promise.all([
      collect(holder),
      collect(validator),
    ]);
    expect(holderResult.code).toBe(0);
    expect(validatorResult.code).toBe(0);
    expect(validatorResult.stdout).toMatch(/refused:baseline or era changed/);
  }, 20_000);
});

function spawnNode(source: string, env: NodeJS.ProcessEnv): ChildProcess {
  return spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", source], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function collect(child: ChildProcess): Promise<{ code: number | null; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  child.stdout!.on("data", (chunk) => stdout += chunk);
  child.stderr!.on("data", (chunk) => stderr += chunk);
  return new Promise((resolveResult) => child.on("close", (code) => resolveResult({ code, stdout, stderr })));
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${path}`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 10));
  }
}
