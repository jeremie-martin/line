/**
 * Regenerate the historical V1 baseline regions of docs/archive/handoff-compiler-v1.html
 * from a golden budget-curve JSON.
 *
 * Usage:
 *   LR_ENGINE=wasm npx tsx scripts/v0/golden.ts --jobs=6 --archive-dir=generated/golden-runs/rebaseline
 *   npx tsx scripts/v0/update_compiler_doc.ts generated/golden-runs/rebaseline/golden.json
 *
 * Or pipe directly:
 *   LR_ENGINE=wasm npx tsx scripts/v0/golden.ts --json --jobs=6 \
 *     | npx tsx scripts/v0/update_compiler_doc.ts -
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

type SpecScore = { name: string; score: number; passed: number; total: number };
type BudgetScore = {
  budget: number;
  score: number;
  passed: number;
  total: number;
  changed_tracks: number;
  improved_rows: number;
  plateau_rows: number;
  regressions: number;
  spec_scores: SpecScore[];
};
type GoldenCurve = {
  headline: {
    kind: string;
    tier?: string;
    score: number;
  };
  budgets: number[];
  evaluator_fingerprint: string;
  source?: {
    commit?: string;
    dirty?: boolean;
  };
  archive?: {
    dir?: string;
  };
  budget_scores: BudgetScore[];
};

const HTML_PATH = resolve("docs/archive/handoff-compiler-v1.html");
const HEADLINE_KIND = "weighted_budget_average";

function readGolden(arg: string): GoldenCurve {
  const raw = arg === "-" ? readFileSync(0, "utf8") : readFileSync(resolve(arg), "utf8");
  const d = JSON.parse(raw) as GoldenCurve;
  if (
    !Array.isArray(d.budget_scores) ||
    d.headline?.kind !== HEADLINE_KIND ||
    typeof d.headline.score !== "number"
  ) {
    throw new Error(`input does not look like a weighted golden curve run (missing budget_scores/headline.score kind=${HEADLINE_KIND})`);
  }
  return d;
}

function fillComment(html: string, key: string, body: string): string {
  const open = `<!--BASELINE:${key}-->`;
  const close = "<!--/BASELINE-->";
  const i = html.indexOf(open);
  if (i < 0) throw new Error(`marker not found: ${open}`);
  const j = html.indexOf(close, i + open.length);
  if (j < 0) throw new Error(`unterminated marker: ${open}`);
  return html.slice(0, i + open.length) + body + html.slice(j);
}

function fillScriptBaseline(html: string, key: string, body: string): string {
  const open = `/*BASELINE:${key}*/`;
  const close = "/*/BASELINE*/";
  const i = html.indexOf(open);
  if (i < 0) throw new Error(`marker not found: ${open}`);
  const j = html.indexOf(close, i + open.length);
  if (j < 0) throw new Error(`unterminated marker: ${open}`);
  return html.slice(0, i + open.length) + body + html.slice(j);
}

function formatBudget(n: number): string {
  return n % 1000 === 0 ? `${n / 1000}k` : String(n);
}

function budgetLabel(budgets: number[]): string {
  return `${formatBudget(budgets[0])}-${formatBudget(budgets[budgets.length - 1])} curve`;
}

function scoreBlock(scores: BudgetScore[]): string {
  return "\n" + scores.map((s) =>
    `${String(s.budget).padStart(6)}  score ${s.score.toFixed(2).padStart(7)}  ` +
      `valid ${String(s.passed).padStart(2)}/${s.total}  ` +
      `changed ${String(s.changed_tracks).padStart(2)}  ` +
      `improved ${String(s.improved_rows).padStart(2)}  ` +
      `plateau ${String(s.plateau_rows).padStart(2)}  ` +
      `regress ${String(s.regressions).padStart(2)}`
  ).join("\n");
}

function specRows(specs: SpecScore[]): string {
  const sorted = [...specs].sort((a, b) => b.score - a.score);
  const lines = sorted.map((s) => {
    const cls = s.passed < s.total ? "score-row fail" : "score-row";
    const width = (s.score / 10).toFixed(1);
    return `        <div class="${cls}"><span>${s.name}</span>` +
      `<div class="bar"><span style="width:${width}%"></span></div>` +
      `<span class="num">${s.score.toFixed(2)}</span></div>`;
  });
  return "\n" + lines.join("\n") + "\n        ";
}

function archiveLabel(d: GoldenCurve): string {
  const dir = d.archive?.dir;
  if (dir !== undefined && dir.length > 0) return basename(dir);
  return "golden.json";
}

function sourceLabel(d: GoldenCurve): string {
  const commit = d.source?.commit;
  if (commit === undefined || commit.length === 0) return "";
  return ` source <code>${commit.slice(0, 12)}${d.source?.dirty ? "-dirty" : ""}</code>,`;
}

function validityNote(d: GoldenCurve, last: BudgetScore): string {
  const tier = d.headline.tier ?? "golden";
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
  return `${tierName} archive <code>${archiveLabel(d)}</code>,${sourceLabel(d)} ` +
    `fp <code>${d.evaluator_fingerprint}</code>; ` +
    `${last.passed}/${last.total} valid at ${formatBudget(last.budget)}.`;
}

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: update_compiler_doc.ts <golden-curve.json | ->");
    process.exit(1);
  }
  const d = readGolden(arg);
  const last = d.budget_scores[d.budget_scores.length - 1];
  let html = readFileSync(HTML_PATH, "utf8");

  html = fillComment(html, "budget_label", budgetLabel(d.budgets));
  html = fillComment(html, "headline_score", d.headline.score.toFixed(2));
  html = fillComment(
    html,
    "valid_note",
    validityNote(d, last),
  );
  html = fillComment(html, "score_block", scoreBlock(d.budget_scores));
  html = fillComment(html, "spec_rows", specRows(last.spec_scores));

  const point = `["${budgetLabel(d.budgets)}", ${d.headline.score.toFixed(2)}]`;
  html = fillScriptBaseline(html, "campaign", point);

  writeFileSync(HTML_PATH, html);
  console.log(
    `updated docs/archive/handoff-compiler-v1.html -> headline ${d.headline.score.toFixed(2)}, ` +
      `${last.passed}/${last.total} valid at ${last.budget}, fp ${d.evaluator_fingerprint}`,
  );
}

main();
