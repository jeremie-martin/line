import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Spec } from "../v0/types.ts";
import type { BenchmarkScoreDocument } from "../v0/benchmark_v2/score_model.ts";

type Cohort = "representative" | "capability" | "regression" | "development_music";

const SOURCE_MANIFEST = JSON.parse(readFileSync("benchmark/v2/archive/prototype-v2.0/source-manifest.json", "utf8"));
const OUTPUT_ROOT = resolve("benchmark/v2/cases/normative");
const phaseOverrides: Record<string, BenchmarkScoreDocument["phases"]> = {
  river_reentry: phases([0, 6, 24.24, 28.47, 46.71, 58], ["arrival", "first_current", "displaced_fill", "second_current", "release"]),
  countercurrent: phases([0, 8.38, 21.4, 25.74, 47.44, 55], ["quiet_support", "first_pulse_body", "open_turn", "second_pulse_body", "tail"]),
  split_signal: phases([0, 10.66, 18.86, 28.7, 36.9, 46.74, 60], ["primary_open", "dense_answer_one", "primary_return", "dense_answer_two", "open_signal", "tail_answer"]),
  pickup_lattice: phases([0, 14.74, 28.81, 42.88, 58], ["alternating_pickups", "double_answers_one", "double_answers_two", "final_lattice"]),
  loose_pocket: phases([0, 13.28, 26.03, 38.78, 51.53, 56], ["push_drag_one", "turn_one", "middle_pocket", "late_turn", "release"]),
  offgrid_conversation: phases([0, 13.66, 26.4, 40.06, 56], ["question_answer", "first_overlap", "tightened_answer", "late_overlap"]),
  rising_switch: phases([0, 12.58, 22.66, 39.3, 58], ["wide_open", "middle_switch", "driving_crest", "measured_release"]),
  meter_exchange: phases([0, 15.67, 31.54, 43.54, 60], ["compact_spacious_one", "compact_spacious_two", "compact_drive", "broad_release"]),
  wide_breaths: phases([0, 17.25, 22.08, 38.64, 44.16, 62], ["opening_groove", "single_breath", "middle_groove", "double_breath", "late_groove"]),
  open_hook: phases([0, 10.29, 15.68, 28.42, 34.79, 43.61, 58], ["compact_hooks", "open_response_one", "hook_body", "open_response_two", "final_hook", "tail"]),
  amplitude_tides: phases([0, 8.84, 21.32, 33.8, 46.28, 62], ["compact_opening", "first_tide", "middle_compact", "second_tide", "final_tide"]),
  dense_dialogue: phases([0, 12.16, 22.4, 29.2, 41.68, 51.6, 58], ["compact_exchange_one", "compact_exchange_two", "breathing_release", "dense_return_one", "dense_return_two", "tail"]),
  high_air_drive: phases([0, 9.86, 23.78, 33.06, 46.98, 60], ["lift_opening", "first_crest", "middle_breath", "late_crest", "floating_release"]),
  sparse_lowline: phases([0, 9.3, 22.32, 35.34, 48.36, 60], ["supported_opening", "first_omissions", "middle_support", "second_omissions", "tail"]),
  regression_transition_mosaic: phases([0, 13.6, 24.4, 35.2, 49.9, 60], ["cold_initialization", "compact_ladder", "switchback_drive", "expanded_section", "tail"]),
  regression_amplitude_mosaic: phases([0, 19.5, 38.7, 53.65, 60], ["amplitude_ramp", "dense_settle", "spacious_canyon", "tail"]),
};

const entries = [
  ...SOURCE_MANIFEST.representative_candidates.map((entry: any) => ({ ...entry, cohort: "representative" as Cohort })),
  ...SOURCE_MANIFEST.capability_candidates.map((entry: any) => ({ ...entry, cohort: "capability" as Cohort })),
  ...SOURCE_MANIFEST.regression_candidates.map((entry: any) => ({ ...entry, cohort: "regression" as Cohort })),
];

for (const entry of entries) {
  const document = JSON.parse(readFileSync(entry.score_source, "utf8")) as BenchmarkScoreDocument;
  if ((document.phases?.length ?? 0) === 0) document.phases = phaseOverrides[entry.id];
  if ((document.phases?.length ?? 0) === 0) throw new Error(`${entry.id}: phase migration missing`);
  const path = resolve(OUTPUT_ROOT, entry.cohort, `${entry.id}.ts`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, scoreModule(entry, document));
  console.log(relative(process.cwd(), path));
}

