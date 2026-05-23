/**
 * Curve-primitive CLI.
 *
 *   npx tsx scripts/curve.ts --frame=30
 *   npx tsx scripts/curve.ts --frame=30 --start-angle=20 --end-angle=3 --segments=8 --segment-length=30
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { placeCurve } from "./lib/primitive.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};

const frameArg = arg("frame");
if (!frameArg) {
  console.error("usage: tsx scripts/curve.ts --frame=<T> [--start-angle=20] [--end-angle=3] [--segments=8] [--segment-length=30] [--offset=2] [--out=<path>]");
  process.exit(1);
}
const startFrame = parseInt(frameArg, 10);
if (!Number.isFinite(startFrame) || startFrame <= 0) {
  console.error(`--frame must be a positive integer (got: ${frameArg})`);
  process.exit(1);
}
const startAngleDeg = arg("start-angle") !== null ? parseFloat(arg("start-angle")!) : undefined;
const endAngleDeg = arg("end-angle") !== null ? parseFloat(arg("end-angle")!) : undefined;
const segments = arg("segments") !== null ? parseInt(arg("segments")!, 10) : undefined;
const segmentLength = arg("segment-length") !== null ? parseFloat(arg("segment-length")!) : undefined;
const offset = arg("offset") !== null ? parseFloat(arg("offset")!) : undefined;

const defaultName = `curve-f${startFrame}-a${startAngleDeg ?? 20}to${endAngleDeg ?? 3}`;
const outPath = resolve(arg("out") ?? `generated/${defaultName}.track.json`);
mkdirSync(dirname(outPath), { recursive: true });

const result = placeCurve({ startFrame, startAngleDeg, endAngleDeg, segments, segmentLength, offset });
writeFileSync(outPath, JSON.stringify(result.track, null, 2));

console.log(`startFrame:        ${result.startFrame}`);
console.log(`slide segment:     f=${result.slideStart}..${result.slideEnd}  (${result.slideDurationFrames} frames = ${(result.slideDurationFrames / 40).toFixed(2)}s)`);
console.log(`max vx in slide:   ${result.maxVxDuringSlide.toFixed(2)}`);
console.log(`survived:          ${result.survived ? "yes" : "no"} (terminus: ${result.terminus.reason} @ ${result.terminus.frame})`);
console.log(`lines:             ${result.lines.length} segments`);
console.log(`track:             ${outPath}`);
console.log();
console.log(`next: npm run inspect -- --track=${outPath}`);
