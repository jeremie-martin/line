/**
 * Cross-seed comparison report. Given several track+report pairs from the
 * same Spec compiled with different seeds, summarize:
 *
 *  - per-track metrics (hits, drift, missing, off-beat, achieved air, lines, Arcs)
 *  - geometric variance across seeds (line count, mean Arc length, mean Arc
 *    start angle σ-of-σ, total horizontal extent)
 *
 * Determinism check: pairs of equal seeds should produce byte-identical tracks
 * (verified outside this script via md5sum).
 *
 *   npx tsx scripts/v0/compare_seeds.ts <track1.json> <track2.json> ...
 *
 * Each track path is paired with a sibling .report.json (same prefix).
 */

import { readFileSync } from "node:fs";

type Line = { x1: number; y1: number; x2: number; y2: number };

function load(prefix: string) {
  const track = JSON.parse(readFileSync(`${prefix}.track.json`, "utf8"));
  const report = JSON.parse(readFileSync(`${prefix}.report.json`, "utf8"));
  return { track, report };
}

function angleDeg(l: Line): number {
  return Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180 / Math.PI;
}

function lineLen(l: Line): number {
  return Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
}

function recoverArcs(lines: Line[]): Line[][] {
  const out: Line[][] = [];
  let cur: Line[] = [];
  for (const ln of lines) {
    if (cur.length === 0) { cur.push(ln); continue; }
    const last = cur[cur.length - 1];
    if (Math.hypot(ln.x1 - last.x2, ln.y1 - last.y2) < 1e-6) cur.push(ln);
    else { out.push(cur); cur = [ln]; }
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

function mean(xs: number[]): number { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function stdev(xs: number[]): number { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); }

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: compare_seeds.ts <prefix1> <prefix2> ...");
  console.error("  e.g.: compare_seeds.ts generated/v0_drums_baseline generated/v0_drums_baseline_s1 generated/v0_drums_baseline_s2");
  process.exit(1);
}

const summaries = args.map((prefix) => {
  const { track, report } = load(prefix);
  const lines = track.lines as Line[];
  const arcs = recoverArcs(lines);
  const arcLens = arcs.map((a) => a.reduce((s, l) => s + lineLen(l), 0));
  const arcStartAngles = arcs.map((a) => angleDeg(a[0]));

  const hits = report.contacts.filter((c: any) => c.status === "hit").length;
  const drift = report.contacts.filter((c: any) => c.status === "drift").length;
  const missing = report.contacts.filter((c: any) => c.status === "missing").length;

  const xs = lines.flatMap((l) => [l.x1, l.x2]);
  const ys = lines.flatMap((l) => [l.y1, l.y2]);
  const xRange = Math.max(...xs) - Math.min(...xs);
  const yRange = Math.max(...ys) - Math.min(...ys);

  return {
    prefix,
    nLines: lines.length,
    nArcs: arcs.length,
    hits, drift, missing,
    offBeat: report.off_beat_landings.length,
    achievedAir: report.sections[0]?.axes?.air?.achieved,
    arcLen: { mean: mean(arcLens), stdev: stdev(arcLens) },
    arcStartAngle: { mean: mean(arcStartAngles), stdev: stdev(arcStartAngles) },
    xRange, yRange,
  };
});

// Per-track table
console.log("prefix                                                 | lines | Arcs | hit/drift/miss | offBeat | air   | meanArcLen | meanStartAng° | xRange  | yRange");
console.log("─".repeat(180));
for (const s of summaries) {
  const name = s.prefix.length > 52 ? "..." + s.prefix.slice(-49) : s.prefix.padEnd(52);
  console.log(`${name} | ${String(s.nLines).padStart(5)} | ${String(s.nArcs).padStart(4)} | ${String(s.hits).padStart(2)}/${String(s.drift).padStart(2)}/${String(s.missing).padStart(2)}        | ${String(s.offBeat).padStart(7)} | ${(s.achievedAir ?? 0).toFixed(3)} | ${s.arcLen.mean.toFixed(1).padStart(10)} | ${s.arcStartAngle.mean.toFixed(1).padStart(13)} | ${String(Math.round(s.xRange)).padStart(7)} | ${String(Math.round(s.yRange)).padStart(6)}`);
}

// Cross-seed variance
console.log();
console.log("Cross-seed variance (σ across the runs above):");
const metric = (xs: number[]) => `μ=${mean(xs).toFixed(1)} σ=${stdev(xs).toFixed(2)}`;
console.log(`  nLines:          ${metric(summaries.map((s) => s.nLines))}`);
console.log(`  nArcs:           ${metric(summaries.map((s) => s.nArcs))}`);
console.log(`  meanArcLen:      ${metric(summaries.map((s) => s.arcLen.mean))}`);
console.log(`  meanStartAngle°: ${metric(summaries.map((s) => s.arcStartAngle.mean))}`);
console.log(`  xRange:          ${metric(summaries.map((s) => s.xRange))}`);
console.log(`  hits:            ${metric(summaries.map((s) => s.hits))}`);
console.log(`  achievedAir:     ${metric(summaries.map((s) => s.achievedAir ?? 0))}`);