const musicEntries = SOURCE_MANIFEST.development_music_candidates as any[];
for (const entry of musicEntries) {
  const imported = await import(pathToFileURL(resolve(entry.module)).href);
  const spec = imported.default as Spec;
  const phases = (imported.overlayMeta?.phases ?? []).map((phase: any, index: number) => ({
    id: slug(phase.id ?? phase.name ?? `phase_${index + 1}`),
    start: phase.start ?? phase.t0,
    end: phase.end ?? phase.t1,
    intent: `music-authored ${String(phase.name ?? phase.id ?? `phase ${index + 1}`).toLowerCase()} section`,
  })).filter((phase: any) => phase.start >= 0 && phase.end <= spec.duration && phase.end > phase.start);
  const path = resolve(OUTPUT_ROOT, "development_music", `${entry.id}.ts`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, sampledModule(entry, spec, phases));
  console.log(relative(process.cwd(), path));
}

function scoreModule(entry: any, document: BenchmarkScoreDocument): string {
  const importPath = relativeImport(resolve(OUTPUT_ROOT, entry.cohort, `${entry.id}.ts`), resolve("benchmark/v2/cases/case.ts"));
  return `import { defineScoreCase } from ${JSON.stringify(importPath)};\n` +
    `import type { BenchmarkScoreDocument } from ${JSON.stringify(relativeImport(resolve(OUTPUT_ROOT, entry.cohort, `${entry.id}.ts`), resolve("scripts/v0/benchmark_v2/score_model.ts")))};\n\n` +
    `export const scoreDocument = ${JSON.stringify(document, null, 2)} as const satisfies BenchmarkScoreDocument;\n\n` +
    `export const benchmarkCase = defineScoreCase({\n` +
    `  metadata: ${JSON.stringify({
      cohort: entry.cohort,
      musicBacked: false,
      eligibleComponents: entry.eligible_components,
      diagnosticComponents: entry.diagnostic_components ?? [],
      notes: entry.notes,
    }, null, 2)},\n` +
    `  document: scoreDocument,\n` +
    `});\n\nexport default benchmarkCase.spec;\n`;
}

function sampledModule(entry: any, spec: Spec, phases: any[]): string {
  const path = resolve(OUTPUT_ROOT, "development_music", `${entry.id}.ts`);
  const frameCount = Math.round(spec.duration * 40);
  const axes = Object.fromEntries(Object.entries(spec.axes).map(([axis, curve]) => [axis, {
    fps: 40,
    values: Array.from({ length: frameCount + 1 }, (_, frame) => {
      const value = curve?.(frame / 40);
      return value === undefined ? null : Number(value.toPrecision(15));
    }),
  }]));
  const metadata = {
    id: entry.id,
    title: entry.id === "believer_56_6s" ? "Believer Rhythm Interpretation" : "Believer Impact Interpretation",
    cohort: "development_music",
    originFamily: entry.origin_family,
    musicBacked: true,
    musicWorkId: entry.music_work_id,
    referencePulseSeconds: entry.reference_pulse_seconds,
    eligibleComponents: entry.eligible_components,
    diagnosticComponents: entry.diagnostic_components ?? [],
    phases,
    notes: entry.notes,
  };
  const document = {
    duration: spec.duration,
    contacts: spec.contacts,
    axes,
    jitter: 0,
    preroll: spec.preroll,
    start: spec.start,
  };
  return `import { defineSampledCase } from ${JSON.stringify(relativeImport(path, resolve("benchmark/v2/cases/case.ts")))};\n\n` +
    `export const sampledDocument = ${JSON.stringify(document, null, 2)} as const;\n\n` +
    `export const benchmarkCase = defineSampledCase({\n  metadata: ${JSON.stringify(metadata, null, 2)},\n  document: sampledDocument,\n});\n\n` +
    `export default benchmarkCase.spec;\n`;
}

function phases(bounds: number[], ids: string[]): NonNullable<BenchmarkScoreDocument["phases"]> {
  return ids.map((id, index) => ({
    id,
    start: bounds[index],
    end: bounds[index + 1],
    intent: id.replaceAll("_", " "),
  }));
}

function relativeImport(fromFile: string, target: string): string {
  let path = relative(dirname(fromFile), target).replaceAll("\\", "/");
  if (!path.startsWith(".")) path = `./${path}`;
  return path;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
