/**
 * Regenerate the hand-maintained baseline regions of docs/handoff-compiler.html
 * from a golden-suite JSON, so re-baselining is one command instead of editing
 * five hand-typed places (and never transcribing a number by hand).
 *
 * Usage:
 *   npx tsx scripts/v0/golden.ts --json --budget=50000 --jobs=4 > /tmp/g.json
 *   npx tsx scripts/v0/update_compiler_doc.ts /tmp/g.json
 *
 * Or pipe directly:
 *   npx tsx scripts/v0/golden.ts --json --budget=50000 --jobs=4 \
 *     | npx tsx scripts/v0/update_compiler_doc.ts -
 *
 * It edits these BASELINE-marked regions in the HTML:
 *   - hero card: budget label, goal_score, valid note
 *   - sanity `SCORE … / contract_pass_rate …` block
 *   - per-spec score-row table (sorted high→low, `fail` class on non-passing)
 *   - campaignData sparkline (appends/replaces the point for this budget)
 *
 * It does NOT touch GOAL_LDS_LOW_BUDGET.md or the EVALUATOR_FINGERPRINT constant
 * — those are updated separately (see docs/REBASELINE.md).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type SpecScore = { name: string; score: number; passed: number; total: number };
type Golden = {
  goal_score: number;
  passed: number;
  total: number;
  contract_pass_rate: number;
  budget_units: number;
  evaluator_fingerprint: string;
  spec_scores: SpecScore[];
};

const HTML_PATH = resolve("docs/handoff-compiler.html");

function readGolden(arg: string): Golden {
  const raw = arg === "-" ? readFileSync(0, "utf8") : readFileSync(resolve(arg), "utf8");
  const d = JSON.parse(raw) as Golden;
  if (!Array.isArray(d.spec_scores) || typeof d.goal_score !== "number") {
    throw new Error("input does not look like a golden --json run (missing spec_scores/goal_score)");
  }
  return d;
}

/** Replace the content between `<!--BASELINE:key-->` and `<!--/BASELINE-->`. */
function fillComment(html: string, key: string, body: string): string {
  const open = `<!--BASELINE:${key}-->`;
  const close = "<!--/BASELINE-->";
  const i = html.indexOf(open);
  if (i < 0) throw new Error(`marker not found: ${open}`);
  const j = html.indexOf(close, i + open.length);
  if (j < 0) throw new Error(`unterminated marker: ${open}`);
  return html.slice(0, i + open.length) + body + html.slice(j);
}

function budgetLabel(units: number): string {
  return units % 1000 === 0 ? `${units / 1000}k sanity run` : `${units} sanity run`;
}

function specRows(specs: SpecScore[]): string {
  const sorted = [...specs].sort((a, b) => b.score - a.score);
  const lines = sorted.map((s) => {
    const cls = s.passed < s.total ? "score-row fail" : "score-row";
    const width = (s.score / 10).toFixed(1); // score is 0..1000 → 0..100%
    return `        <div class="${cls}"><span>${s.name}</span>` +
      `<div class="bar"><span style="width:${width}%"></span></div>` +
      `<span class="num">${s.score.toFixed(2)}</span></div>`;
  });
  return "\n" + lines.join("\n") + "\n        ";
}

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: update_compiler_doc.ts <golden.json | ->");
    process.exit(1);
  }
  const d = readGolden(arg);
  const pct = Math.round(d.contract_pass_rate * 100);
  let html = readFileSync(HTML_PATH, "utf8");

  html = fillComment(html, "budget_label", budgetLabel(d.budget_units));
  html = fillComment(html, "goal_score", d.goal_score.toFixed(2));
  html = fillComment(html, "valid_note", `${d.passed} valid rows out of ${d.total}.`);
  html = fillComment(
    html,
    "score_block",
    `SCORE ${d.goal_score.toFixed(2)} - valid ${d.passed}/${d.total} - ` +
      `invalid ${d.total - d.passed} - timeout 0\ncontract_pass_rate ${pct}%`,
  );
  html = fillComment(html, "spec_rows", specRows(d.spec_scores));

  // campaignData: append (or replace) the point for this budget label.
  const label = `${new Set(d.spec_scores.map((s) => s.name)).size}-spec @${d.budget_units / 1000}k`;
  const point = `["${label}", ${d.goal_score.toFixed(2)}]`;
  const camOpen = "/*BASELINE:campaign*/";
  const camClose = "/*/BASELINE*/";
  const ci = html.indexOf(camOpen);
  const cj = html.indexOf(camClose, ci + camOpen.length);
  if (ci < 0 || cj < 0) throw new Error("campaign markers not found");
  const existing = html.slice(ci + camOpen.length, cj).trim();
  // existing is a comma-separated list of ["label", num] entries (or empty).
  const points = existing
    ? existing.split(/\],\s*\[/).map((s) => (s.startsWith("[") ? s : "[" + s)).map((s) => (s.endsWith("]") ? s : s + "]"))
    : [];
  const filtered = points.filter((p) => !p.startsWith(`["${label}"`));
  filtered.push(point);
  html = html.slice(0, ci + camOpen.length) + filtered.join(", ") + html.slice(cj);

  writeFileSync(HTML_PATH, html);
  console.log(
    `updated docs/handoff-compiler.html → goal ${d.goal_score.toFixed(2)}, ` +
      `valid ${d.passed}/${d.total}, ${pct}% pass, ${d.spec_scores.length} specs, fp ${d.evaluator_fingerprint}`,
  );
}

main();
