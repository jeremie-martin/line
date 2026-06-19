/**
 * `characterize` — sweep a song's spec across a seed range and MEASURE the
 * distribution of every production metric (score, stand-time%, rotations, flips,
 * validity). Writes characterization.json, and a SUGGESTED select.json whose
 * floors are read straight off that distribution — so they can never be set so
 * high the song yields zero videos. You then edit select.json to taste.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/produce/characterize.ts \
 *     --song=productions/luna_bala_44s [--seeds=0-127] [--budget=N] [--jobs=N]
 *
 * Pure measurement: nothing here renders. It reuses the same compile+measure
 * path (seed.ts) the live `produce` gate uses, so the numbers can't disagree.
 */
import { writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { availableParallelism, hostname } from "node:os";
import { execSync } from "node:child_process";
import { runPool, spawnSeedWorker } from "./pool.ts";
import { resolveJoltMs } from "./seed.ts";
import { loadSelect, buildCharacterization, suggestedSelect } from "./config.ts";
import type { SeedMetrics } from "./measure.ts";
import type { MetricStats } from "./config.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};

function parseSeeds(s: string): number[] {
  const fail = (): never => {
    throw new Error(`--seeds must be a comma list or a low-high range of safe integers, got: ${s}`);
  };
  let out: number[];
  if (s.includes(",")) {
    out = s.split(",").map((p) => Number(p.trim()));
  } else if (s.includes("-")) {
    const [a, b] = s.split("-").map((p) => Number(p.trim()));
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) fail();
    out = [];
    for (let i = a; i <= b; i++) out.push(i);
  } else {
    out = [Number(s.trim())];
  }
  if (out.length === 0 || out.some((n) => !Number.isSafeInteger(n))) fail();
  return [...new Set(out)].sort((x, y) => x - y);
}

function gitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || "unknown";
  } catch {
    return "unknown";
  }
}

const songArg = arg("song");
if (!songArg) {
  console.error("usage: characterize.ts --song=productions/<song> [--seeds=0-127] [--budget=N] [--jobs=N]");
  process.exit(1);
}
const songDir = resolve(songArg);
const cfg = loadSelect(songDir); // spec + default budget; select.json need not exist yet
const seedsStr = arg("seeds") ?? "0-127";
const seeds = parseSeeds(seedsStr);
const budget = arg("budget") !== null ? Number(arg("budget")) : cfg.budget;
const jobs = Math.max(1, Math.min(arg("jobs") !== null ? Number(arg("jobs")) : Math.floor(availableParallelism() / 2), seeds.length));
const jolt = resolveJoltMs();

const fmt = (s: MetricStats) =>
  `mean ${s.mean.toFixed(1)}  sd ${s.sd.toFixed(1)}  med ${s.median.toFixed(1)}  p25 ${s.p25.toFixed(1)}  p75 ${s.p75.toFixed(1)}  [${s.min.toFixed(1)}..${s.max.toFixed(1)}]`;

async function main(): Promise<void> {
  console.log(`characterize ${cfg.spec}\n  @ budget ${budget}  over ${seeds.length} seeds (${seedsStr})  jolt ${jolt}ms  jobs ${jobs}\n`);

  const metrics: SeedMetrics[] = [];
  const failures: { seed: number; message: string }[] = [];
  const wall0 = Date.now();
  let done = 0;
  await runPool(seeds, jobs, async (seed) => {
    const msg = await spawnSeedWorker({ specPath: cfg.spec, seed, budget, jolt, trackOutPath: null, reportOutPath: null });
    done++;
    if (msg.ok) {
      metrics.push(msg.metrics);
      const m = msg.metrics;
      console.log(`[${String(done).padStart(3)}/${seeds.length}] seed ${String(seed).padStart(3)}  ` +
        `score ${m.score.toFixed(0).padStart(4)}  stand ${m.standTimePct.toFixed(1).padStart(4)}%  ` +
        `rot ${m.rotations.toFixed(1).padStart(5)}  ${m.reachedEnd ? "end" : "DIED"}${m.offBeat ? ` ob${m.offBeat}` : ""}`);
    } else {
      failures.push({ seed, message: msg.message });
      console.log(`[${String(done).padStart(3)}/${seeds.length}] seed ${String(seed).padStart(3)}  FAILED: ${msg.message}`);
    }
  });

  const report = buildCharacterization(metrics, { spec: cfg.spec, budget, gitSha: gitSha(), host: hostname(), seeds: seedsStr });
  const charPath = join(songDir, "characterization.json");
  writeFileSync(charPath, JSON.stringify(report, null, 2));

  console.log(`\n=== distribution over ${metrics.length} ok / ${failures.length} failed  (wall ${((Date.now() - wall0) / 1000).toFixed(0)}s) ===`);
  console.log(`  basis: ${report.basis}   validity ${(report.validityRate * 100).toFixed(0)}% (${Math.round(report.validityRate * report.n)}/${report.n})`);
  console.log(`  score         ${fmt(report.metrics.score)}`);
  console.log(`  standTimePct  ${fmt(report.metrics.standTimePct)}`);
  console.log(`  rotations     ${fmt(report.metrics.rotations)}`);
  console.log(`  flipCount     ${fmt(report.metrics.flipCount)}`);

  // Suggested select.json — never clobber an edited one.
  const suggestion = suggestedSelect(report);
  const selectPath = join(songDir, "select.json");
  const exists = existsSync(selectPath);
  const writePath = exists ? join(songDir, "select.suggested.json") : selectPath;
  writeFileSync(writePath, JSON.stringify(suggestion, null, 2));

  console.log(`\nsuggested floors:  score ≥ ${suggestion.floors.score}  ·  standTimePct ≥ ${suggestion.floors.standTimePctMin}%  ·  rotations ≥ ${suggestion.floors.rotationsMin}  ·  reachedEnd, offBeat=0`);
  console.log(`→ ${charPath}`);
  if (exists) console.log(`→ ${writePath}  (existing select.json preserved — diff to adopt)`);
  else console.log(`→ ${writePath}  (edit to taste before producing)`);
}

await main();
