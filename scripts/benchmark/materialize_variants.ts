import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  BenchmarkCase,
  BenchmarkCaseMetadata,
  SampledCaseDocument,
} from "../../benchmark/v2/cases/case.ts";
import type { BenchmarkScoreDocument, ScoreAxisPoint, ScoreEvent } from "../v0/benchmark_v2/score_model.ts";

type VariantPlan = {
  parentId: string;
  id: string;
  title: string;
  kind: string;
  rationale: string;
  parameters: Record<string, string | number | boolean>;
  transformScore?: (document: BenchmarkScoreDocument) => void;
  transformSampled?: (document: SampledCaseDocument) => void;
};

const legacyInventory = JSON.parse(readFileSync("benchmark/v2/archive/prototype-v2.0/source-manifest.json", "utf8"));
const normativeInventory = [
  ...legacyInventory.representative_candidates.map((entry: any) => ({ id: entry.id, cohort: "representative" })),
  ...legacyInventory.capability_candidates.map((entry: any) => ({ id: entry.id, cohort: "capability" })),
  ...legacyInventory.regression_candidates.map((entry: any) => ({ id: entry.id, cohort: "regression" })),
  ...legacyInventory.development_music_candidates.map((entry: any) => ({ id: entry.id, cohort: "development_music" })),
];
const normativeCases = await Promise.all(normativeInventory.map(async (entry: any) => {
  const sourcePath = `benchmark/v2/cases/normative/${entry.cohort}/${entry.id}.ts`;
  const imported = await import(pathToFileURL(resolve(sourcePath)).href);
  return { sourcePath, case: imported.benchmarkCase as BenchmarkCase };
}));

const plans: VariantPlan[] = [
  tempo("river_reentry", "river_reentry_tempo_fast_5", "River Reentry, 5% Faster", 0.95),
  impactContrast("countercurrent", "countercurrent_impact_contrast_12", "Countercurrent, Stronger Impact Contrast", 1.12),
  impactContrast("split_signal", "split_signal_impact_relief_12", "Split Signal, Softer Impact Contrast", 0.88),
  axisOffset("pickup_lattice", "pickup_lattice_speed_minus_4", "Pickup Lattice, Slower Surface", "speed", -0.04),
  placementShift("loose_pocket", "loose_pocket_drag_later_20ms", "Loose Pocket, Later Drag", "drag", 0.02),
  placementShift("offgrid_conversation", "offgrid_conversation_answer_early_25ms", "Off-grid Conversation, Earlier Answer", "answer", -0.025),
  tempo("rising_switch", "rising_switch_tempo_fast_5", "Rising Switch, 5% Faster", 0.95),
  axisOffset("meter_exchange", "meter_exchange_speed_plus_4", "Meter Exchange, Faster Drive", "speed", 0.04),
  axisOffset("wide_breaths", "wide_breaths_air_plus_5", "Wide Breaths, Higher Air", "air", 0.05),
  axisOffset("open_hook", "open_hook_amplitude_plus_8", "Open Hook, Wider Responses", "amplitude", 0.08),
  axisContrast("amplitude_tides", "amplitude_tides_restrained_10", "Amplitude Tides, Restrained Contrast", "amplitude", 0.90),
  impactContrast("dense_dialogue", "dense_dialogue_impact_contrast_10", "Dense Dialogue, Stronger Impact Contrast", 1.10),
  axisOffset("high_air_drive", "high_air_drive_air_minus_5", "High Air Drive, Lower Flight", "air", -0.05),
  axisOffset("sparse_lowline", "sparse_lowline_air_minus_4", "Sparse Lowline, Lower Omissions", "air", -0.04),
  {
    parentId: "frontier_pickup_progression",
    id: "frontier_pickup_progression_shifted",
    title: "Frontier Pickup Progression, Shifted Thresholds",
    kind: "pickup_thresholds",
    rationale: "Nearby but nonuniform 320/270/220/160ms pickup-to-accent boundaries test threshold generalization.",
    parameters: { p300_ms: 320, p250_ms: 270, p200_ms: 220, p180_ms: 160 },
    transformScore: (document) => {
      const offsets: Record<string, number> = { p300: 1.48, p250: 1.53, p200: 1.58, p180: 1.64 };
      for (const [phrase, offset] of Object.entries(offsets)) {
        const pickup = document.phrases[phrase].find((event) => event.role === "pickup");
        if (pickup === undefined) throw new Error(`${document.id}:${phrase} pickup missing`);
        pickup.offset = offset;
      }
    },
  },
  {
    parentId: "frontier_dense_recovery",
    id: "frontier_dense_recovery_240ms_figures",
    title: "Frontier Dense Recovery, 240ms Figures",
    kind: "dense_figure_spacing",
    rationale: "A nearby 240ms pickup/fill cluster checks whether recovery behavior generalizes around the 220ms base boundary.",
    parameters: { cluster_gap_ms: 240 },
    transformScore: (document) => {
      const triple = document.phrases.triple;
      const replacements: Partial<Record<ScoreEvent["role"], number>> = {
        primary: 1.08,
        pickup: 1.32,
        fill: 1.56,
        accent: 1.80,
      };
      let primarySeen = 0;
      for (const event of triple) {
        if (event.role === "primary") {
          primarySeen++;
          if (primarySeen !== 2) continue;
        }
        const replacement = replacements[event.role];
        if (replacement !== undefined) event.offset = replacement;
      }
      triple.sort((a, b) => a.offset - b.offset);
    },
  },
  rideoutDuration(4),
  rideoutDuration(6),
  rideoutDuration(7),
  tempo("regression_transition_mosaic", "regression_transition_mosaic_tempo_fast_5", "Regression Transition Mosaic, 5% Faster", 0.95),
  axisContrast("regression_amplitude_mosaic", "regression_amplitude_mosaic_contrast_10", "Regression Amplitude Mosaic, Stronger Contrast", "amplitude", 1.10),
  sampledVariant(
    "believer_56_6s",
    "believer_56_6s_impact_relief",
    "Believer Rhythm Interpretation, Impact Relief",
    "music_axis_perturbation",
    "The synchronized rhythm remains fixed while extreme authored impacts are compressed toward the center.",
    { impact_contrast: 0.90 },
    (document) => {
      for (const contact of document.contacts) if (contact.impact !== undefined) contact.impact = contrast(contact.impact, 0.90);
    },
  ),
  sampledVariant(
    "believer_impact_56s",
    "believer_impact_56s_amplitude_plus_5",
    "Believer Impact Interpretation, Wider Amplitude",
    "music_axis_perturbation",
    "The synchronized rhythm and impact program remain fixed while the authored amplitude surface opens slightly.",
    { amplitude_offset: 0.05 },
    (document) => transformSampledAxis(document, "amplitude", (value) => clamp(value + 0.05)),
  ),
];

