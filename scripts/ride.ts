/**
 * Ride CLI: load a `.ts` spec, execute it, write the resulting track JSON.
 *
 *   # Default: adaptive defaults only, fast and deterministic.
 *   npm run ride -- --spec=specs/six-slides.ts
 *
 *   # Search mode: greedy per-move random search with backtracking.
 *   # Best for "make my spec actually work."
 *   npm run ride -- --spec=specs/grand-tour.ts --search
 *
 *   # Tune greedy's knobs:
 *   npm run ride -- --spec=...  --search --tries-per-move=10 --backtrack=2 --seed=42
 *
 *   # Monte-Carlo (rare — when you want diversity in winners):
 *   npm run ride -- --spec=...  --monte-carlo=100
 *
 * Spec convention: default-export either
 *   - a function returning Move[]  ⇒  CLI calls ride(moves)
 *   - a Move[]                     ⇒  CLI calls ride(moves)
 *   - a RideResult                 ⇒  CLI uses it directly (no search)
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
import { ride, printRideReport, type RideResult } from "./lib/ride.ts";
import { searchRide, searchRideGreedy, beatAdherence } from "./lib/search.ts";
import type { Move } from "./lib/moves.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};
const has = (name: string) => argv.includes(`--${name}`);

const specPath = arg("spec");
if (!specPath) {
  console.error(
    "usage: tsx scripts/ride.ts --spec=<path/to/spec.ts>\n" +
      "  [--search]                  enable greedy per-move search (recommended for hard specs)\n" +
      "  [--tries-per-move=N]        greedy knob (default 10)\n" +
      "  [--backtrack=N]             greedy knob (default 1)\n" +
      "  [--monte-carlo=N]           opt-in: random whole-spec sampling, N trials\n" +
      "  [--seed=N]                  base seed (default 1)\n" +
      "  [--out=<path>]              output track JSON",
  );
  process.exit(1);
}
if (!existsSync(specPath)) {
  console.error(`spec file not found: ${specPath}`);
  process.exit(1);
}

const useSearch = has("search");
const monteCarlo = arg("monte-carlo") !== null ? parseInt(arg("monte-carlo")!, 10) : 0;
const seed = arg("seed") !== null ? parseInt(arg("seed")!, 10) : 1;
const triesPerMove = arg("tries-per-move") !== null ? parseInt(arg("tries-per-move")!, 10) : 10;
const backtrackDepth = arg("backtrack") !== null ? parseInt(arg("backtrack")!, 10) : 1;

if (useSearch && monteCarlo > 0) {
  console.error("Pick one: --search OR --monte-carlo=N, not both.");
  process.exit(1);
}

const absPath = resolve(specPath);
const mod = await import(absPath);
const defaultExport = mod.default;
if (!defaultExport) {
  console.error(`spec file ${specPath} must default-export Move[], () => Move[], or a RideResult`);
  process.exit(1);
}

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
let provenance: string;

if (usedRideResultDirectly) {
  if (useSearch || monteCarlo > 0) {
    console.error("--search / --monte-carlo cannot be used with a spec that returns a pre-baked RideResult");
    process.exit(1);
  }
  result = directResult!;
  provenance = "pre-baked RideResult";
} else if (useSearch) {
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
  const onBeatCount = greedy.perMoveOnBeat.filter(Boolean).length;
  const totalMoves = greedy.perMoveOnBeat.length;
  console.log(
    `Greedy: ${elapsed}ms, ${greedy.totalSimulations} sims, ${greedy.backtracks} backtracks, reachedEnd=${greedy.reachedEnd}`,
  );
  console.log(
    `On-beat hits: ${onBeatCount} / ${totalMoves} = ${(100 * onBeatCount / totalMoves).toFixed(1)}%` +
      ` (events firing within ±2 frames of atFrame)`,
  );
  const adh = beatAdherence(greedy.result, 2);
  console.log(
    `Final-detection adherence: ${adh.hits} / ${adh.totalBeats} = ${(adh.hitFraction * 100).toFixed(1)}%` +
      ` · mean offset ${adh.meanHitOffset.toFixed(2)}f`,
  );
  result = greedy.result;
  provenance = `greedy(seed=${seed}, ${onBeatCount}/${totalMoves} on-beat)`;
} else if (monteCarlo > 0) {
  console.log(`Monte Carlo: ${monteCarlo} trials (seed base=${seed})`);
  const t0 = Date.now();
  const search = searchRide(moves, {}, {
    trials: monteCarlo,
    seed,
    topK: 5,
    onTrial: (info) => {
      const marker = info.survived ? (info.allPassed ? "★" : "✓") : "✗";
      process.stdout.write(
        `\r[${String(info.index + 1).padStart(String(monteCarlo).length)}/${monteCarlo}] ` +
          `${marker} score=${info.score.toFixed(1).padStart(7)} ` +
          `contact=${(info.contactFraction * 100).toFixed(1)}%`,
      );
    },
  });
  process.stdout.write("\n\n");
  const elapsed = Date.now() - t0;
  console.log(`Monte Carlo: ${elapsed}ms, ${search.survivedCount}/${monteCarlo} survived`);
  console.log("top 5:");
  for (const t of search.topK) {
    const s = t.result.detection.summary;
    console.log(
      `  seed=${String(t.seed).padStart(6)}  score=${t.score.toFixed(1).padStart(8)}  ` +
        `${t.result.survived ? "live" : "DEAD"}  ` +
        `${(s.contactFractionSpec * 100).toFixed(1).padStart(5)}% sliding`,
    );
  }
  result = search.best.result;
  provenance = `monte-carlo(winning seed=${search.best.seed})`;
} else {
  // Default: just adaptive defaults, no search. Fast and deterministic.
  result = ride(moves);
  provenance = "deterministic (adaptive defaults only)";
}

const baseName = basename(specPath).replace(/\.ts$/, "");
const outPath = resolve(arg("out") ?? `generated/${baseName}.track.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(result.track, null, 2));

printRideReport(result);
console.log(`track:       ${outPath}`);
console.log(`provenance:  ${provenance}`);
console.log(`next:        npm run inspect -- --track=${outPath}`);

if (!result.survived) process.exit(2);
if (!result.allPassed) process.exit(3);
