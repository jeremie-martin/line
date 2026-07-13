/**
 * Side-by-side comparison of two DriftReports across the WHOLE report:
 * survival, contact alignment (hit/drift/missing + frame-error magnitude),
 * off-beat violations, and the full v0 contract score.
 *
 *   npx tsx scripts/compare_reports.ts --a=<report.json> --b=<report.json> [--an=NAME --bn=NAME]
 *
 * Identified reports must bind the same report semantics and compiled spec.
 * Historical reports without identity can only be compared after explicitly
 * normalizing both achieved tracks to A or B's target surface:
 *
 *   ... --normalize-targets=b
 */
import { readFileSync } from "node:fs";
import { scoreDriftReport } from "./v0/score.ts";
import type { DriftReport } from "./v0/types.ts";
import {
  type IdentifiedDriftReport,
  normalizeReportTargets,
  reportComparisonIssue,
} from "./report_identity.ts";

const argv = process.argv.slice(2);
const arg = (n: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${n}=`));
  return m ? m.slice(n.length + 3) : null;
};

const aPath = arg("a")!, bPath = arg("b")!;
const aName = arg("an") ?? "A", bName = arg("bn") ?? "B";
let A = JSON.parse(readFileSync(aPath, "utf8")) as IdentifiedDriftReport;
let B = JSON.parse(readFileSync(bPath, "utf8")) as IdentifiedDriftReport;
const normalizeTargets = arg("normalize-targets");
if (normalizeTargets !== null && normalizeTargets !== "a" && normalizeTargets !== "b") {
  throw new Error(`--normalize-targets must be a or b, got ${normalizeTargets}`);
}
const comparisonIssue = reportComparisonIssue(A, B);
if (normalizeTargets === null && comparisonIssue !== null) {
  console.error(
    `reports are not score-comparable: ${comparisonIssue}.\n` +
      `Use --normalize-targets=a or --normalize-targets=b only when the reports describe ` +
      `the same contact topology and you intentionally want one report's target surface.`,
  );
  process.exit(2);
}
if (normalizeTargets !== null) {
  [A, B] = normalizeReportTargets(A, B, normalizeTargets);
  console.error(`normalized both reports to ${normalizeTargets.toUpperCase()}'s target surface`);
}

type Agg = { n: number; mean: number; p50: number; max: number };
function agg(xs: number[]): Agg {
  if (!xs.length) return { n: 0, mean: 0, p50: 0, max: 0 };
  const s = [...xs].sort((a, b) => a - b);
  return {
    n: xs.length,
    mean: xs.reduce((t, v) => t + v, 0) / xs.length,
    p50: s[Math.floor(s.length / 2)],
    max: s[s.length - 1],
  };
}

function summarize(r: IdentifiedDriftReport) {
  const by = { hit: 0, drift: 0, missing: 0 } as Record<string, number>;
  const hitErr: number[] = [], driftErr: number[] = [];
  for (const c of r.contacts) {
    by[c.status] = (by[c.status] ?? 0) + 1;
    const fe = (c as { frame_error?: number | null }).frame_error;
    if (fe != null && c.status === "hit") hitErr.push(Math.abs(fe));
    if (fe != null && c.status === "drift") driftErr.push(Math.abs(fe));
  }
  return {
    total: r.contacts.length,
    by,
    hitErr: agg(hitErr),
    driftErr: agg(driftErr),
    offbeat: r.off_beat_landings.length,
    term: `${r.terminus.reason} @ ${r.terminus.frame} (${(r.terminus.frame / 40).toFixed(2)}s)`,
    score: scoreDriftReport(r, { totalFrames: r._line?.totalFrames }),
  };
}

const a = summarize(A), b = summarize(B);
const pad = (s: string, n = 26) => String(s).padEnd(n);
const num = (x: number, d = 3) => (typeof x === "number" ? x.toFixed(d) : String(x));
const row = (label: string, av: string, bv: string) =>
  console.log(pad(label, 26) + "| " + pad(av, 26) + "| " + bv);

console.log("\n" + pad(`metric`, 26) + "| " + pad(aName, 26) + "| " + bName);
console.log("-".repeat(80));
row("terminus", a.term, b.term);
row("contacts (total)", String(a.total), String(b.total));
row("  hit", `${a.by.hit} (${(100 * a.by.hit / a.total).toFixed(0)}%)`, `${b.by.hit} (${(100 * b.by.hit / b.total).toFixed(0)}%)`);
row("  drift", `${a.by.drift} (${(100 * a.by.drift / a.total).toFixed(0)}%)`, `${b.by.drift} (${(100 * b.by.drift / b.total).toFixed(0)}%)`);
row("  missing", `${a.by.missing} (${(100 * a.by.missing / a.total).toFixed(0)}%)`, `${b.by.missing} (${(100 * b.by.missing / b.total).toFixed(0)}%)`);
row("hit |frame err| mean/max", `${num(a.hitErr.mean, 2)}/${a.hitErr.max}`, `${num(b.hitErr.mean, 2)}/${b.hitErr.max}`);
row("drift |frame err| mean/max", a.driftErr.n ? `${num(a.driftErr.mean, 2)}/${a.driftErr.max}` : "—", b.driftErr.n ? `${num(b.driftErr.mean, 2)}/${b.driftErr.max}` : "—");
row("off-beat landings", String(a.offbeat), String(b.offbeat));
console.log("-".repeat(80));
row("CONTRACT score", num(a.score.score), num(b.score.score));
row("  sync_score (hits/total)", num(a.score.sync_score), num(b.score.sync_score));
row("  sync_quality", num(a.score.sync_quality), num(b.score.sync_quality));
row("  off_beat_quality", num(a.score.off_beat_quality), num(b.score.off_beat_quality));
row("  axis_quality", num(a.score.axis_quality), num(b.score.axis_quality));
const ahf = (a.score as { hard_failures?: string[] }).hard_failures ?? [];
const bhf = (b.score as { hard_failures?: string[] }).hard_failures ?? [];
row("  hard_failures", ahf.length ? ahf.join(",") : "none", bhf.length ? bhf.join(",") : "none");
console.log("");
