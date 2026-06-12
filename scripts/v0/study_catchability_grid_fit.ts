/**
 * Reference-only catchability surface refit.
 *
 * Reproduces the 2026-06-12 fine-grid experiment without leaving the fine
 * surface in production:
 *
 *   LR_ENGINE=wasm node --expose-gc --no-warnings=ExperimentalWarning --import tsx \
 *     scripts/v0/study_catchability.ts \
 *     --specs=drums_signature,drums_crescendo,dense_echo_climb,rolling_drop,climb_terrace,terrace_sprint,solo_run,verse_chorus,drums_dropout,rhythm_ladder,skyline_push,syncopated_switchback \
 *     --seeds=0,1 --budget=300000 --k=8 --max-gaps=20 \
 *     --out=generated/analysis/catchability_current_300k_expanded.jsonl
 *
 *   node --no-warnings=ExperimentalWarning --import tsx \
 *     scripts/v0/study_catchability_grid_fit.ts \
 *     --rows=generated/analysis/catchability_300k.jsonl,generated/analysis/catchability_current_300k_expanded.jsonl
 *
 * To A/B the emitted fine table, temporarily replace the constants in
 * optimizer/readiness.ts, then run:
 *
 *   LR_ENGINE=wasm npm run golden -- --jobs=32 \
 *     --archive-dir=generated/golden-runs/catchability-fine-current-01
 *   npx tsx scripts/v0/analyze_golden_curve.ts decide \
 *     generated/golden-runs/catchability-fine-current-01/golden.json \
 *     generated/golden-runs/shared-objective-forwardfix-k2-canonical-01/golden.json
 *
 * The 2026-06-12 canonical result rejected the fine table:
 * headline 607.8 -> 604.6, delta -3.2, 95% CI [-9.0, 1.1].
 */
import { existsSync, readFileSync } from "node:fs";

type CatchabilityRow = {
  spec?: string;
  seed?: number;
  gapIndex?: number;
  family?: string;
  delta?: number;
  speed: number;
  comAngleDeg: number;
  refitViable: number;
  refitAttempts: number;
};

type Surface = {
  angleKnots: readonly number[];
  speedKnots: readonly number[];
  grid: readonly (readonly number[])[];
};

type Metrics = {
  n: number;
  corr: number;
  rmse: number;
  logloss: number;
};

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const DEFAULT_ROWS = [
  "generated/analysis/catchability_300k.jsonl",
  "generated/analysis/catchability_current_300k_expanded.jsonl",
] as const;

const COARSE_ANGLE_KNOTS = [-15, -5, 0, 5, 10, 15, 20, 25, 30, 40] as const;
const COARSE_SPEED_KNOTS = [6, 7, 8, 9, 10, 11, 12] as const;
const STUDY_COARSE_GRID: readonly (readonly number[])[] = [
  [0.781, 0.744, 0.669, 0.636, 0.695, 0.772, 0.792],
  [0.589, 0.378, 0.394, 0.465, 0.551, 0.659, 0.775],
  [0.544, 0.361, 0.442, 0.538, 0.628, 0.721, 0.798],
  [0.58, 0.426, 0.538, 0.639, 0.719, 0.803, 0.858],
  [0.665, 0.527, 0.642, 0.74, 0.803, 0.87, 0.914],
  [0.743, 0.619, 0.706, 0.808, 0.861, 0.909, 0.942],
  [0.778, 0.676, 0.724, 0.84, 0.894, 0.926, 0.946],
  [0.79, 0.726, 0.733, 0.844, 0.895, 0.916, 0.928],
  [0.793, 0.778, 0.766, 0.831, 0.868, 0.879, 0.879],
  [0.794, 0.794, 0.792, 0.783, 0.777, 0.768, 0.75],
];

const rowPaths = (argValue("rows")?.split(",") ?? DEFAULT_ROWS).filter((p) => p.length > 0);
const folds = parseIntegerArg("folds", 5);
const sigmaSpeed = parseNumberArg("sigma-speed", 0.75);
const sigmaAngle = parseNumberArg("sigma-angle", 4);
const pseudoWeight = parseNumberArg("pseudo-weight", 8);
const fineAngleMin = parseNumberArg("fine-angle-min", -16);
const fineAngleMax = parseNumberArg("fine-angle-max", 40);
const fineAngleStep = parseNumberArg("fine-angle-step", 2);
const fineSpeedMin = parseNumberArg("fine-speed-min", 5);
const fineSpeedMax = parseNumberArg("fine-speed-max", 13);
const fineSpeedStep = parseNumberArg("fine-speed-step", 1);

