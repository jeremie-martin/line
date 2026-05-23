/**
 * Step 2 CLI: generate a track that lands at each of multiple target frames.
 *
 *   npx tsx scripts/chain.ts --frames=30,80
 *   npx tsx scripts/chain.ts --frames=30,60,90,120
 *   npx tsx scripts/chain.ts --frames=30,80 --out=generated/chain-2.track.json
 *
 * Writes the track JSON; run it through inspect for video + dashboard.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { placeChain } from "./lib/primitive.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};

const framesArg = arg("frames");
if (!framesArg) {
  console.error("usage: tsx scripts/chain.ts --frames=T1,T2,... [--out=<path>]");
  process.exit(1);
}
const targets = framesArg.split(",").map((s) => parseInt(s.trim(), 10));
if (targets.some((t) => !Number.isFinite(t) || t <= 0)) {
  console.error(`--frames must be comma-separated positive integers (got: ${framesArg})`);
  process.exit(1);
}

const defaultName = `chain-${targets.join("-")}`;
const outPath = resolve(arg("out") ?? `generated/${defaultName}.track.json`);
mkdirSync(dirname(outPath), { recursive: true });

const result = placeChain(targets);
writeFileSync(outPath, JSON.stringify(result.track, null, 2));

console.log(`targets:        [${targets.join(", ")}]`);
console.log(`all landings:   ${result.allLandings ? "YES" : "NO"}`);
console.log();
console.log(`step  target  actual  Δ   type        sled    iters  lineY`);
for (const s of result.steps) {
  const idx = result.steps.indexOf(s) + 1;
  const delta = s.actualFrame >= 0 ? s.actualFrame - s.targetFrame : "—";
  console.log(
    `${String(idx).padStart(4)}  ` +
      `${String(s.targetFrame).padStart(6)}  ` +
      `${String(s.actualFrame).padStart(6)}  ` +
      `${String(delta).padStart(2)}  ` +
      `${s.eventType.padEnd(10)}  ` +
      `${s.sledPoint.padEnd(6)}  ` +
      `${String(s.iterations).padStart(5)}  ` +
      `${s.lineY.toFixed(3)}`,
  );
}
console.log();
console.log(`track:          ${outPath}`);
console.log(`next: npm run inspect -- --track=${outPath}`);
