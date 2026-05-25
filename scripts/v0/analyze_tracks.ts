/**
 * Quick analytical summary of one or more v0 track JSONs.
 * Reports per-track: line count, length distribution, angle distribution,
 * spatial extent. Used for variety/determinism investigations.
 *
 *   npx tsx scripts/v0/analyze_tracks.ts generated/v0_drums_baseline.track.json [more...]
 */

import { readFileSync } from "node:fs";

type Line = { x1: number; y1: number; x2: number; y2: number };

function loadLines(path: string): Line[] {
  const j = JSON.parse(readFileSync(path, "utf8"));
  return j.lines as Line[];
}

function quantiles(xs: number[], qs = [0.0, 0.25, 0.5, 0.75, 1.0]): number[] {
  if (xs.length === 0) return qs.map(() => NaN);
  const s = [...xs].sort((a, b) => a - b);
  return qs.map((q) => {
    const i = Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))));
    return s[i];
  });
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function stdev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

function fmt(x: number, digits = 1): string {
  return x.toFixed(digits).padStart(8);
}

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("usage: analyze_tracks.ts <track.json> [more...]");
  process.exit(1);
}

console.log("file                                                  | lines | len p0/p25/p50/p75/p100      | angle (deg) p25/p50/p75   | x range            | y range");
console.log("─".repeat(180));

for (const p of paths) {
  const lines = loadLines(p);
  const lens = lines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
  const angles = lines.map((l) => Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180 / Math.PI);
  const xs = lines.flatMap((l) => [l.x1, l.x2]);
  const ys = lines.flatMap((l) => [l.y1, l.y2]);

  const [pLen0, pLen25, pLen50, pLen75, pLen100] = quantiles(lens);
  const [, pAng25, pAng50, pAng75] = quantiles(angles);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);

  const name = p.length > 52 ? "..." + p.slice(-49) : p.padEnd(52);
  console.log(
    `${name} | ${String(lines.length).padStart(5)} | ${fmt(pLen0)} ${fmt(pLen25)} ${fmt(pLen50)} ${fmt(pLen75)} ${fmt(pLen100)} | ${fmt(pAng25)} ${fmt(pAng50)} ${fmt(pAng75)} | ${fmt(xMin, 0)} … ${fmt(xMax, 0)} | ${fmt(yMin, 0)} … ${fmt(yMax, 0)}`,
  );
}