const parentById = new Map(normativeCases.map((entry) => [entry.case.metadata.id, entry]));
const generated: Array<{ id: string; path: string }> = [];
for (const plan of plans) {
  const parent = parentById.get(plan.parentId);
  if (parent === undefined) throw new Error(`${plan.id}: parent ${plan.parentId} missing`);
  const outputPath = resolve("benchmark/v2/cases/variants", parent.case.metadata.cohort, `${plan.id}.ts`);
  mkdirSync(dirname(outputPath), { recursive: true });
  const metadata = variantMetadata(parent.case, plan);
  if (parent.case.scoreDocument !== undefined && plan.transformScore !== undefined) {
    const document = structuredClone(parent.case.scoreDocument);
    document.id = plan.id;
    document.title = plan.title;
    document.provenance.authoring_brief = `${document.provenance.authoring_brief} Variant: ${plan.rationale}`;
    plan.transformScore(document);
    metadata.phases = structuredClone(document.phases ?? []);
    writeFileSync(outputPath, scoreModule(outputPath, metadata, document));
  } else if (parent.case.directDocument !== undefined && plan.transformSampled !== undefined) {
    const document = structuredClone(parent.case.directDocument);
    plan.transformSampled(document);
    writeFileSync(outputPath, sampledModule(outputPath, metadata, document));
  } else {
    throw new Error(`${plan.id}: transform does not match parent source kind`);
  }
  generated.push({ id: plan.id, path: relative(process.cwd(), outputPath).replaceAll("\\", "/") });
  console.log(generated.at(-1)!.path);
}

writeFileSync(resolve("benchmark/v2/variant_catalog.generated.ts"), catalogModule(generated));

