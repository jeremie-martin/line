/**
 * Step 1 CLI: generate a track that lands at frame T.
 *
 *   npx tsx scripts/landing.ts --frame=100
 *   npx tsx scripts/landing.ts --frame=100 --out=generated/landing-100.track.json
 *
 * Writes a self-contained track JSON. Then run it through the dashboard:
 *   npm run inspect -- --track=generated/landing-100.track.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { placeLanding } from "./lib/primitive.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};

const frameArg = arg("frame");
if (!frameArg) {
  console.error("usage: tsx scripts/landing.ts --frame=<T> [--out=<path>]");
  process.exit(1);
}
const targetFrame = parseInt(frameArg, 10);
if (!Number.isFinite(targetFrame) || targetFrame <= 0) {
  console.error(`--frame must be a positive integer (got: ${frameArg})`);
  process.exit(1);
}

const outPath = resolve(arg("out") ?? `generated/landing-${targetFrame}.track.json`);
mkdirSync(dirname(outPath), { recursive: true });

const result = placeLanding(targetFrame);

writeFileSync(outPath, JSON.stringify(result.track, null, 2));

console.log(`target frame:    ${result.targetFrame}`);
console.log(`actual landing:  ${result.actualFrame}  (Δ=${result.actualFrame - result.targetFrame})`);
console.log(`sled point:      ${result.sledPoint}`);
console.log(`line y:          ${result.lineY.toFixed(4)}`);
console.log(`bisection iters: ${result.iterations}`);
console.log(`track:           ${outPath}`);
console.log();
console.log(`next: npm run inspect -- --track=${outPath}`);
