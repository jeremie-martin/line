/**
 * Empirical study for the redirection impact metric.
 *
 * Reads detailed golden archives, re-simulates checkpoint tracks, joins authored
 * impact targets to their landing episodes, and prints corpus-level correlates of
 * high/low achieved redirection impact.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_redir_fundamentals.ts \
 *     generated/golden-runs/impact-redir-contact4-slice-01/golden.json
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_redir_fundamentals.ts --budget=all \
 *     generated/golden-runs/impact-redir-baseline-slice-details-01/golden.json \
 *     generated/golden-runs/impact-redir-contact4-slice-01/golden.json
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { impactCeiling, secToFrame } from "./types.ts";
import * as SS from "./study_support.ts";

type AxisReport = {
  target?: number;
  achieved?: number;
  error?: number;
  ceiling?: number;
  raw?: { target?: number; achieved?: number; error?: number; unit?: string };
};

type GapReport = {
  gap_index: number;
  t_end: number;
  survived?: boolean;
  axes?: Record<string, AxisReport>;
};

type DriftReport = {
  gaps?: GapReport[];
};

type GoldenCheckpoint = {
  budget: number;
  status?: string;
  score?: number;
  contract_passed?: boolean;
  track_path?: string;
  report_path?: string;
};

type GoldenRow = {
  name: string;
  variant?: string;
  seed: number;
  status?: string;
  checkpoints?: GoldenCheckpoint[];
};

type GoldenArchive = {
  archive?: string | { dir?: string; json_path?: string; checkpoint_dir?: string };
  rows?: GoldenRow[];
};

type Episode = {
  archive: string;
  rowName: string;
  variant: string;
  seed: number;
  budget: number;
  score: number;
  gap: number;
  landingFrame: number;
  targetFrame: number;
  target: number;
  achieved: number;
  reportAchieved: number;
  signedError: number;
  absError: number;
  ceiling: number;
  incomingSpeed: number;
  incomingAngleDeg: number;
  achievedPx: number;
  turnNetDeg: number;
  velPerpPx: number;
  velParSlowdownPx: number;
  velDvTotalPx: number;
  velDvGravPx: number;
  redirRatePx: number;
  redirAtLandingPx: number;
  peakOffset: number;
  ratePeakOffset: number;
  pointNormalPx: number;
  windowedNormalPx: number;
  tangentDeltaDeg: number;
  tangentSignedDeltaDeg: number;
  tangentPredNorm: number;
  tangentChangeDeg: number;
  contactFrames: number;
  initialContactRun: number;
  contactLineCount: number;
  comDecelNormalPx: number;
  sledRotDeg: number;
  bodyJoltPx: number;
  bodyWhipPx: number;
  deformPeakPx: number;
  deformDeltaPx: number;
  deformRatePx: number;
  bindComprPx: number;
  targetAir: number;
  achievedAir: number;
  targetSpeed: number;
  achievedSpeed: number;
  rawTargetSpeedPx: number;
  rawAchievedSpeedPx: number;
  targetElevation: number;
  achievedElevation: number;
  targetAmplitude: number;
  achievedAmplitude: number;
};

const argv = process.argv.slice(2);

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function argFlag(name: string): boolean {
  return argv.includes(`--${name}`);
}

function usage(exitCode = 1): never {
  console.error("usage: LR_ENGINE=wasm npx tsx scripts/v0/study_redir_fundamentals.ts [--budget=300000|all] [--max-rows=N] archive.json ...");
  process.exit(exitCode);
}

if (argFlag("help") || argFlag("h")) usage(0);

const budgetArg = argValue("budget") ?? "300000";
const allBudgets = budgetArg === "all";
const budgetFilter = allBudgets ? null : Number(budgetArg);
if (!allBudgets && !Number.isFinite(budgetFilter)) usage();

const maxRows = argValue("max-rows") === undefined ? Infinity : Number(argValue("max-rows"));
if (!Number.isFinite(maxRows) && argValue("max-rows") !== undefined) usage();

const archiveArgs = argv.filter((arg) => !arg.startsWith("--"));
if (archiveArgs.length === 0) usage();

const W = SS.IMPACT_WINDOW;
const hyp = Math.hypot;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function finite(x: number): boolean {
  return Number.isFinite(x);
}

function fmt(x: number, digits = 3): string {
  return finite(x) ? x.toFixed(digits) : "n/a";
}

function fmt2(x: number): string {
  return fmt(x, 2);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function archiveLabel(path: string, archive: GoldenArchive): string {
  const fromArchive = typeof archive.archive === "string"
    ? archive.archive
    : archive.archive?.dir ?? dirname(path);
  return basename(fromArchive);
}

function axis(gap: GapReport, name: string): AxisReport | undefined {
  return gap.axes?.[name];
}

function angleDeg(x: number, y: number): number {
  return Math.atan2(y, x) * 180 / Math.PI;
}

function normalizeDeg(deg: number): number {
  let out = deg % 360;
  if (out > 180) out -= 360;
  if (out < -180) out += 360;
  return out;
}

function axisDeltaDeg(aDeg: number, bDeg: number): number {
  const d = Math.abs(normalizeDeg(aDeg - bDeg));
  return d > 90 ? 180 - d : d;
}

function firstSurfaceTangent(sim: SS.Sim, lf: number): [number, number] | null {
  for (let f = lf; f <= Math.min(sim.last, lf + W); f++) {
    const t = SS.surfaceTangentAt(sim, f);
    if (t !== null) return t;
  }
  return null;
}

function tangentChangeDeg(sim: SS.Sim, lf: number, first: [number, number] | null): number {
  if (first === null) return NaN;
  const firstDeg = angleDeg(first[0], first[1]);
  let out = 0;
  for (let f = lf; f <= Math.min(sim.last, lf + W); f++) {
    const t = SS.surfaceTangentAt(sim, f);
    if (t === null) continue;
    out = Math.max(out, axisDeltaDeg(firstDeg, angleDeg(t[0], t[1])));
  }
  return out;
}

function contactStats(sim: SS.Sim, lf: number): { frames: number; run: number; lineCount: number } {
  let frames = 0;
  let run = 0;
  let stillInitial = true;
  const ids = new Set<number>();
  for (let f = lf; f <= Math.min(sim.last, lf + W); f++) {
    const cids = sim.cids[f] ?? [];
    if (cids.length > 0) {
      frames++;
      for (const id of cids) ids.add(id);
      if (stillInitial) run++;
    } else {
      stillInitial = false;
    }
  }
  return { frames, run, lineCount: ids.size };
}

function redirEpisodeDetails(sim: SS.Sim, lf: number): {
  rate: number;
  atLanding: number;
  peakOffset: number;
  ratePeakOffset: number;
} {
  const v0 = sim.vel[lf - 1] ?? sim.vel[lf];
  if (v0 === undefined) return { rate: 0, atLanding: 0, peakOffset: -1, ratePeakOffset: -1 };
  const speed = hyp(v0.x, v0.y);
  if (speed <= 1e-9) return { rate: 0, atLanding: 0, peakOffset: -1, ratePeakOffset: -1 };
  const hx = v0.x / speed;
  const hy = v0.y / speed;
  let prev = 0;
  let rate = 0;
  let atLanding = 0;
  let peak = -Infinity;
  let peakOffset = -1;
  let ratePeakOffset = -1;
  for (let f = lf; f <= Math.min(sim.last, lf + W); f++) {
    const v = sim.vel[f];
    if (v === undefined) continue;
    const perp = Math.abs(hx * v.y - hy * v.x);
    if (f === lf) atLanding = perp;
    if (f > lf && Math.abs(perp - prev) > rate) {
      rate = Math.abs(perp - prev);
      ratePeakOffset = f - lf;
    }
    if (perp > peak) {
      peak = perp;
      peakOffset = f - lf;
    }
    prev = perp;
  }
  return { rate, atLanding, peakOffset, ratePeakOffset };
}

function makeEpisode(
  archive: string,
  row: GoldenRow,
  checkpoint: GoldenCheckpoint,
  gap: GapReport,
  sim: SS.Sim,
): Episode | null {
  const impact = axis(gap, "impact");
  if (impact?.target === undefined || impact.achieved === undefined) return null;

  const targetFrame = secToFrame(gap.t_end);
  const lf = SS.landingNear(sim, targetFrame);
  if (lf < 0) return null;

  const vIn = sim.vel[lf - 1] ?? sim.vel[lf];
  if (vIn === undefined) return null;
  const incomingSpeed = hyp(vIn.x, vIn.y);
  const incomingAngleDeg = angleDeg(vIn.x, vIn.y);
  const tangent = firstSurfaceTangent(sim, lf);
  const tangentDeg = tangent === null ? NaN : angleDeg(tangent[0], tangent[1]);
  const tangentSignedDeltaDeg = tangent === null ? NaN : normalizeDeg(tangentDeg - incomingAngleDeg);
  const tangentDelta = tangent === null ? NaN : axisDeltaDeg(tangentDeg, incomingAngleDeg);
  const tangentPredNorm = finite(tangentDelta)
    ? clamp01(Math.abs(Math.sin(tangentDelta * Math.PI / 180)) * incomingSpeed / SS.REDIR_CAP)
    : NaN;

  const achievedPx = SS.redirPx(sim, lf, W);
  const vel = SS.velChange(sim, lf, W);
  const body = SS.bodyJolt(sim, lf, W);
  const deform = SS.deformStats(sim, lf, W);
  const contacts = contactStats(sim, lf);
  const redir = redirEpisodeDetails(sim, lf);
  const target = impact.target;
  const achieved = achievedPx / SS.REDIR_CAP;

  return {
    archive,
    rowName: row.name,
    variant: row.variant ?? "base",
    seed: row.seed,
    budget: checkpoint.budget,
    score: checkpoint.score ?? NaN,
    gap: gap.gap_index,
    landingFrame: lf,
    targetFrame,
    target,
    achieved,
    reportAchieved: impact.achieved,
    signedError: target - achieved,
    absError: Math.abs(target - achieved),
    ceiling: impact.ceiling ?? impactCeiling(incomingSpeed),
    incomingSpeed,
    incomingAngleDeg,
    achievedPx,
    turnNetDeg: SS.turnNetDeg(sim, lf, W),
    velPerpPx: vel.perp,
    velParSlowdownPx: vel.par,
    velDvTotalPx: vel.dvTotal,
    velDvGravPx: vel.dvGrav,
    redirRatePx: redir.rate,
    redirAtLandingPx: redir.atLanding,
    peakOffset: redir.peakOffset,
    ratePeakOffset: redir.ratePeakOffset,
    pointNormalPx: SS.pointImpactPx(sim, lf) ?? 0,
    windowedNormalPx: SS.windowedNormalPx(sim, lf, W),
    tangentDeltaDeg: tangentDelta,
    tangentSignedDeltaDeg,
    tangentPredNorm,
    tangentChangeDeg: tangentChangeDeg(sim, lf, tangent),
    contactFrames: contacts.frames,
    initialContactRun: contacts.run,
    contactLineCount: contacts.lineCount,
    comDecelNormalPx: SS.comDecelNormalPx(sim, lf, W),
    sledRotDeg: SS.sledRotDeg(sim, lf, W),
    bodyJoltPx: body.jolt,
    bodyWhipPx: body.whip,
    deformPeakPx: deform?.peak ?? NaN,
    deformDeltaPx: deform?.delta ?? NaN,
    deformRatePx: deform?.rate ?? NaN,
    bindComprPx: deform?.bindCompr ?? NaN,
    targetAir: axis(gap, "air")?.target ?? NaN,
    achievedAir: axis(gap, "air")?.achieved ?? NaN,
    targetSpeed: axis(gap, "speed")?.target ?? NaN,
    achievedSpeed: axis(gap, "speed")?.achieved ?? NaN,
    rawTargetSpeedPx: axis(gap, "speed")?.raw?.target ?? NaN,
    rawAchievedSpeedPx: axis(gap, "speed")?.raw?.achieved ?? NaN,
    targetElevation: axis(gap, "elevation")?.target ?? NaN,
    achievedElevation: axis(gap, "elevation")?.achieved ?? NaN,
    targetAmplitude: axis(gap, "amplitude")?.target ?? NaN,
    achievedAmplitude: axis(gap, "amplitude")?.achieved ?? NaN,
  };
}

function loadArchive(pathArg: string): {
  label: string;
  episodes: Episode[];
  checkpoints: number;
  misses: number;
  errors: string[];
} {
  const path = resolve(pathArg);
  if (!existsSync(path)) throw new Error(`archive not found: ${path}`);
  const golden = readJson<GoldenArchive>(path);
  const label = archiveLabel(path, golden);
  const episodes: Episode[] = [];
  let checkpoints = 0;
  let misses = 0;
  const errors: string[] = [];
  let rowsSeen = 0;

  for (const row of golden.rows ?? []) {
    if (rowsSeen >= maxRows) break;
    rowsSeen++;
    for (const checkpoint of row.checkpoints ?? []) {
      if (budgetFilter !== null && checkpoint.budget !== budgetFilter) continue;
      if (checkpoint.track_path === undefined || checkpoint.report_path === undefined) {
        misses++;
        continue;
      }
      if (!existsSync(checkpoint.track_path) || !existsSync(checkpoint.report_path)) {
        misses++;
        continue;
      }
      checkpoints++;
      try {
        const track = readJson<any>(checkpoint.track_path);
        const report = readJson<DriftReport>(checkpoint.report_path);
        const sim = SS.simulateTrack(track);
        for (const gap of report.gaps ?? []) {
          const rec = makeEpisode(label, row, checkpoint, gap, sim);
          if (rec === null) continue;
          episodes.push(rec);
        }
      } catch (err) {
        errors.push(`${row.name}/s${row.seed}/b${checkpoint.budget}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { label, episodes, checkpoints, misses, errors };
}

function values(rows: Episode[], key: keyof Episode): number[] {
  return rows.map((row) => row[key]).filter((v): v is number => typeof v === "number" && finite(v));
}

function mean(xs: number[]): number {
  return SS.mean(xs);
}

function pct(xs: number[], p: number): number {
  return SS.pct(xs, p);
}

function pairValues(rows: Episode[], key: keyof Episode, yKey: keyof Episode): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const row of rows) {
    const x = row[key];
    const y = row[yKey];
    if (typeof x !== "number" || typeof y !== "number" || !finite(x) || !finite(y)) continue;
    xs.push(x);
    ys.push(y);
  }
  return { xs, ys };
}

function corr(rows: Episode[], key: keyof Episode, yKey: keyof Episode): { pearson: number; spearman: number; n: number } {
  const { xs, ys } = pairValues(rows, key, yKey);
  return { pearson: SS.pearson(xs, ys), spearman: SS.spearman(xs, ys), n: xs.length };
}

function summarizeQuantiles(rows: Episode[]): void {
  for (const key of ["target", "achieved", "signedError", "absError", "incomingSpeed", "turnNetDeg", "tangentDeltaDeg", "tangentChangeDeg"] as const) {
    const xs = values(rows, key);
    console.log(
      `  ${key.padEnd(18)} mean ${fmt(mean(xs))}  p10 ${fmt(pct(xs, 0.10))}  p50 ${fmt(pct(xs, 0.50))}  p90 ${fmt(pct(xs, 0.90))}`,
    );
  }
}

const FEATURE_KEYS: (keyof Episode)[] = [
  "incomingSpeed",
  "rawAchievedSpeedPx",
  "turnNetDeg",
  "velParSlowdownPx",
  "velDvGravPx",
  "redirRatePx",
  "redirAtLandingPx",
  "pointNormalPx",
  "windowedNormalPx",
  "tangentDeltaDeg",
  "tangentPredNorm",
  "tangentChangeDeg",
  "contactFrames",
  "initialContactRun",
  "contactLineCount",
  "comDecelNormalPx",
  "sledRotDeg",
  "bodyJoltPx",
  "bodyWhipPx",
  "deformDeltaPx",
  "bindComprPx",
  "targetAir",
  "targetSpeed",
  "targetElevation",
  "targetAmplitude",
];

function printCorrelations(rows: Episode[], yKey: keyof Episode, title: string): void {
  const ranked = FEATURE_KEYS.map((key) => ({ key, ...corr(rows, key, yKey) }))
    .filter((item) => item.n >= 20 && finite(item.spearman))
    .sort((a, b) => Math.abs(b.spearman) - Math.abs(a.spearman));
  console.log(`\n  ${title}`);
  for (const item of ranked.slice(0, 14)) {
    console.log(
      `    ${String(item.key).padEnd(20)} rho ${fmt(item.spearman)}  r ${fmt(item.pearson)}  n ${item.n}`,
    );
  }
}

function meanOf(rows: Episode[], key: keyof Episode): number {
  return mean(values(rows, key));
}

function printHighLow(rows: Episode[]): void {
  const sorted = [...rows].sort((a, b) => a.achieved - b.achieved);
  const n = Math.max(1, Math.floor(sorted.length * 0.10));
  const low = sorted.slice(0, n);
  const high = sorted.slice(-n);
  const keys: (keyof Episode)[] = [
    "target",
    "achieved",
    "incomingSpeed",
    "turnNetDeg",
    "tangentDeltaDeg",
    "tangentChangeDeg",
    "contactFrames",
    "initialContactRun",
    "velParSlowdownPx",
    "pointNormalPx",
    "bodyJoltPx",
    "deformDeltaPx",
  ];
  console.log(`\n  Top 10% achieved vs bottom 10% achieved (means, n=${n} each)`);
  for (const key of keys) {
    console.log(`    ${String(key).padEnd(20)} low ${fmt(meanOf(low, key))}  high ${fmt(meanOf(high, key))}`);
  }
}

/** Distribution of `peakOffset` — the frame within the post-landing window where
 *  the redirection peak occurs, relative to first contact. If peaks systematically
 *  trail first contact, the *felt* beat trails the detector's landing frame
 *  (landing-redefinition ladder A: most-impactful-frame alignment). */
