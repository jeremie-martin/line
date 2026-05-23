/**
 * Ride CLI: load a `.ts` spec, execute it, write the resulting track JSON.
 *
 *   npm run ride -- --spec=specs/six-slides.ts
 *   npm run ride -- --spec=specs/six-slides.ts --out=generated/six.track.json
 *
 * Spec convention: default-export either
 *   - a function returning Move[]  ⇒  CLI calls ride(moves)
 *   - a Move[]                     ⇒  CLI calls ride(moves)
 *   - a RideResult                 ⇒  CLI uses it directly
 *
 * Output: track JSON + verdict report. Pipe the JSON into `npm run inspect`
 * to detect+render+dashboard, just like any other track.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
import { ride, printRideReport, type RideResult } from "./lib/ride.ts";
import type { Move } from "./lib/moves.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};

const specPath = arg("spec");
if (!specPath) {
  console.error("usage: tsx scripts/ride.ts --spec=<path/to/spec.ts> [--out=<path>]");
  process.exit(1);
}
if (!existsSync(specPath)) {
  console.error(`spec file not found: ${specPath}`);
  process.exit(1);
}

const absPath = resolve(specPath);
const mod = await import(absPath);
const defaultExport = mod.default;
if (!defaultExport) {
  console.error(`spec file ${specPath} must default-export Move[], () => Move[], or a RideResult`);
  process.exit(1);
}

let result: RideResult;
if (typeof defaultExport === "function") {
  const out = defaultExport();
  result = Array.isArray(out) ? ride(out as Move[]) : (out as RideResult);
} else if (Array.isArray(defaultExport)) {
  result = ride(defaultExport as Move[]);
} else if (defaultExport.track && defaultExport.steps) {
  result = defaultExport as RideResult;
} else {
  console.error(`unrecognized default export shape in ${specPath}`);
  process.exit(1);
}

const baseName = basename(specPath).replace(/\.ts$/, "");
const outPath = resolve(arg("out") ?? `generated/${baseName}.track.json`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(result.track, null, 2));

printRideReport(result);
console.log(`track: ${outPath}`);
console.log(`next:  npm run inspect -- --track=${outPath}`);

// Exit nonzero if the ride had problems — handy for CI / test contexts.
if (!result.survived) process.exit(2);
if (!result.allPassed) process.exit(3);
