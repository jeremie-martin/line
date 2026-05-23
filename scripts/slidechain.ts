/**
 * Slide-chain CLI: multiple curves at target frames, with cumulative simulation.
 *
 *   npx tsx scripts/slidechain.ts --frames=30,120,210
 *   npx tsx scripts/slidechain.ts --frames=30,120,210 --start-angle=20 --end-angle=3
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { placeSlideChain } from "./lib/primitive.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};

const framesArg = arg("frames");
if (!framesArg) {
  console.error("usage: tsx scripts/slidechain.ts --frames=T1,T2,... [opts]");
  process.exit(1);
}
const targets = framesArg.split(",").map((s) => parseInt(s.trim(), 10));
if (targets.some((t) => !Number.isFinite(t) || t <= 0)) {
  console.error(`--frames must be comma-separated positive integers (got: ${framesArg})`);
  process.exit(1);
}

const opts = {
  startAngleDeg: arg("start-angle") !== null ? parseFloat(arg("start-angle")!) : undefined,
  endAngleDeg: arg("end-angle") !== null ? parseFloat(arg("end-angle")!) : undefined,
  segments: arg("segments") !== null ? parseInt(arg("segments")!, 10) : undefined,
  segmentLength: arg("segment-length") !== null ? parseFloat(arg("segment-length")!) : undefined,
  offset: arg("offset") !== null ? parseFloat(arg("offset")!) : undefined,
};

const defaultName = `slidechain-${targets.join("-")}`;
const outPath = resolve(arg("out") ?? `generated/${defaultName}.track.json`);
mkdirSync(dirname(outPath), { recursive: true });

const result = placeSlideChain(targets, opts);
writeFileSync(outPath, JSON.stringify(result.track, null, 2));

console.log(`targets:        [${targets.join(", ")}]`);
console.log(`survived:       ${result.survived ? "yes" : "no"} (terminus: ${result.terminus.reason} @ ${result.terminus.frame})`);
console.log(`contact %:      ${(result.contactFractionSpec * 100).toFixed(1)}%`);
console.log(`longest slide:  ${result.longestSlide} frames (${(result.longestSlide / 40).toFixed(2)}s)`);
console.log();
console.log(`step  T_i  sled    incoming°  |v|     slide @ f=...    duration`);
for (const s of result.steps) {
  const idx = result.steps.indexOf(s) + 1;
  console.log(
    `${String(idx).padStart(4)}  ` +
      `${String(s.targetFrame).padStart(3)}  ` +
      `${s.sledPoint.padEnd(7)} ` +
      `${s.incomingAngleDeg.toFixed(1).padStart(7)}°  ` +
      `${s.incomingSpeed.toFixed(2).padStart(5)}   ` +
      `f=${String(s.slideStart).padStart(3)}..${String(s.slideEnd).padStart(3)}    ` +
      `${s.slideDurationFrames}f (${(s.slideDurationFrames / 40).toFixed(2)}s)`,
  );
}
console.log();
console.log(`track:          ${outPath}`);
console.log(`next: npm run inspect -- --track=${outPath}`);