function printPeakOffsets(rows: Episode[]): void {
  const subsets: [string, Episode[]][] = [
    ["all episodes", rows],
    ["achieved ≥ 0.35", rows.filter((r) => r.achieved >= 0.35)],
    ["target ≥ 0.55", rows.filter((r) => r.target >= 0.55)],
  ];
  for (const key of ["peakOffset", "ratePeakOffset"] as const) {
    console.log(key === "peakOffset"
      ? "\n  peakOffset (frames from first contact to CUMULATIVE redirection peak)"
      : "\n  ratePeakOffset (frames from first contact to peak per-frame redirection RATE — the jolt)");
    for (const [label, subset] of subsets) {
      const xs = values(subset, key).filter((v) => v >= 0);
      if (xs.length === 0) continue;
      const counts = new Map<number, number>();
      for (const v of xs) counts.set(v, (counts.get(v) ?? 0) + 1);
      const hist = [...counts.keys()].sort((a, b) => a - b)
        .map((k) => `+${k}:${(100 * (counts.get(k) ?? 0) / xs.length).toFixed(0)}%`)
        .join(" ");
      console.log(
        `    ${label.padEnd(16)} n ${String(xs.length).padStart(5)}  mean ${fmt(mean(xs), 2)}  ` +
        `p50 ${fmt(pct(xs, 0.5), 0)}  p90 ${fmt(pct(xs, 0.9), 0)}  [${hist}]`,
      );
    }
  }
}