function parseNumberArg(name: string, fallback: number): number {
  const raw = argValue(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    console.error(`invalid --${name}=${raw}`);
    process.exit(1);
  }
  return value;
}

function parseIntegerArg(name: string, fallback: number): number {
  const value = parseNumberArg(name, fallback);
  if (!Number.isSafeInteger(value) || value < 2) {
    console.error(`invalid --${name}=${value}; expected integer >= 2`);
    process.exit(1);
  }
  return value;
}

function rangeInclusive(lo: number, hi: number, step: number): number[] {
  if (step <= 0) throw new Error(`invalid step ${step}`);
  const out: number[] = [];
  for (let x = lo; x <= hi + step * 1e-9; x += step) {
    out.push(Number(x.toFixed(10)));
  }
  return out;
}

function loadRows(paths: readonly string[]): CatchabilityRow[] {
  const rows: CatchabilityRow[] = [];
  for (const path of paths) {
    if (!existsSync(path)) {
      console.error(`missing ${path}`);
      process.exit(1);
    }
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      const parsed = JSON.parse(line) as Partial<CatchabilityRow>;
      if (
        !Number.isFinite(parsed.speed) ||
        !Number.isFinite(parsed.comAngleDeg) ||
        !Number.isFinite(parsed.refitViable) ||
        !Number.isFinite(parsed.refitAttempts) ||
        (parsed.refitAttempts as number) <= 0
      ) {
        throw new Error(`${path}:${i + 1}: invalid catchability row`);
      }
      rows.push(parsed as CatchabilityRow);
    }
  }
  return rows;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const rowRate = (row: CatchabilityRow): number => row.refitViable / row.refitAttempts;
const f3 = (x: number): string => x.toFixed(3);
const f4 = (x: number): string => x.toFixed(4);

function meanRate(rows: readonly CatchabilityRow[]): number {
  let sum = 0;
  for (const row of rows) sum += rowRate(row);
  return sum / rows.length;
}

function fitSurface(
  rows: readonly CatchabilityRow[],
  angleKnots: readonly number[],
  speedKnots: readonly number[],
  shrinkTarget: number,
): Surface {
  const grid = angleKnots.map((angle) =>
    speedKnots.map((speed) => {
      let weighted = 0;
      let weight = 0;
      for (const row of rows) {
        const ds = (row.speed - speed) / sigmaSpeed;
        const da = (row.comAngleDeg - angle) / sigmaAngle;
        const w = Math.exp(-0.5 * (ds * ds + da * da));
        weighted += w * rowRate(row);
        weight += w;
      }
      return clamp01((weighted + pseudoWeight * shrinkTarget) / (weight + pseudoWeight));
    })
  );
  return { angleKnots, speedKnots, grid };
}

function locate(knots: readonly number[], x: number): [number, number] {
  if (x <= knots[0]) return [0, 0];
  const last = knots.length - 1;
  if (x >= knots[last]) return [last - 1, 1];
  for (let i = 0; i < last; i++) {
    if (x >= knots[i] && x <= knots[i + 1]) {
      const span = knots[i + 1] - knots[i];
      return [i, span > 0 ? (x - knots[i]) / span : 0];
    }
  }
  return [last - 1, 1];
}

function predict(surface: Surface, row: CatchabilityRow): number {
  const [ai, at] = locate(surface.angleKnots, row.comAngleDeg);
  const [si, st] = locate(surface.speedKnots, row.speed);
  const top = surface.grid[ai][si] * (1 - st) + surface.grid[ai][si + 1] * st;
  const bot = surface.grid[ai + 1][si] * (1 - st) + surface.grid[ai + 1][si + 1] * st;
  return clamp01(top * (1 - at) + bot * at);
}