function tempo(parentId: string, id: string, title: string, factor: number): VariantPlan {
  return {
    parentId, id, title, kind: "global_tempo", rationale: `The complete authored program is time-scaled by ${factor} while preserving phrase structure and axis intent.`,
    parameters: { time_scale: factor },
    transformScore: (document) => {
      document.duration = time(document.duration, factor);
      for (const region of document.pulse_regions) {
        region.start = time(region.start, factor); region.end = time(region.end, factor); region.pulse_seconds = time(region.pulse_seconds, factor);
      }
      for (const phase of document.phases ?? []) { phase.start = time(phase.start, factor); phase.end = time(phase.end, factor); }
      for (const phrase of Object.values(document.phrases)) {
        for (const event of phrase) event.offset = time(event.offset, factor);
      }
      for (const placement of document.placements) placement.at = time(placement.at, factor);
      for (const event of document.events ?? []) event.t = time(event.t, factor);
      for (const points of Object.values(document.axes)) for (const point of points ?? []) point.t = time(point.t, factor);
    },
  };
}

function impactContrast(parentId: string, id: string, title: string, factor: number): VariantPlan {
  return {
    parentId, id, title, kind: "impact_contrast", rationale: `Impact contrast is scaled by ${factor} around the neutral midpoint without changing rhythm.`,
    parameters: { contrast: factor },
    transformScore: (document) => {
      for (const phrase of Object.values(document.phrases)) for (const event of phrase) event.impact = contrast(event.impact, factor);
      for (const event of document.events ?? []) event.impact = contrast(event.impact, factor);
    },
  };
}

function placementShift(parentId: string, id: string, title: string, phrase: string, seconds: number): VariantPlan {
  return {
    parentId, id, title, kind: "phrase_microtiming", rationale: `Only ${phrase} phrase placements move by ${seconds}s; the rest of the musical grid is unchanged.`,
    parameters: { phrase, seconds },
    transformScore: (document) => {
      for (const placement of document.placements) if (placement.phrase === phrase) placement.at = time(placement.at + seconds, 1);
    },
  };
}

function axisOffset(parentId: string, id: string, title: string, axis: "air" | "speed" | "amplitude", offset: number): VariantPlan {
  return {
    parentId, id, title, kind: "axis_offset", rationale: `${axis} is shifted by ${offset} with clamping; rhythm and other authored axes remain fixed.`,
    parameters: { axis, offset },
    transformScore: (document) => {
      const points = document.axes[axis];
      if (points === undefined) throw new Error(`${document.id}: ${axis} is absent`);
      for (const point of points) point.v = clamp(point.v + offset);
    },
  };
}

function axisContrast(parentId: string, id: string, title: string, axis: "air" | "speed" | "amplitude", factor: number): VariantPlan {
  return {
    parentId, id, title, kind: "axis_contrast", rationale: `${axis} contrast is scaled by ${factor} around the midpoint; timing remains fixed.`,
    parameters: { axis, contrast: factor },
    transformScore: (document) => {
      const points = document.axes[axis];
      if (points === undefined) throw new Error(`${document.id}: ${axis} is absent`);
      for (const point of points) point.v = contrast(point.v, factor);
    },
  };
}

function rideoutDuration(seconds: 4 | 6 | 7): VariantPlan {
  const delta = seconds - 5;
  return {
    parentId: "frontier_low_air_endurance",
    id: `frontier_low_air_endurance_${seconds}s`,
    title: `Frontier Low-Air Endurance, ${seconds} Second Boundary`,
    kind: "rideout_duration",
    rationale: `A ${seconds}-second supported rideout extends the duration frontier while preserving its surrounding groove and axis progression.`,
    parameters: { rideout_seconds: seconds },
    transformScore: (document) => {
      const ride = document.phrases.ride5;
      for (const event of ride) {
        if (event.role === "breath_exit") event.offset = time(seconds + 1.10, 1);
        if (event.role === "reentry") event.offset = time(seconds + 1.65, 1);
        if (event.role === "support" && event.offset > 6) event.offset = time(seconds + 2.20, 1);
      }

      // Move the untouched suffix with the frontier boundary so the transform
      // changes one duration rather than creating a second accidental omission.
      for (const placement of document.placements) {
        if (placement.at >= 40.8) placement.at = time(placement.at + delta, 1);
      }
      document.duration = time(document.duration + delta, 1);
      for (const region of document.pulse_regions) {
        if (region.end >= 40.8) region.end = time(region.end + delta, 1);
      }
      for (const phase of document.phases ?? []) {
        if (phase.id === "rideout_5s") {
          phase.id = `rideout_${seconds}s`;
          phase.intent = `${seconds}s low-air rideout and recovery`;
        }
        if (phase.start >= 40.8) phase.start = time(phase.start + delta, 1);
        if (phase.end >= 40.8) phase.end = time(phase.end + delta, 1);
      }

      for (const points of Object.values(document.axes)) {
        for (const point of points ?? []) {
          if (point.t >= 40.8) point.t = time(point.t + delta, 1);
        }
      }
      const air = document.axes.air;
      const recovery = air?.find((point) => point.intent.includes("5s recovery"));
      if (recovery !== undefined) {
        recovery.t = time(34.15 + seconds, 1);
        recovery.intent = `${seconds}s recovery`;
      }
      const boundary = air?.find((point) => point.intent.includes("5s endurance"));
      if (boundary !== undefined) boundary.intent = `${seconds}s endurance boundary`;
      const speed = document.axes.speed;
      const rideoutSpeed = speed?.find((point) => point.intent.includes("5s rideout"));
      if (rideoutSpeed !== undefined) {
        rideoutSpeed.t = time(34.15 + 0.57 * seconds, 1);
        rideoutSpeed.intent = `${seconds}s rideout at high speed`;
      }
    },
  };
}

