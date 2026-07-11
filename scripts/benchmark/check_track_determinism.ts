/**
 * Bit-level compile determinism check (Benchmark V2, RFC D step 2).
 *
 * Joins a re-run subset against a retained scale-study reference on
 * (sourceId, budget, actualSeed) and requires bit-level trackHash equality
 * plus exact stored-score equality for every joined cell. This upgrades the
 * pairing study's score-identity evidence to full-output hash identity.
 *
 * Usage:
 *   node --import tsx scripts/benchmark/check_track_determinism.ts \
 *     --reference=benchmark/v2/runs/...-independent-reference-....json.gz \
 *     --recheck=generated/benchmark-v2/studies/independent-reference-recheck.json \
 *     [--out=benchmark/v2/studies/determinism-check.json]
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { readVerifiedArtifact } from "./study_lib.ts";

const REPO = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const referencePath = resolve(REPO, argument("reference") ?? "");
const recheckPath = resolve(REPO, argument("recheck") ?? "");
const outPath = resolve(REPO, argument("out") ?? "benchmark/v2/studies/determinism-check.json");
if (argument("reference") === undefined || argument("recheck") === undefined) {
  throw new Error(`usage: check_track_determinism --reference=ARCHIVE --recheck=ARCHIVE [--out=PATH]`);
}

const reference = readVerifiedArtifact(referencePath);
const recheck = readVerifiedArtifact(recheckPath);
const referenceJson = JSON.parse(reference.bytes.toString("utf8"));
const recheckJson = JSON.parse(recheck.bytes.toString("utf8"));

type Row = { sourceId: string; budget: number; actualSeed: number; trackHash: string | null; score: unknown };

function rows(archive: any, label: string): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const run of archive.runs ?? []) {
    if (run.status !== "ok") throw new Error(`${label}: contains a non-ok run (${run.task?.sourceId})`);
    const row: Row = {
      sourceId: run.task.sourceId,
      budget: run.task.budget,
      actualSeed: run.task.actualSeed,
      trackHash: run.trackHash ?? null,
      score: run.score,
    };
    map.set(`${row.sourceId}\0${row.budget}\0${row.actualSeed}`, row);
  }
  return map;
}

const referenceRows = rows(referenceJson, "reference");
const recheckRows = rows(recheckJson, "recheck");

let joined = 0;
let trackHashEqual = 0;
let scoreEqual = 0;
const perCell: Array<{ sourceId: string; budget: number; actualSeed: number; trackHash: string }> = [];
for (const [key, recheckRow] of [...recheckRows].sort(([a], [b]) => a.localeCompare(b))) {
  const referenceRow = referenceRows.get(key);
  if (referenceRow === undefined) throw new Error(`recheck cell ${key.replaceAll("\0", "/")} is absent from the reference`);
  joined++;
  if (recheckRow.trackHash === null || referenceRow.trackHash === null) {
    throw new Error(`${key.replaceAll("\0", "/")}: trackHash missing (both archives must be budget-scale-study.v2)`);
  }
  if (recheckRow.trackHash === referenceRow.trackHash) trackHashEqual++;
  if (JSON.stringify(recheckRow.score) === JSON.stringify(referenceRow.score)) scoreEqual++;
  perCell.push({
    sourceId: recheckRow.sourceId,
    budget: recheckRow.budget,
    actualSeed: recheckRow.actualSeed,
    trackHash: recheckRow.trackHash,
  });
}

const report = {
  schema: "line.benchmark-v2.determinism-check.v1",
  reference: { path: argument("reference"), artifactSha256: reference.artifactSha256 },
  recheck: {
    path: argument("recheck"),
    artifactSha256: recheck.artifactSha256,
    budgets: recheckJson.budgets,
    seeds: recheckJson.seeds,
  },
  cells: joined,
  allTrackHashesEqual: trackHashEqual === joined,
  allScoresEqual: scoreEqual === joined,
  trackHashEqualCells: trackHashEqual,
  scoreEqualCells: scoreEqual,
  perCell,
};
const bytes = `${JSON.stringify(report, null, 2)}\n`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, bytes);
writeFileSync(`${outPath.replace(/\.json$/, "")}.provenance.json`, `${JSON.stringify({
  schema: "line.benchmark-v2.study-provenance.v1",
  artifact: argument("out") ?? "benchmark/v2/studies/determinism-check.json",
  artifactSha256: createHash("sha256").update(bytes).digest("hex"),
  generatedAt: new Date().toISOString(),
  command: "node --import tsx scripts/benchmark/check_track_determinism.ts",
}, null, 2)}\n`);
console.log(`determinism: ${trackHashEqual}/${joined} trackHash equal, ${scoreEqual}/${joined} scores equal`);
if (trackHashEqual !== joined || scoreEqual !== joined) {
  console.error(`DETERMINISM FAILURE — see ${outPath}`);
  process.exit(1);
}