function hash32(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function foldOf(row: CatchabilityRow, index: number): number {
  const key = `${row.spec ?? ""}:${row.seed ?? ""}:${row.gapIndex ?? ""}:${row.family ?? ""}:` +
    `${row.delta ?? ""}:${index}`;
  return hash32(key) % folds;
}

function score(rows: readonly CatchabilityRow[], predictions: readonly number[]): Metrics {
  if (rows.length !== predictions.length) {
    throw new Error(`row/prediction length mismatch: ${rows.length} vs ${predictions.length}`);
  }
  const n = rows.length;
  let sumY = 0;
  let sumP = 0;
  for (let i = 0; i < n; i++) {
    sumY += rowRate(rows[i]);
    sumP += predictions[i];
  }
  const meanY = sumY / n;
  const meanP = sumP / n;
  let cov = 0;
  let varY = 0;
  let varP = 0;
  let mse = 0;
  let loss = 0;
  let attempts = 0;
  for (let i = 0; i < n; i++) {
    const y = rowRate(rows[i]);
    const p = Math.min(1 - 1e-6, Math.max(1e-6, predictions[i]));
    cov += (y - meanY) * (p - meanP);
    varY += (y - meanY) ** 2;
    varP += (p - meanP) ** 2;
    mse += (y - p) ** 2;
    loss += -(rows[i].refitViable * Math.log(p) + (rows[i].refitAttempts - rows[i].refitViable) * Math.log(1 - p));
    attempts += rows[i].refitAttempts;
  }
  return {
    n,
    corr: varY > 0 && varP > 0 ? cov / Math.sqrt(varY * varP) : NaN,
    rmse: Math.sqrt(mse / n),
    logloss: loss / attempts,
  };
}

function evaluate(surface: Surface, rows: readonly CatchabilityRow[]): Metrics {
  return score(rows, rows.map((row) => predict(surface, row)));
}

function crossValidate(
  rows: readonly CatchabilityRow[],
  angleKnots: readonly number[],
  speedKnots: readonly number[],
  shrinkTarget: number,
): Metrics {
  const allRows: CatchabilityRow[] = [];
  const allPredictions: number[] = [];
  for (let fold = 0; fold < folds; fold++) {
    const train: CatchabilityRow[] = [];
    const valid: CatchabilityRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      (foldOf(rows[i], i) === fold ? valid : train).push(rows[i]);
    }
    const surface = fitSurface(train, angleKnots, speedKnots, shrinkTarget);
    for (const row of valid) {
      allRows.push(row);
      allPredictions.push(predict(surface, row));
    }
  }
  return score(allRows, allPredictions);
}

function metricLine(label: string, metrics: Metrics): string {
  return `${label.padEnd(26)} n=${String(metrics.n).padStart(5)} ` +
    `corr=${f3(metrics.corr)} rmse=${f4(metrics.rmse)} logloss=${f4(metrics.logloss)}`;
}

function formatConst(name: string, values: readonly number[]): string {
  return `const ${name} = [${values.join(", ")}] as const;`;
}

function formatGrid(grid: readonly (readonly number[])[]): string {
  return `const RATE_GRID: readonly (readonly number[])[] = [\n` +
    grid.map((row) => `  [${row.map((x) => Number(x.toFixed(3))).join(", ")}],`).join("\n") +
    `\n];`;
}

const rows = loadRows(rowPaths);
const shrinkTarget = parseNumberArg("shrink-target", meanRate(rows));
const fineAngleKnots = rangeInclusive(fineAngleMin, fineAngleMax, fineAngleStep);
const fineSpeedKnots = rangeInclusive(fineSpeedMin, fineSpeedMax, fineSpeedStep);

console.log("=== catchability grid fit study ===");
console.log(`rows=${rows.length} files=${rowPaths.join(",")}`);
console.log(
  `sigma_speed=${sigmaSpeed} sigma_angle=${sigmaAngle} pseudo_weight=${pseudoWeight} ` +
    `shrink_target=${f4(shrinkTarget)} folds=${folds}`,
);
console.log("");
console.log(metricLine("production coarse table", evaluate({
  angleKnots: COARSE_ANGLE_KNOTS,
  speedKnots: COARSE_SPEED_KNOTS,
  grid: STUDY_COARSE_GRID,
}, rows)));
console.log(metricLine("cv coarse refit", crossValidate(rows, COARSE_ANGLE_KNOTS, COARSE_SPEED_KNOTS, shrinkTarget)));
console.log(metricLine("cv fine refit", crossValidate(rows, fineAngleKnots, fineSpeedKnots, shrinkTarget)));

const fineSurface = fitSurface(rows, fineAngleKnots, fineSpeedKnots, shrinkTarget);
console.log("\n=== emitted fine table ===");
console.log(formatConst("ANGLE_KNOTS", fineSurface.angleKnots));
console.log(formatConst("SPEED_KNOTS", fineSurface.speedKnots));
console.log(formatGrid(fineSurface.grid));
