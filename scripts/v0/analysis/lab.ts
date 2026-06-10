/**
 * lab — query CLI over the golden-run analysis dataset.
 *
 *   npm run lab -- index [--full] [--include-old] [--roots a,b]
 *   npm run lab -- runs [--sort headline|name|date] [--json]
 *   npm run lab -- sql "SELECT ..." [--json]
 *   npm run lab -- report <name> [--axis impact] [--run NAME] [--spec NAME]
 *                  [--all-fingerprints] [--json]
 *
 * `sql` opens the database read-only — safe for ad-hoc exploration. The DB file
 * (generated/analysis/lab.sqlite) is also directly readable from Python stdlib
 * sqlite3.
 */

import { openLab, getMeta } from "./db.ts";
import { indexRoots } from "./indexer.ts";
import { REPORTS, printRows, resolveRun, type ReportOptions } from "./reports.ts";

type Args = { positional: string[]; flags: Map<string, string | true> };

const VALUE_FLAGS = new Set(["axis", "run", "spec", "sort", "roots", "budget"]);

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      flags.set(arg.slice(2, eq), arg.slice(eq + 1));
    } else if (VALUE_FLAGS.has(arg.slice(2)) && i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      flags.set(arg.slice(2), argv[++i]);
    } else {
      flags.set(arg.slice(2), true);
    }
  }
  return { positional, flags };
}

function usage(): never {
  console.error(
    [
      "usage: npm run lab -- <command>",
      "  index   [--full] [--include-old] [--roots a,b]   build/refresh the dataset",
      "  simulate [--run NAME] [--budget N] [--force]     re-simulate a run's tracks → landings tier",
      "  runs    [--sort headline|name|date] [--json]     one line per indexed run",
      '  sql     "SELECT ..." [--json]                    ad-hoc read-only SQL',
      `  report  <${Object.keys(REPORTS).join("|")}>`,
      "          [--axis impact] [--run NAME] [--spec NAME] [--all-fingerprints] [--json]",
    ].join("\n"),
  );
  process.exit(1);
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const command = positional[0];
const json = flags.has("json");

if (command === "index") {
  const db = openLab();
  const t0 = Date.now();
  const stats = indexRoots(db, {
    full: flags.has("full"),
    includeOld: flags.has("include-old"),
    roots: typeof flags.get("roots") === "string"
      ? String(flags.get("roots")).split(",")
      : undefined,
    log: (msg) => console.log(msg),
  });
  db.close();
  console.log(
    `index done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ` +
      `scanned ${stats.scanned}, ingested ${stats.ingested}, skipped ${stats.skipped}, ` +
      `pruned ${stats.pruned}, reports ok ${stats.reports_ok}, ` +
      `reports skipped ${stats.reports_skipped}, issues ${stats.issues}`,
  );
} else if (command === "simulate") {
  const { simulateRun } = await import("./simulate.ts");
  const db = openLab();
  const run = resolveRun(db, {
    run: typeof flags.get("run") === "string" ? String(flags.get("run")) : undefined,
    allFingerprints: flags.has("all-fingerprints"),
  });
  console.log(`simulating ${run.name}`);
  const t0 = Date.now();
  const budgetFlag = flags.get("budget");
  const stats = await simulateRun(db, {
    runId: run.run_id,
    budget: typeof budgetFlag === "string" ? Number(budgetFlag) : undefined,
    force: flags.has("force"),
    log: (msg) => console.log(msg),
  });
  db.close();
  console.log(
    `simulate done in ${((Date.now() - t0) / 1000).toFixed(1)}s — ` +
      `${stats.simulated} simulated (${stats.landings} landings), ` +
      `${stats.skipped} already done, ${stats.failed} failed of ${stats.checkpoints}`,
  );
} else if (command === "runs") {
  const db = openLab({ readonly: true });
  const sort = flags.get("sort") ?? "headline";
  const orderBy = sort === "name" ? "name" : sort === "date" ? "golden_mtime_ms DESC" : "headline_score DESC";
  const fingerprint = getMeta(db, "current_fingerprint");
  const rows = db.prepare(`
    SELECT name, tier, evaluator_fingerprint AS fingerprint,
      CASE WHEN evaluator_fingerprint = ? THEN '' ELSE 'STALE' END AS fp_status,
      headline_score, score_without_impact,
      score_without_impact - headline_score AS impact_cost,
      checkpoint_count, n_reports_ok, source_commit, source_dirty
    FROM runs ORDER BY ${orderBy}
  `).all(fingerprint) as Record<string, unknown>[];
  printRows(rows, json);
  db.close();
} else if (command === "sql") {
  const query = positional[1];
  if (query === undefined) usage();
  const db = openLab({ readonly: true });
  const rows = db.prepare(query).all() as Record<string, unknown>[];
  printRows(rows, json);
  db.close();
} else if (command === "report") {
  const name = positional[1];
  const report = name !== undefined ? REPORTS[name] : undefined;
  if (report === undefined) usage();
  const db = openLab({ readonly: true });
  const opts: ReportOptions = {
    json,
    axis: typeof flags.get("axis") === "string" ? String(flags.get("axis")) : undefined,
    run: typeof flags.get("run") === "string" ? String(flags.get("run")) : undefined,
    spec: typeof flags.get("spec") === "string" ? String(flags.get("spec")) : undefined,
    allFingerprints: flags.has("all-fingerprints"),
  };
  report(db, opts);
  db.close();
} else {
  usage();
}
