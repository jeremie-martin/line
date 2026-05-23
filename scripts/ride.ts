/**
 * Ride CLI: load a `.ts` spec, execute it, write the resulting track JSON.
 *
 *   npm run ride -- --spec=specs/six-slides.ts
 *   npm run ride -- --spec=specs/six-slides.ts --out=generated/six.track.json
 *
 *   # Monte-Carlo search: try N random adapter-jitter trials, pick best.
 *   # `at:` and user-passed params stay fixed; only adapter-chosen defaults
 *   # vary trial-to-trial. Best track's seed is printed for reproducibility.
 *   npm run ride -- --spec=specs/grand-tour.ts --trials=100
 *   npm run ride -- --spec=specs/grand-tour.ts --trials=100 --seed=42
 *
 * Spec convention: default-export either
 *   - a function returning Move[]  ⇒  CLI calls ride(moves)
 *   - a Move[]                     ⇒  CLI calls ride(moves)
 *   - a RideResult                 ⇒  CLI uses it directly (no search)
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
import { ride, printRideReport, type RideResult } from "./lib/ride.ts";
import { searchRide, searchRideGreedy, defaultFitness } from "./lib/search.ts";
import { makeRng } from "./lib/rng.ts";
import type { Move } from "./lib/moves.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};

const specPath = arg("spec");
if (!specPath) {
  console.error("usage: tsx scripts/ride.ts --spec=<path/to/spec.ts> [--trials=N] [--seed=N] [--out=<path>]");
  process.exit(1);
}
if (!existsSync(specPath)) {
  console.error(`spec file not found: ${specPath}`);
  process.exit(1);
}

const trials = arg("trials") !== null ? parseInt(arg("trials")!, 10) : 1;
const seed = arg("seed") !== null ? parseInt(arg("seed")!, 10) : 1;
const strategy = arg("strategy") ?? "monte"; // "monte" | "greedy"
const triesPerMove = arg("tries-per-move") !== null ? parseInt(arg("tries-per-move")!, 10) : 10;
const backtrackDepth = arg("backtrack") !== null ? parseInt(arg("backtrack")!, 10) : 1;

const absPath = resolve(specPath);
const mod = await import(absPath);
const defaultExport = mod.default;
if (!defaultExport) {
  console.error(`spec file ${specPath} must default-export Move[], () => Move[], or a RideResult`);
  process.exit(1);
}

// Resolve the spec to a Move[].
let moves: Move[];
let usedRideResultDirectly = false;
let directResult: RideResult | null = null;

if (typeof defaultExport === "function") {
  const out = defaultExport();
  if (Array.isArray(out)) {
    moves = out as Move[];
  } else {
    usedRideResultDirectly = true;
    directResult = out as RideResult;
    moves = [];
  }
} else if (Array.isArray(defaultExport)) {
  moves = defaultExport as Move[];
} else if (defaultExport.track && defaultExport.steps) {
  usedRideResultDirectly = true;
  directResult = defaultExport as RideResult;
  moves = [];
} else {
  console.error(`unrecognized default export shape in ${specPath}`);
  process.exit(1);
}

let result: RideResult;
let chosenSeed: number | null = null;

if (usedRideResultDirectly) {
  if (trials > 1) {
    console.error("--trials cannot be used with a spec that returns a pre-baked RideResult");
    process.exit(1);
  }
  result = directResult!;
} else if (strategy === "greedy") {
  console.log(`Greedy search: triesPerMove=${triesPerMove} backtrackDepth=${backtrackDepth} seed=${seed}`);
  const t0 = Date.now();
  const greedy = searchRideGreedy(moves, {}, {
    triesPerMove,
    backtrackDepth,
    seed,
    onMove: (info) => {
      const marker = info.outcome === "advanced" ? "✓" : info.outcome === "backtracked" ? "↩" : "✗";
      process.stdout.write(
        `\r[${String(info.moveIndex + 1).padStart(3)}/${moves.length}] ${marker} ${info.moveType.padEnd(12)} tries=${info.triesUsed}`,
      );
    },
  });
  const elapsed = Date.now() - t0;
  process.stdout.write("\n\n");
  console.log(
    `Greedy: ${elapsed}ms, ${greedy.totalSimulations} sims, ${greedy.backtracks} backtracks, reachedEnd=${greedy.reachedEnd}`,
  );
  console.log(`perMoveSeeds: [${greedy.perMoveSeeds.join(", ")}]`);
  result = greedy.result;
  chosenSeed = seed;
} else if (trials > 1) {
  console.log(`Running ${trials} trials (seed base = ${seed})...`);
  const search = searchRide(moves, {}, {
    trials,
    seed,
    topK: 5,
    onTrial: (info) => {
      // Live progress: one terse line per trial.
      const marker = info.survived ? (info.allPassed ? "★" : "✓") : "✗";
      process.stdout.write(
        `\r[${String(info.index + 1).padStart(String(trials).length)}/${trials}] ` +
          `${marker} score=${info.score.toFixed(1).padStart(7)} ` +
          `contact=${(info.contactFraction * 100).toFixed(1)}%`
      );
    },
  });
  process.stdout.write("\n\n");
  console.log(`survived: ${search.survivedCount}/${trials} trials\n`);
  console.log("top 5:");
  for (const t of search.topK) {
    const s = t.result.detection.summary;
    console.log(
      `  seed=${String(t.seed).padStart(6)}  score=${t.score.toFixed(1).padStart(8)}  ` +
        `${t.result.survived ? "live" : "DEAD"}  ` +
        `${(s.contactFractionSpec * 100).toFixed(1).padStart(5)}% sliding  ` +
        `longest=${s.longestContactRun}f`,
    );
  }
  console.log();
  result = search.best.result;
  chosenSeed = search.best.seed;
  console.log(`Best trial: seed=${chosenSeed}, fitness=${search.best.score.toFixed(1)}`);
} else {
  result = ride(moves);
}

const baseName = basename(specPath).replace(/\.ts$/, "");
const outPath = resolve(arg("out") ?? `generated/${baseName}.track.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(result.track, null, 2));

printRideReport(result);
console.log(`track: ${outPath}`);
if (chosenSeed !== null) {
  console.log(`reproduce: ride(moves, { rng: makeRng(${chosenSeed}) })`);
}
console.log(`next:  npm run inspect -- --track=${outPath}`);

if (!result.survived) process.exit(2);
if (!result.allPassed) process.exit(3);

void makeRng; // re-exported for spec authors; touch so it's not unused