function sampledVariant(
  parentId: string,
  id: string,
  title: string,
  kind: string,
  rationale: string,
  parameters: Record<string, string | number | boolean>,
  transformSampled: (document: SampledCaseDocument) => void,
): VariantPlan {
  return { parentId, id, title, kind, rationale, parameters, transformSampled };
}

function variantMetadata(parent: BenchmarkCase, plan: VariantPlan): BenchmarkCaseMetadata {
  return {
    ...structuredClone(parent.metadata),
    id: plan.id,
    title: plan.title,
    variant: { parentId: plan.parentId, kind: plan.kind, rationale: plan.rationale, parameters: plan.parameters },
  };
}

function scoreModule(path: string, metadata: BenchmarkCaseMetadata, document: BenchmarkScoreDocument): string {
  return `import { defineScoreCase } from ${JSON.stringify(relativeImport(path, resolve("benchmark/v2/cases/case.ts")))};\n` +
    `import type { BenchmarkScoreDocument } from ${JSON.stringify(relativeImport(path, resolve("scripts/v0/benchmark_v2/score_model.ts")))};\n\n` +
    `export const scoreDocument = ${JSON.stringify(document, null, 2)} satisfies BenchmarkScoreDocument;\n\n` +
    `export const benchmarkCase = defineScoreCase({\n  metadata: ${JSON.stringify(metadata, null, 2)},\n  document: scoreDocument,\n});\n\nexport default benchmarkCase.spec;\n`;
}

function sampledModule(path: string, metadata: BenchmarkCaseMetadata, document: SampledCaseDocument): string {
  return `import { defineSampledCase } from ${JSON.stringify(relativeImport(path, resolve("benchmark/v2/cases/case.ts")))};\n` +
    `import type { SampledCaseDocument } from ${JSON.stringify(relativeImport(path, resolve("benchmark/v2/cases/case.ts")))};\n\n` +
    `export const sampledDocument = ${JSON.stringify(document, null, 2)} satisfies SampledCaseDocument;\n\n` +
    `export const benchmarkCase = defineSampledCase({\n  metadata: ${JSON.stringify(metadata, null, 2)},\n  document: sampledDocument,\n});\n\nexport default benchmarkCase.spec;\n`;
}

function catalogModule(entries: Array<{ id: string; path: string }>): string {
  const imports = entries.map((entry, index) => `import { benchmarkCase as case${index} } from ${JSON.stringify(`./${relative("benchmark/v2", entry.path).replaceAll("\\", "/")}`)};`).join("\n");
  const rows = entries.map((entry, index) => `  { sourcePath: ${JSON.stringify(entry.path)}, case: case${index} },`).join("\n");
  return `import type { CatalogEntry } from "./catalog.ts";\n${imports}\n\n// Generated by scripts/benchmark/materialize_variants.ts.\nexport const materializedVariantCases: CatalogEntry[] = [\n${rows}\n];\n`;
}

function transformSampledAxis(document: SampledCaseDocument, axis: string, transform: (value: number) => number): void {
  const samples = document.axes[axis as keyof typeof document.axes];
  if (samples === undefined) throw new Error(`sampled ${axis} axis is absent`);
  samples.values = samples.values.map((value) => value === null ? null : transform(value));
}

function contrast(value: number, factor: number): number {
  return clamp(0.5 + (value - 0.5) * factor);
}

function clamp(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(6));
}

function time(value: number, factor: number): number {
  return Number((value * factor).toFixed(3));
}

function relativeImport(fromFile: string, target: string): string {
  let path = relative(dirname(fromFile), target).replaceAll("\\", "/");
  if (!path.startsWith(".")) path = `./${path}`;
  return path;
}
