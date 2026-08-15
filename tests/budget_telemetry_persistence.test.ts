import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openLab } from "../scripts/v0/analysis/db.ts";
import { indexRoots } from "../scripts/v0/analysis/indexer.ts";
import { SCHEMA_VERSION } from "../scripts/v0/analysis/schema.ts";

const temporary: string[] = [];

afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("budget telemetry persistence", () => {
  test("indexes a golden checkpoint payload into the versioned lab column", () => {
    const root = mkdtempSync(join(tmpdir(), "line-budget-telemetry-index-"));
    temporary.push(root);
    const runDir = join(root, "telemetry-run");
    const databasePath = join(root, "lab.sqlite");
    const telemetry = {
      schema: "line.compile-budget-telemetry.v10",
      level: "summary",
      compile: { total_spent_frames: 123 },
    };
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "golden.json"), `${JSON.stringify({
      compiler: "handoff",
      budgets: [750_000],
      rows: [{
        name: "tiny",
        variant: "base",
        seed: 0,
        checkpoints: [{
          budget: 750_000,
          status: "pass",
          budget_telemetry: telemetry,
        }],
      }],
    })}\n`);

    const db = openLab({ dbPath: databasePath });
    try {
      const stats = indexRoots(db, { roots: [root], full: true });
      expect(stats.ingested).toBe(1);
      const row = db.prepare(
        "SELECT budget_telemetry_json FROM checkpoints WHERE spec = 'tiny'",
      ).get() as { budget_telemetry_json: string };
      expect(JSON.parse(row.budget_telemetry_json)).toEqual(telemetry);
      const version = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as {
        value: string;
      };
      expect(Number(version.value)).toBe(SCHEMA_VERSION);
    } finally {
      db.close();
    }
  });
});
