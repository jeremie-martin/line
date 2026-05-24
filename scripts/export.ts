/**
 * Thin CLI wrapper over `lib/export.ts:exportVideo`.
 *
 *   npx tsx scripts/export.ts --track=test.track.json --zoom=3 --1080p --hq
 *   npx tsx scripts/export.ts --track=test.track.json --out=shakedown/out.mp4
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { exportVideo, MirrorUnreachableError } from "./lib/export.ts";

const argv = process.argv.slice(2);
const arg = (name: string): string | null => {
  const m = argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : null;
};
const has = (name: string) => argv.includes(`--${name}`);

const origin = arg("origin") ?? "http://127.0.0.1:8765";
const trackPath = arg("track");
// Default zoom=3 (well-framed for typical generated tracks). Override with --zoom=N.
const zoom = arg("zoom") !== null ? parseFloat(arg("zoom")!) : 3;
const resolution = has("1080p") ? "1080p" : "720p";
const hq = has("hq");
const outPath = resolve(arg("out") ?? "shakedown/out.mp4");
const headed = has("headed");

if (!trackPath || !existsSync(trackPath)) {
  console.error(`pass --track=path/to/track.json (got: ${trackPath})`);
  process.exit(1);
}
if (zoom !== undefined && !Number.isFinite(zoom)) {
  console.error(`--zoom must be a number (got: ${arg("zoom")})`);
  process.exit(1);
}

const trackJson = JSON.parse(readFileSync(trackPath, "utf8"));
console.log(
  `track=${trackPath} (${trackJson.lines?.length} lines, duration=${trackJson.duration})\n` +
    `resolution=${resolution}${hq ? " HQ" : ""} zoom=${zoom ?? "default"}\n` +
    `origin=${origin}\nout=${outPath}`,
);

try {
  await exportVideo({ trackJson, outPath, origin, zoom, resolution, hq, headed });
} catch (e) {
  if (e instanceof MirrorUnreachableError) {
    console.error(`\nERROR: cannot reach ${origin}`);
    console.error(`hint: run \`python3 -m http.server 8765 --bind 127.0.0.1\` from the mirror/ directory.`);
    process.exit(2);
  }
  console.error(`\nERROR: ${String(e)}`);
  process.exit(1);
}
