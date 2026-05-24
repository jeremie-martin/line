/**
 * One-off: dump the raw metric values for every reference track. Used to
 * (a) sanity-check the metric module, (b) calibrate weights so the cool
 * references rank above the bland with a comfortable margin, and (c)
 * generate eval/metric_validation.csv for human inspection.
 *
 *   npx tsx scripts/dump_reference_metrics.ts
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { evaluateTrack, type FullMetrics } from "./lib/metrics.ts";
import { type TrackJson } from "./lib/primitive.ts";

const REF_ROOT = resolve("eval/references");

type Row = {
  label: "cool" | "bland";
  file: string;
  m: FullMetrics;
};

function loadDir(dir: string, label: "cool" | "bland"): Row[] {
  const out: Row[] = [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".track.json")) continue;
    const path = resolve(dir, f);
    const track = JSON.parse(readFileSync(path, "utf8")) as TrackJson;
    console.error(`  scoring ${label}/${f} ... lines=${track.lines.length} duration=${track.duration}`);
    const m = evaluateTrack(track);
    out.push({ label, file: f, m });
  }
  return out;
}

const cool = loadDir(resolve(REF_ROOT, "cool"), "cool");
const bland = loadDir(resolve(REF_ROOT, "bland"), "bland");
const all = [...cool, ...bland];

// ── Pretty table to stdout ──
const cols: Array<{ key: keyof FullMetrics["geom"] | keyof FullMetrics["behav"] | "cool"; from: "geom" | "behav" | "cool"; fmt: (n: number | boolean) => string }> = [
  { key: "lineCount",            from: "geom",  fmt: (n) => String(n) },
  { key: "totalLengthPx",        from: "geom",  fmt: (n) => (n as number).toFixed(0) },
  { key: "angleStdDeg",          from: "geom",  fmt: (n) => (n as number).toFixed(1) },
  { key: "angleEntropyBits",     from: "geom",  fmt: (n) => (n as number).toFixed(2) },
  { key: "verticalExtentPx",     from: "geom",  fmt: (n) => (n as number).toFixed(0) },
  { key: "horizontalExtentPx",   from: "geom",  fmt: (n) => (n as number).toFixed(0) },
  { key: "verticalRatio",        from: "geom",  fmt: (n) => (n as number).toFixed(2) },
  { key: "spreadEfficiency",     from: "geom",  fmt: (n) => (n as number).toFixed(2) },
  { key: "survived",             from: "behav", fmt: (b) => (b ? "Y" : "N") },
  { key: "liveFraction",         from: "behav", fmt: (n) => (n as number).toFixed(2) },
  { key: "eventRatePerSec",      from: "behav", fmt: (n) => (n as number).toFixed(2) },
  { key: "eventTypeEntropyBits", from: "behav", fmt: (n) => (n as number).toFixed(2) },
  { key: "trajectoryVerticalPx", from: "behav", fmt: (n) => (n as number).toFixed(0) },
  { key: "vySignFlips",          from: "behav", fmt: (n) => String(n) },
  { key: "meanSpeedSliding",     from: "behav", fmt: (n) => (n as number).toFixed(2) },
  { key: "cool",                 from: "cool",  fmt: (n) => (n as number).toFixed(0) },
];

const header = ["label", "file", ...cols.map((c) => c.key as string)];
const rows: string[][] = [header];
for (const r of all) {
  const cells: string[] = [r.label, r.file];
  for (const c of cols) {
    let v: number | boolean;
    if (c.from === "geom") v = (r.m.geom as any)[c.key];
    else if (c.from === "behav") v = (r.m.behav as any)[c.key];
    else v = r.m.cool;
    cells.push(c.fmt(v));
  }
  rows.push(cells);
}

const widths = header.map((_, i) => Math.max(...rows.map((row) => row[i].length)));
const fmtRow = (row: string[]) => row.map((c, i) => c.padEnd(widths[i])).join("  ");
console.log("");
console.log(fmtRow(rows[0]));
console.log(widths.map((w) => "─".repeat(w)).join("──"));
for (let i = 1; i < rows.length; i++) console.log(fmtRow(rows[i]));

// ── Separation summary ──
const coolScores = cool.map((r) => r.m.cool).sort((a, b) => a - b);
const blandScores = bland.map((r) => r.m.cool).sort((a, b) => a - b);
const minCool = coolScores[0];
const maxBland = blandScores[blandScores.length - 1];
const margin = minCool > 0 ? (minCool - maxBland) / minCool : NaN;
console.log("");
console.log(`Cool scores  : ${coolScores.map((s) => s.toFixed(0)).join(", ")}`);
console.log(`Bland scores : ${blandScores.map((s) => s.toFixed(0)).join(", ")}`);
console.log(`min(cool)=${minCool.toFixed(0)}, max(bland)=${maxBland.toFixed(0)}, margin=${(margin * 100).toFixed(1)}%`);
console.log(`PASS: min(cool) > max(bland) with margin > 20%? ${minCool > maxBland && margin > 0.2 ? "YES" : "NO"}`);

// ── CSV output ──
mkdirSync(resolve("eval"), { recursive: true });
const csvLines = [rows[0].join(",")];
for (let i = 1; i < rows.length; i++) csvLines.push(rows[i].join(","));
writeFileSync(resolve("eval/metric_validation.csv"), csvLines.join("\n"));
console.log(`\nwrote eval/metric_validation.csv`);
