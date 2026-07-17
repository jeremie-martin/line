/**
 * Read-only, complete accounting for the declared tangential-impulse control
 * economics audit. It neither generates candidates nor selects a compact form.
 */
import { readFileSync } from "node:fs";

const DEFAULT_ARTIFACTS = [
  "generated/studies/two-contact-shooting/transient-accelerated-release-v1/dense240-db0b899a54a0.json",
  "generated/studies/two-contact-shooting/transient-accelerated-release-heldout-v1/accelerated_transient_dense_dialogue-8a3045662a59.json",
  "generated/studies/two-contact-shooting/transient-accelerated-release-heldout-v1/accelerated_transient_countercurrent_ordinary-ae4608f2e80b.json",
  "generated/studies/two-contact-shooting/transient-accelerated-release-heldout-v1/accelerated_transient_low_air_endurance-b959e9c5d5b5.json",
] as const;

const argv = process.argv.slice(2);
const artifacts = argv.filter((value) => value.startsWith("--artifact=")).map((value) => value.slice("--artifact=".length));
if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: audit_accelerated_transient_economics.ts [--artifact=PATH ...]",
    "",
    "Reports every retained first-C1 / accelerated-bridge label and label pair.",
  ].join("\n") + "\n");
  process.exit(0);
}
if (argv.some((value) => !value.startsWith("--artifact="))) {
  throw new Error("unsupported argument; expected --artifact=PATH");
}

const results = (artifacts.length === 0 ? DEFAULT_ARTIFACTS : artifacts).map(auditArtifact);
process.stdout.write(`${JSON.stringify({
  schema: "line.study-tangential-impulse-control-economics-audit.v1",
  legalAirborneFrames: 6,
  results,
  aggregateByFirstLabel: aggregate(results.flatMap((result) => result.pairs), (pair) => pair.firstLabel),
  aggregateByLabelPair: aggregate(results.flatMap((result) => result.pairs), (pair) => `${pair.firstLabel} -> ${pair.bridgeLabel}`),
}, null, 2)}\n`);

function auditArtifact(path: string): ArtifactResult {
  const document = JSON.parse(readFileSync(path, "utf8")) as StudyDocument;
  const pairs = document.rows.flatMap((row) => (row.segment2?.rows ?? [])
    .filter((segment) => (
      row.family === "capture-arc" &&
      segment.family === "capture-arc" &&
      segment.contactForm === "transient-c1-to-ballistic-accelerated-release" &&
      segment.returnBoundary?.materialized === true
    ))
    .map((segment) => ({
      fixture: document.panel.id,
      firstLabel: row.controlId,
      bridgeLabel: withoutAcceleratedSuffix(segment.label),
      legalAirborne: (segment.returnBoundary!.k2ArrivalState?.airborneAgeFrames ?? -1) >= 6,
      normalControlAvailable: segment.returnBoundary!.rawNormalControlAvailable,
      normalReturn: segment.returnBoundary!.rawNormalAdmitted > 0,
      normalAdmissions: segment.returnBoundary!.rawNormalAdmitted,
      chargedFrames: segment.returnBoundary!.chargedFrames,
    })));
  return {
    path,
    fixture: document.panel.id,
    pairs,
    byFirstLabel: aggregate(pairs, (pair) => pair.firstLabel),
    byLabelPair: aggregate(pairs, (pair) => `${pair.firstLabel} -> ${pair.bridgeLabel}`),
  };
}

function aggregate(pairs: readonly PairRow[], keyFor: (pair: PairRow) => string): readonly AggregateRow[] {
  const groups = new Map<string, PairRow[]>();
  for (const pair of pairs) {
    const key = keyFor(pair);
    const existing = groups.get(key);
    if (existing === undefined) groups.set(key, [pair]);
    else existing.push(pair);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, rows]) => {
      const legalRows = rows.filter((row) => row.legalAirborne);
      const legalReturns = legalRows.filter((row) => row.normalReturn);
      const normalAdmissions = legalRows.reduce((sum, row) => sum + row.normalAdmissions, 0);
      const chargedFrames = rows.reduce((sum, row) => sum + row.chargedFrames, 0);
      return {
        label,
        materializedPairs: rows.length,
        legalAirbornePairs: legalRows.length,
        normalControlUnavailablePairs: rows.filter((row) => !row.normalControlAvailable).length,
        legalNormalReturnPairs: legalReturns.length,
        legalNormalAdmissions: normalAdmissions,
        chargedFrames,
        chargedFramesPerLegalReturnPair: legalReturns.length === 0 ? null : round(chargedFrames / legalReturns.length),
        chargedFramesPerLegalNormalAdmission: normalAdmissions === 0 ? null : round(chargedFrames / normalAdmissions),
      };
    });
}

function withoutAcceleratedSuffix(label: string): string {
  const suffix = "_accelerated_transient";
  if (!label.endsWith(suffix)) throw new Error(`unexpected accelerated bridge label ${label}`);
  return label.slice(0, -suffix.length);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

type StudyDocument = {
  panel: { id: string };
  rows: readonly OuterRow[];
};
type OuterRow = {
  family: string;
  controlId: string;
  segment2: { rows: readonly SegmentRow[] } | null;
};
type SegmentRow = {
  family: string;
  label: string;
  contactForm: string;
  returnBoundary: ReturnBoundary | null;
};
type ReturnBoundary = {
  materialized: boolean;
  k2ArrivalState: { airborneAgeFrames: number } | null;
  rawNormalControlAvailable: boolean;
  rawNormalAdmitted: number;
  chargedFrames: number;
};
type PairRow = {
  fixture: string;
  firstLabel: string;
  bridgeLabel: string;
  legalAirborne: boolean;
  normalControlAvailable: boolean;
  normalReturn: boolean;
  normalAdmissions: number;
  chargedFrames: number;
};
type AggregateRow = {
  label: string;
  materializedPairs: number;
  legalAirbornePairs: number;
  normalControlUnavailablePairs: number;
  legalNormalReturnPairs: number;
  legalNormalAdmissions: number;
  chargedFrames: number;
  chargedFramesPerLegalReturnPair: number | null;
  chargedFramesPerLegalNormalAdmission: number | null;
};
type ArtifactResult = {
  path: string;
  fixture: string;
  pairs: readonly PairRow[];
  byFirstLabel: readonly AggregateRow[];
  byLabelPair: readonly AggregateRow[];
};