type Band = { label: string; lo: number; hi: number };

function bucketRows(rows: Episode[], key: keyof Episode, bands: Band[]): void {
  console.log(`\n  Buckets by ${String(key)}`);
  console.log("    band          n   achieved  target  residual  speed  turn  tanDelta  tanChange  contact");
  for (const band of bands) {
    const subset = rows.filter((row) => {
      const v = row[key];
      return typeof v === "number" && finite(v) && v >= band.lo && v < band.hi;
    });
    if (subset.length === 0) continue;
    console.log(
      `    ${band.label.padEnd(11)} ${String(subset.length).padStart(4)} ` +
      `${fmt(meanOf(subset, "achieved")).padStart(8)} ` +
      `${fmt(meanOf(subset, "target")).padStart(7)} ` +
      `${fmt(meanOf(subset, "signedError")).padStart(8)} ` +
      `${fmt(meanOf(subset, "incomingSpeed")).padStart(6)} ` +
      `${fmt(meanOf(subset, "turnNetDeg")).padStart(5)} ` +
      `${fmt(meanOf(subset, "tangentDeltaDeg")).padStart(8)} ` +
      `${fmt(meanOf(subset, "tangentChangeDeg")).padStart(9)} ` +
      `${fmt(meanOf(subset, "contactFrames")).padStart(7)}`,
    );
  }
}

