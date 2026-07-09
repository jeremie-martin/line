/**
 * Impact candidate-funnel study (read-only diagnostic).
 *
 * Question: WHERE does deep-scoop geometry die? The lab shows achieved impact
 * needs |path turn| ≈ asin(target·REDIR_CAP/speed) (≈20-25° at typical asks)
 * but final tracks land at ~8°, and neither more generation pressure nor more
 * ranking weight moves the selected geometry. This study tracks every probed
 * candidate on impact-targeted gaps through the funnel:
 *
 *   generated → survived (gate 1) → admitted (gates 2+3, W=1) → ranked → SELECTED
 *
 * and classifies each gap:
 *   A "not generated"  no candidate with |turn| ≥ needed was ever sampled
 *   B "gates kill"     deep candidates sampled, none admitted
 *   C "ranking loses"  deep candidates admitted, a shallow one selected
 *   D "works"          selected |turn| ≥ needed
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_impact_funnel.ts \
 *     [--specs=a,b] [--seeds=0,1,2] [--budget=300000] [--out=path.json]
 *
 * Probe is observation-only: compiles are byte-identical to production.
 */
import { writeFileSync } from "node:fs";
import {
  drainLandingWindowProbe,
  enableLandingWindowProbe,
  type LandingWindowProbeRecord,
} from "./landing_probe.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { IMPACT, impactToRedirArcPx } from "./types.ts";
import { extractTrackArcs } from "./analysis/geometry.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const DEFAULT_SPECS = "dense_echo_climb,cold_start,climb_terrace,rolling_drop,verse_chorus,drums_dropout";
const specNames = (argValue("specs") ?? DEFAULT_SPECS).split(",") as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0,1,2").split(",").map(Number);
const budget = Number(argValue("budget") ?? "300000");
const outPath = argValue("out");
for (const s of specNames) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(s)) {
    console.error(`unknown spec "${s}"`);
    process.exit(1);
  }
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const mean = (xs: number[]): number => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs: number[]): number => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const f1 = (x: number): string => (Number.isFinite(x) ? x.toFixed(1) : "n/a");
const f2 = (x: number): string => (Number.isFinite(x) ? x.toFixed(2) : "n/a");

type GapRow = {
  spec: string;
  seed: number;
  gapIndex: number;
  target: number;
  speedRef: number;
  neededTurnDeg: number;
  nGenerated: number;
  nSurvived: number;
  nAdmitted: number;
  nRanked: number;
  /** Max |turn| at each stage. */
  maxTurnGenerated: number;
  maxTurnSurvived: number;
  maxTurnAdmitted: number;
  /** Deepest admitted candidate's percentile by cost and by handoff score
   *  among admitted candidates of this gap (0 = best ranked, 1 = worst). */
  deepCostPctl: number | null;
  deepHandoffPctl: number | null;
  deepImpactAchieved: number | null;
  closestImpactAchieved: number | null;
  closestImpactAbsError: number | null;
  closestImpactCostPctl: number | null;
  closestImpactHandoffPctl: number | null;
  selectedTurnDeg: number | null;
  selectedImpactBias: number | null;
  verdict: "A_not_generated" | "B_gates_kill" | "C_ranking_loses" | "D_works" | "unknown";
};

const rows: GapRow[] = [];
enableLandingWindowProbe();

