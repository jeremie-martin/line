/**
 * Slide-primitive CLI.
 *
 *   npx tsx scripts/slide.ts --frame=30
 *   npx tsx scripts/slide.ts --frame=30 --angle=15 --length=200 --offset=2
 *   npx tsx scripts/slide.ts --frame=30 --out=generated/my-slide.track.json
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { placeSlide } from "./lib/primitive.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};

const frameArg = arg("frame");
if (!frameArg) {
  console.error("usage: tsx scripts/slide.ts --frame=<T> [--angle=15] [--length=200] [--offset=2] [--out=<path>]");
  process.exit(1);
}
const startFrame = parseInt(frameArg, 10);
if (!Number.isFinite(startFrame) || startFrame <= 0) {
  console.error(`--frame must be a positive integer (got: ${frameArg})`);
  process.exit(1);
}
const angleDeg = arg("angle") !== null ? parseFloat(arg("angle")!) : undefined;
const length = arg("length") !== null ? parseFloat(arg("length")!) : undefined;
const offset = arg("offset") !== null ? parseFloat(arg("offset")!) : undefined;

const defaultName = `slide-f${startFrame}-a${angleDeg ?? 15}`;
const outPath = resolve(arg("out") ?? `generated/${defaultName}.track.json`);
mkdirSync(dirname(outPath), { recursive: true });

const result = placeSlide({ startFrame, angleDeg, length, offset });
writeFileSync(outPath, JSON.stringify(result.track, null, 2));

console.log(`startFrame:        ${result.startFrame}`);
console.log(`slide segment:     f=${result.slideStart}..${result.slideEnd}  (${result.slideDurationFrames} frames = ${(result.slideDurationFrames / 40).toFixed(2)}s)`);
console.log(`max vx in slide:   ${result.maxVxDuringSlide.toFixed(2)}`);
console.log(`survived:          ${result.survived ? "yes" : "no"} (terminus: ${result.terminus.reason} @ ${result.terminus.frame})`);
console.log(`line:              (${result.line.x1.toFixed(1)}, ${result.line.y1.toFixed(1)}) → (${result.line.x2.toFixed(1)}, ${result.line.y2.toFixed(1)})`);
console.log(`track:             ${outPath}`);
console.log();
console.log(`next: npm run inspect -- --track=${outPath}`);