function printExamples(rows: Episode[]): void {
  const short = (row: Episode) =>
    `${row.rowName}/s${row.seed}/b${row.budget}/g${row.gap}/f${row.landingFrame} ` +
    `target ${fmt2(row.target)} achieved ${fmt2(row.achieved)} err ${fmt2(row.signedError)} ` +
    `speed ${fmt2(row.incomingSpeed)} turn ${fmt2(row.turnNetDeg)} tan ${fmt2(row.tangentDeltaDeg)} tanChg ${fmt2(row.tangentChangeDeg)} contact ${row.contactFrames}`;

  console.log("\n  Highest achieved impact examples");
  for (const row of [...rows].sort((a, b) => b.achieved - a.achieved).slice(0, 8)) {
    console.log(`    ${short(row)}`);
  }

  console.log("\n  Worst under-target impact examples");
  for (const row of [...rows].sort((a, b) => b.signedError - a.signedError).slice(0, 8)) {
    console.log(`    ${short(row)}`);
  }
}

function summarizeArchive(label: string, rows: Episode[], checkpoints: number, misses: number, errors: string[]): void {
  console.log(`\n=== ${label} ===`);
  console.log(`  checkpoints ${checkpoints}  impact episodes ${rows.length}  missing-detail ${misses}  replay-errors ${errors.length}`);
  for (const error of errors.slice(0, 5)) console.log(`  skipped ${error}`);
  if (rows.length === 0) return;
  summarizeQuantiles(rows);
  printCorrelations(rows, "achieved", "Correlates of achieved redirection impact");
  printCorrelations(rows, "signedError", "Correlates of under-target residual (target - achieved)");
  printHighLow(rows);
  printPeakOffsets(rows);
  bucketRows(rows, "target", [
    { label: "[0,.35)", lo: 0, hi: 0.35 },
    { label: "[.35,.55)", lo: 0.35, hi: 0.55 },
    { label: "[.55,.75)", lo: 0.55, hi: 0.75 },
    { label: "[.75,1]", lo: 0.75, hi: 1.01 },
  ]);
  bucketRows(rows, "achieved", [
    { label: "[0,.15)", lo: 0, hi: 0.15 },
    { label: "[.15,.35)", lo: 0.15, hi: 0.35 },
    { label: "[.35,.55)", lo: 0.35, hi: 0.55 },
    { label: "[.55,.75)", lo: 0.55, hi: 0.75 },
    { label: "[.75,1]", lo: 0.75, hi: 1.01 },
  ]);
  printExamples(rows);
}

