/**
 * Recover Arc shapes from a v0 track JSON by grouping consecutive lines
 * whose endpoints meet (line[i].end == line[i+1].start). Reports per-Arc
 * start angle, end angle, total length, segment count — and the
 * distribution of each across all Arcs in the track.
 *
 *   npx tsx scripts/v0/analyze_arcs.ts generated/v0_drums_baseline.track.json [more...]
 */

import { readFileSync } from "node:fs";

type Line = { x1: number; y1: number; x2: number; y2: number };

function loadLines(path: string): Line[] {
  return JSON.parse(readFileSync(path, "utf8")).lines as Line[];
}

function recoverArcs(lines: Line[]): Line[][] {
  const out: Line[][] = [];
  let cur: Line[] = [];
  const EPS = 1e-6;
  for (const ln of lines) {
    if (cur.length === 0) { cur.push(ln); continue; }
    const last = cur[cur.length - 1];
    if (Math.hypot(ln.x1 - last.x2, ln.y1 - last.y2) < EPS) {
      cur.push(ln);
    } else {
      out.push(cur);
      cur = [ln];
    }
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

function angleDeg(l: Line): number {
  return Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180 / Math.PI;
}

function lineLen(l: Line): number {
  return Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
}

function quantiles(xs: number[], qs = [0.0, 0.25, 0.5, 0.75, 1.0]): number[] {
  if (xs.length === 0) return qs.map(() => NaN);
  const s = [...xs].sort((a, b) => a - b);
  return qs.map((q) => s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]);
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN; }
function stdev(xs: number[]): number { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); }

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("usage: analyze_arcs.ts <track.json> [more...]");
  process.exit(1);
}

for (const p of paths) {
  console.log(`\n══ ${p} ══`);
  const lines = loadLines(p);
  const arcs = recoverArcs(lines);
  console.log(`  ${lines.length} lines → ${arcs.length} Arcs (mean ${(lines.length / arcs.length).toFixed(1)} segments/Arc)`);

  const startAngles = arcs.map((a) => angleDeg(a[0]));
  const endAngles = arcs.map((a) => angleDeg(a[a.length - 1]));
  const angleDeltas = arcs.map((a) => angleDeg(a[a.length - 1]) - angleDeg(a[0]));
  const totalLens = arcs.map((a) => a.reduce((s, l) => s + lineLen(l), 0));
  const segCounts = arcs.map((a) => a.length);

  const fmt = (xs: number[], digits = 1) => {
    const [p0, p25, p50, p75, p100] = quantiles(xs);
    return `min=${p0.toFixed(digits)} p25=${p25.toFixed(digits)} p50=${p50.toFixed(digits)} p75=${p75.toFixed(digits)} max=${p100.toFixed(digits)} (μ=${mean(xs).toFixed(digits)} σ=${stdev(xs).toFixed(digits)})`;
  };

  console.log(`  startAngle°: ${fmt(startAngles)}`);
  console.log(`  endAngle°:   ${fmt(endAngles)}`);
  console.log(`  Δangle°:     ${fmt(angleDeltas)}`);
  console.log(`  totalLen:    ${fmt(totalLens)}`);
  console.log(`  segments:    ${fmt(segCounts, 0)}`);
}