for (const specName of specNames) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    const t0 = Date.now();
    const checkpoint = compileHandoff(spec, seed, { budget });
    const { records } = drainLandingWindowProbe();
    const report = checkpoint.report;
    const trackArcs = extractTrackArcs(
      checkpoint.track as { startPosition?: { x: number }; lines?: { x1: number; y1: number; x2: number; y2: number }[] },
      report.contacts.length,
    );
    const selectedTurnByGap = new Map<number, number>();
    if (trackArcs.pairing_confident === 1) {
      for (const arc of trackArcs.arcs) {
        if (arc.contact_index !== null && arc.turn_deg !== null) {
          selectedTurnByGap.set(arc.contact_index, arc.turn_deg);
        }
      }
    }

    const byGap = new Map<number, LandingWindowProbeRecord[]>();
    for (const r of records) {
      if (r.targetImpact === undefined) continue;
      const arr = byGap.get(r.gapIndex) ?? [];
      arr.push(r);
      byGap.set(r.gapIndex, arr);
    }

    for (const [gapIndex, recs] of [...byGap.entries()].sort((a, b) => a[0] - b[0])) {
      const target = recs[0].targetImpact ?? 0;
      const speeds = recs.map((r) => r.incomingSpeed).filter((s): s is number => s !== null);
      const speedRef = speeds.length > 0 ? median(speeds) : 10;
      const neededTurnDeg = (
        clamp(
          impactToRedirArcPx(target) / Math.max(1, speedRef),
          0,
          Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION),
        ) * 180
      ) / Math.PI;

      const turnOf = (r: LandingWindowProbeRecord): number => Math.abs(r.turnDeg ?? 0);
      const survived = recs.filter((r) => r.failure !== "survival");
      const admitted = survived.filter((r) => r.cost !== null && r.acceptedAtW === 1);
      const ranked = admitted.filter((r) => r.handoffScore !== undefined);
      const maxTurn = (rs: LandingWindowProbeRecord[]): number =>
        rs.length > 0 ? Math.max(...rs.map(turnOf)) : 0;

      const deepAdmitted = admitted.filter((r) => turnOf(r) >= neededTurnDeg);
      const deepest = deepAdmitted.length > 0
        ? deepAdmitted.reduce((a, b) => (turnOf(a) >= turnOf(b) ? a : b))
        : null;
      const impactMeasured = admitted.filter(
        (r): r is LandingWindowProbeRecord & { impactAchieved: number } =>
          r.impactAchieved !== null && Number.isFinite(r.impactAchieved),
      );
      const closestImpact = impactMeasured.length > 0
        ? impactMeasured.reduce((a, b) =>
          Math.abs(a.impactAchieved - target) <= Math.abs(b.impactAchieved - target) ? a : b
        )
        : null;
      const pctlOf = (rs: LandingWindowProbeRecord[], pick: LandingWindowProbeRecord, key: (r: LandingWindowProbeRecord) => number | null): number | null => {
        const vals = rs.map(key).filter((v): v is number => v !== null && Number.isFinite(v));
        const v = key(pick);
        if (v === null || vals.length < 2) return null;
        return vals.filter((x) => x < v).length / (vals.length - 1);
      };

      const selectedTurn = selectedTurnByGap.get(gapIndex) ?? null;
      const gapReport = report.gaps.find((g) => g.gap_index === gapIndex);
      const impactAxis = gapReport?.axes?.impact;
      const selectedBias = impactAxis !== undefined ? impactAxis.achieved - impactAxis.target : null;

      let verdict: GapRow["verdict"] = "unknown";
      if (selectedTurn !== null && Math.abs(selectedTurn) >= neededTurnDeg) verdict = "D_works";
      else if (deepAdmitted.length > 0) verdict = "C_ranking_loses";
      else if (maxTurn(recs) >= neededTurnDeg) verdict = "B_gates_kill";
      else verdict = "A_not_generated";

      rows.push({
        spec: specName, seed, gapIndex, target, speedRef, neededTurnDeg,
        nGenerated: recs.length, nSurvived: survived.length,
        nAdmitted: admitted.length, nRanked: ranked.length,
        maxTurnGenerated: maxTurn(recs),
        maxTurnSurvived: maxTurn(survived),
        maxTurnAdmitted: maxTurn(admitted),
        deepCostPctl: deepest !== null ? pctlOf(admitted, deepest, (r) => r.cost) : null,
        deepHandoffPctl: deepest !== null ? pctlOf(ranked, deepest, (r) => r.handoffScore ?? null) : null,
        deepImpactAchieved: deepest?.impactAchieved ?? null,
        closestImpactAchieved: closestImpact?.impactAchieved ?? null,
        closestImpactAbsError: closestImpact === null
          ? null
          : Math.abs(closestImpact.impactAchieved - target),
        closestImpactCostPctl: closestImpact !== null
          ? pctlOf(admitted, closestImpact, (r) => r.cost)
          : null,
        closestImpactHandoffPctl: closestImpact !== null
          ? pctlOf(ranked, closestImpact, (r) => r.handoffScore ?? null)
          : null,
        selectedTurnDeg: selectedTurn,
        selectedImpactBias: selectedBias,
        verdict,
      });
    }
    console.error(
      `  ${specName}/s${seed}: ${records.length} records, ${byGap.size} impact gaps, ` +
        `${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
  }
}

// ─────────── report ───────────

console.log(`\n=== impact candidate funnel (budget ${budget}, ${specNames.length} specs × seeds ${seeds.join(",")}) ===`);
console.log(`impact-targeted gaps: ${rows.length}\n`);

const byVerdict = new Map<string, GapRow[]>();
for (const row of rows) {
  const arr = byVerdict.get(row.verdict) ?? [];
  arr.push(row);
  byVerdict.set(row.verdict, arr);
}
console.log("verdict (where does the needed-turn geometry die?):");
for (const v of ["A_not_generated", "B_gates_kill", "C_ranking_loses", "D_works", "unknown"]) {
  const rs = byVerdict.get(v) ?? [];
  if (rs.length === 0) continue;
  console.log(
    `  ${v.padEnd(16)} ${String(rs.length).padStart(4)} gaps (${((100 * rs.length) / rows.length).toFixed(0)}%)` +
      `  avg target ${f2(mean(rs.map((r) => r.target)))}` +
      `  avg needed ${f1(mean(rs.map((r) => r.neededTurnDeg)))}°` +
      `  avg selected |turn| ${f1(mean(rs.map((r) => Math.abs(r.selectedTurnDeg ?? NaN)).filter(Number.isFinite)))}°` +
      `  avg bias ${f2(mean(rs.map((r) => r.selectedImpactBias ?? NaN).filter(Number.isFinite)))}`,
  );
}

console.log("\nfunnel attrition by |turn| bucket (all gaps pooled):");
console.log("  bucket      generated  survive%  admit%(of survived)");
const buckets: [number, number][] = [[0, 10], [10, 20], [20, 30], [30, 90]];
// Re-aggregate from per-gap maxima is lossy; recompute from raw records next run if needed.
// Here: approximate via per-gap stage maxima transitions.
for (const [lo, hi] of buckets) {
  const gapsWithGen = rows.filter((r) => r.maxTurnGenerated >= lo && r.maxTurnGenerated < hi);
  const survKept = gapsWithGen.filter((r) => r.maxTurnSurvived >= lo).length;
  const admitKept = gapsWithGen.filter((r) => r.maxTurnAdmitted >= lo).length;
  console.log(
    `  ${`${lo}-${hi}°`.padEnd(10)} ${String(gapsWithGen.length).padStart(9)}` +
      `  ${gapsWithGen.length > 0 ? ((100 * survKept) / gapsWithGen.length).toFixed(0) : "n/a"}%` +
      `      ${gapsWithGen.length > 0 ? ((100 * admitKept) / gapsWithGen.length).toFixed(0) : "n/a"}%`,
  );
}

const cRows = byVerdict.get("C_ranking_loses") ?? [];
if (cRows.length > 0) {
  console.log(`\nC_ranking_loses detail (${cRows.length} gaps — deep candidates admitted but not selected):`);
  console.log(
    `  deepest-admitted candidate: avg cost percentile ${f2(mean(cRows.map((r) => r.deepCostPctl ?? NaN).filter(Number.isFinite)))}` +
      ` · avg handoff percentile ${f2(mean(cRows.map((r) => r.deepHandoffPctl ?? NaN).filter(Number.isFinite)))}` +
      ` (0 = ranked best, 1 = worst)`,
  );
  console.log(
    `  deepest-admitted impactAchieved avg ${f2(mean(cRows.map((r) => r.deepImpactAchieved ?? NaN).filter(Number.isFinite)))}` +
      ` vs gap target avg ${f2(mean(cRows.map((r) => r.target)))}`,
  );
}

const rowsWithClosest = rows.filter((r) => r.closestImpactAbsError !== null);
if (rowsWithClosest.length > 0) {
  const selectedAbsErrors = rowsWithClosest
    .map((r) => Math.abs(r.selectedImpactBias ?? NaN))
    .filter(Number.isFinite);
  const closestAbsErrors = rowsWithClosest
    .map((r) => r.closestImpactAbsError ?? NaN)
    .filter(Number.isFinite);
  const materialOracleRows = rowsWithClosest.filter(
    (r) => r.selectedImpactBias !== null &&
      (r.closestImpactAbsError ?? Infinity) + 0.025 < Math.abs(r.selectedImpactBias),
  );
  console.log("\nclosest admitted impact candidate:");
  console.log(
    `  avg selected |impact error| ${f2(mean(selectedAbsErrors))}` +
      ` -> closest admitted ${f2(mean(closestAbsErrors))}` +
      ` · material oracle rows ${materialOracleRows.length}/${rowsWithClosest.length}`,
  );
  console.log(
    `  closest candidate avg cost percentile ` +
      `${f2(mean(rowsWithClosest.map((r) => r.closestImpactCostPctl ?? NaN).filter(Number.isFinite)))}` +
      ` · handoff percentile ` +
      `${f2(mean(rowsWithClosest.map((r) => r.closestImpactHandoffPctl ?? NaN).filter(Number.isFinite)))}` +
      ` (0 = ranked best, 1 = worst)`,
  );
}

if (outPath !== undefined) {
  writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`\nper-gap rows → ${outPath}`);
}