function episodeKey(row: Episode): string {
  return `${row.rowName}/${row.variant}/${row.seed}/${row.budget}/${row.gap}`;
}

function printDeltas(baselineLabel: string, baselineRows: Episode[], label: string, rows: Episode[]): void {
  const base = new Map<string, Episode>();
  for (const row of baselineRows) base.set(episodeKey(row), row);
  const pairs: { before: Episode; after: Episode; delta: Episode }[] = [];
  for (const row of rows) {
    const before = base.get(episodeKey(row));
    if (before === undefined) continue;
    pairs.push({ before, after: row, delta: row });
  }
  if (pairs.length === 0) return;
  const deltaRows = pairs.map(({ before, after }) => ({
    ...after,
    target: after.target - before.target,
    achieved: after.achieved - before.achieved,
    signedError: after.signedError - before.signedError,
    absError: after.absError - before.absError,
    incomingSpeed: after.incomingSpeed - before.incomingSpeed,
    turnNetDeg: after.turnNetDeg - before.turnNetDeg,
    tangentDeltaDeg: after.tangentDeltaDeg - before.tangentDeltaDeg,
    tangentChangeDeg: after.tangentChangeDeg - before.tangentChangeDeg,
    contactFrames: after.contactFrames - before.contactFrames,
    initialContactRun: after.initialContactRun - before.initialContactRun,
    velParSlowdownPx: after.velParSlowdownPx - before.velParSlowdownPx,
    pointNormalPx: after.pointNormalPx - before.pointNormalPx,
  }));
  console.log(`\n=== paired deltas: ${label} minus ${baselineLabel} ===`);
  console.log(`  common episodes ${pairs.length}`);
  for (const key of ["achieved", "signedError", "incomingSpeed", "turnNetDeg", "tangentDeltaDeg", "tangentChangeDeg", "contactFrames", "pointNormalPx"] as const) {
    const xs = values(deltaRows, key);
    console.log(`  delta ${key.padEnd(16)} mean ${fmt(mean(xs))}  p10 ${fmt(pct(xs, 0.10))}  p50 ${fmt(pct(xs, 0.50))}  p90 ${fmt(pct(xs, 0.90))}`);
  }
  printCorrelations(deltaRows, "achieved", "Correlates of achieved-impact delta");

  function bucketDeltasByBefore(key: keyof Episode, bands: Band[]): void {
    console.log(`\n  Delta buckets by baseline ${String(key)}`);
    console.log("    band          n     dAch   dTurn    dTan  dTanChg dContact");
    for (const band of bands) {
      const subset = pairs.filter(({ before }) => {
        const v = before[key];
        return typeof v === "number" && finite(v) && v >= band.lo && v < band.hi;
      });
      if (subset.length === 0) continue;
      const d = (field: keyof Episode) => mean(subset.map(({ before, after }) => {
        const a = after[field];
        const b = before[field];
        return typeof a === "number" && typeof b === "number" ? a - b : NaN;
      }).filter(finite));
      console.log(
        `    ${band.label.padEnd(11)} ${String(subset.length).padStart(4)} ` +
        `${fmt(d("achieved")).padStart(8)} ` +
        `${fmt(d("turnNetDeg")).padStart(7)} ` +
        `${fmt(d("tangentDeltaDeg")).padStart(7)} ` +
        `${fmt(d("tangentChangeDeg")).padStart(8)} ` +
        `${fmt(d("contactFrames")).padStart(8)}`,
      );
    }
  }

  bucketDeltasByBefore("target", [
    { label: "[0,.35)", lo: 0, hi: 0.35 },
    { label: "[.35,.55)", lo: 0.35, hi: 0.55 },
    { label: "[.55,.75)", lo: 0.55, hi: 0.75 },
    { label: "[.75,1]", lo: 0.75, hi: 1.01 },
  ]);
  bucketDeltasByBefore("targetAir", [
    { label: "[0,.35)", lo: 0, hi: 0.35 },
    { label: "[.35,.65)", lo: 0.35, hi: 0.65 },
    { label: "[.65,1]", lo: 0.65, hi: 1.01 },
  ]);
  bucketDeltasByBefore("incomingSpeed", [
    { label: "[0,9)", lo: 0, hi: 9 },
    { label: "[9,11)", lo: 9, hi: 11 },
    { label: "[11,99)", lo: 11, hi: 99 },
  ]);
  bucketDeltasByBefore("initialContactRun", [
    { label: "[0,4)", lo: 0, hi: 4 },
    { label: "[4,6)", lo: 4, hi: 6 },
    { label: "[6,8)", lo: 6, hi: 8 },
  ]);

  console.log("\n  Largest achieved-impact gains");
  for (const pair of pairs.sort((a, b) => (b.after.achieved - b.before.achieved) - (a.after.achieved - a.before.achieved)).slice(0, 8)) {
    const d = pair.after.achieved - pair.before.achieved;
    console.log(
      `    ${episodeKey(pair.after)} dAch ${fmt(d)} ` +
      `turn ${fmt(pair.before.turnNetDeg)}->${fmt(pair.after.turnNetDeg)} ` +
      `tan ${fmt(pair.before.tangentDeltaDeg)}->${fmt(pair.after.tangentDeltaDeg)} ` +
      `tanChg ${fmt(pair.before.tangentChangeDeg)}->${fmt(pair.after.tangentChangeDeg)} ` +
      `contact ${fmt(pair.before.contactFrames)}->${fmt(pair.after.contactFrames)}`,
    );
  }

  console.log("\n  Largest achieved-impact losses");
  for (const pair of pairs.sort((a, b) => (a.after.achieved - a.before.achieved) - (b.after.achieved - b.before.achieved)).slice(0, 8)) {
    const d = pair.after.achieved - pair.before.achieved;
    console.log(
      `    ${episodeKey(pair.after)} dAch ${fmt(d)} ` +
      `turn ${fmt(pair.before.turnNetDeg)}->${fmt(pair.after.turnNetDeg)} ` +
      `tan ${fmt(pair.before.tangentDeltaDeg)}->${fmt(pair.after.tangentDeltaDeg)} ` +
      `tanChg ${fmt(pair.before.tangentChangeDeg)}->${fmt(pair.after.tangentChangeDeg)} ` +
      `contact ${fmt(pair.before.contactFrames)}->${fmt(pair.after.contactFrames)}`,
    );
  }
}

const archiveSummaries = archiveArgs.map(loadArchive);
for (const summary of archiveSummaries) {
  summarizeArchive(summary.label, summary.episodes, summary.checkpoints, summary.misses, summary.errors);
}

if (archiveSummaries.length > 1) {
  const baseline = archiveSummaries[0];
  for (const summary of archiveSummaries.slice(1)) {
    printDeltas(baseline.label, baseline.episodes, summary.label, summary.episodes);
  }
}

// Some failed WASM replays can leave engine finalizers that throw during process
// shutdown, after all study output has already been printed. End explicitly so a
// skipped checkpoint does not turn a completed corpus study into a failing run.
process.stdout.write("", () => process.stderr.write("", () => process.exit(0)));
