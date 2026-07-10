import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { effectiveAxes, sliceTimeline } from "../core/substrate.ts";
import {
  FPS,
  TARGET_AXES,
  secToFrame,
  type AxisName,
  type AxisValues,
  type Spec,
} from "../types.ts";
import { loadBenchmarkScore } from "./score_model.ts";

export const SOURCE_MANIFEST_SCHEMA = "line.benchmark-v2.source-inventory.v4" as const;
export const HELDOUT_MANIFEST_SCHEMA = "line.benchmark-v2.qualification-registry.v2" as const;
export const CHARACTERIZATION_SCHEMA = "line.benchmark-v2.characterization.v4" as const;

export type EvaluationComponent =
  | "sync"
  | "survival"
  | "air"
  | "speed"
  | "elevation"
  | "amplitude"
  | "impact";

export type ModuleSourceManifest = {
  id: string;
  module: string;
  score_source?: never;
  source_files: string[];
  rhythm_source?: string;
  music_backed: boolean;
  music_work_id?: string;
  reference_pulse_seconds?: number;
  eligible_components: EvaluationComponent[];
  diagnostic_components?: EvaluationComponent[];
  notes?: string;
  case_metadata?: CaseMetadataManifest;
};

export type CaseMetadataManifest = {
  title: string;
  parent_id?: string;
  variant?: {
    kind: string;
    rationale: string;
    parameters: Record<string, string | number | boolean>;
  };
  diagnostic_tags: string[];
  provenance_kind: string;
  phases: Array<{ id: string; start: number; end: number; intent: string }>;
  event_role_counts: Record<string, number>;
};

export type ScoreSourceManifest = Omit<ModuleSourceManifest, "module" | "score_source"> & {
  module?: never;
  score_source: string;
};

export type SourceManifestEntry = ModuleSourceManifest | ScoreSourceManifest;

export type DiagnosticCandidateManifest = SourceManifestEntry & {
  origin_family: string;
};

export type RegressionCandidateManifest = SourceManifestEntry & {
  origin_family: string;
};

export type DevelopmentMusicCandidateManifest = SourceManifestEntry & {
  origin_family: string;
};

export type CapabilityCandidateManifest = SourceManifestEntry & {
  origin_family: string;
};

export type RepresentativeCandidateManifest = SourceManifestEntry & {
  origin_family: string;
};

export type SourceManifest = {
  schema: typeof SOURCE_MANIFEST_SCHEMA;
  status: "canonical-development-inventory";
  description: string;
  representative_candidates: RepresentativeCandidateManifest[];
  capability_candidates: CapabilityCandidateManifest[];
  regression_candidates: RegressionCandidateManifest[];
  development_music_candidates: DevelopmentMusicCandidateManifest[];
};

export type HeldoutReferenceManifest = SourceManifestEntry;

export type HeldoutManifest = {
  schema: typeof HELDOUT_MANIFEST_SCHEMA;
  status: "qualification-monitor";
  description: string;
  references: HeldoutReferenceManifest[];
};

export type SourceRole =
  | "representative_candidate"
  | "capability_candidate"
  | "regression_candidate"
  | "development_music_candidate"
  | "qualification_reference";

export type ResolvedSource = {
  id: string;
  role: SourceRole;
  module?: string;
  scoreSource?: string;
  sourceFiles: string[];
  sourceFingerprint: string;
  originFamily: string;
  musicBacked: boolean;
  musicWorkId?: string;
  rhythmSource?: string;
  referencePulseSeconds?: number;
  eligibleComponents: EvaluationComponent[];
  diagnosticComponents: EvaluationComponent[];
  notes?: string;
  caseMetadata?: CaseMetadataManifest;
  parentId?: string;
};

export type NumericSummary = {
  count: number;
  min: number | null;
  p10: number | null;
  median: number | null;
  p90: number | null;
  max: number | null;
  mean: number | null;
  standardDeviation: number | null;
};

export type AxisTargetSummary = NumericSummary & {
  meanAbsoluteStep: number | null;
  p90AbsoluteStep: number | null;
};

export type CadenceSummary = {
  initialContactSeconds: number | null;
  rawInterContactGapsSeconds: NumericSummary;
  /** Inter-contact gaps after the compiler's 40 fps time quantization. */
  interContactGapsSeconds: NumericSummary;
  contactsPerSecond: number;
  gapCoefficientOfVariation: number | null;
  gapBinEntropyBits: number;
  exactContactHash: string;
  frameGapHash: string;
  commonFrameGaps: Array<{ frames: number; seconds: number; count: number; share: number }>;
  gapBands: Record<string, { count: number; share: number }>;
  maximumConsecutiveGaps: Record<string, number>;
  maximumConsecutiveShortGaps: number;
  pulse?: {
    seconds: number;
    ratioCounts: Record<string, number>;
    offRatioCount: number;
  };
};

export type SourceCharacterization = {
  id: string;
  parentId?: string;
  role: SourceRole;
  module?: string;
  scoreSource?: string;
  sourceFiles: string[];
  sourceFingerprint: string;
  originFamily: string;
  musicBacked: boolean;
  musicWorkId?: string;
  rhythmSource?: string;
  eligibleComponents: EvaluationComponent[];
  diagnosticComponents: EvaluationComponent[];
  notes?: string;
  durationSeconds: number;
  durationFrames: number;
  contactCount: number;
  activeTargetAxes: AxisName[];
  inertAuthoredAxes: AxisName[];
  cadence: CadenceSummary;
  targets: Partial<Record<AxisName, AxisTargetSummary>>;
  gapTargetCorrelations: Partial<Record<AxisName, number | null>>;
  contactTimesSeconds: number[];
  rawInterContactGapsSeconds: number[];
  impacts: Array<number | null>;
  targetSeries: Partial<Record<AxisName, Array<number | null>>>;
  scoreMetadata?: {
    primaryFamily: string;
    diagnosticTags: string[];
    eventRoleCounts: Record<string, number>;
    provenanceKind: string;
    phases: Array<{ id: string; start: number; end: number; intent: string }>;
  };
};

export type DuplicateGroup = {
  hash: string;
  members: string[];
};

export type CharacterizationReport = {
  schema: typeof CHARACTERIZATION_SCHEMA;
  sourceManifest: string;
  manifestFingerprint: string;
  heldoutManifest?: string;
  heldoutManifestFingerprint?: string;
  dataFingerprint: string;
  sources: SourceCharacterization[];
  exactContactDuplicates: DuplicateGroup[];
  frameGapDuplicates: DuplicateGroup[];
};

const GAP_BANDS = [
  { label: "lt_250ms", test: (seconds: number) => seconds < 0.25 },
  { label: "250_350ms", test: (seconds: number) => seconds >= 0.25 && seconds < 0.35 },
  { label: "350_500ms", test: (seconds: number) => seconds >= 0.35 && seconds < 0.5 },
  { label: "500_850ms", test: (seconds: number) => seconds >= 0.5 && seconds < 0.85 },
  { label: "850_1500ms", test: (seconds: number) => seconds >= 0.85 && seconds < 1.5 },
  { label: "1500_2000ms", test: (seconds: number) => seconds >= 1.5 && seconds < 2 },
  { label: "2_3s", test: (seconds: number) => seconds >= 2 && seconds < 3 },
  { label: "3_5s", test: (seconds: number) => seconds >= 3 && seconds < 5 },
  { label: "gte_5s", test: (seconds: number) => seconds >= 5 },
] as const;

const PULSE_RATIOS = [
  { label: "quarter", value: 0.25 },
  { label: "third", value: 1 / 3 },
  { label: "half", value: 0.5 },
  { label: "two_thirds", value: 2 / 3 },
  { label: "three_quarters", value: 0.75 },
  { label: "primary", value: 1 },
  { label: "one_and_half", value: 1.5 },
  { label: "double", value: 2 },
  { label: "triple", value: 3 },
  { label: "quadruple", value: 4 },
] as const;

export function loadSourceManifest(path: string): SourceManifest {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<SourceManifest>;
  if (parsed.schema !== SOURCE_MANIFEST_SCHEMA) {
    throw new Error(`unsupported Benchmark V2 source manifest schema: ${String(parsed.schema)}`);
  }
  if ("legacy_candidates" in parsed) {
    throw new Error(`Benchmark V1 candidates must remain outside the V2 source manifest`);
  }
  if (parsed.status !== "canonical-development-inventory") {
    throw new Error(`source manifest must define the canonical development inventory`);
  }
  if (
    !Array.isArray(parsed.representative_candidates) ||
    !Array.isArray(parsed.capability_candidates) ||
    !Array.isArray(parsed.regression_candidates) ||
    !Array.isArray(parsed.development_music_candidates)
  ) {
    throw new Error(`source manifest must contain all source-role arrays`);
  }
  const ids = [
    ...parsed.representative_candidates.map((entry) => entry.id),
    ...parsed.capability_candidates.map((entry) => entry.id),
    ...parsed.regression_candidates.map((entry) => entry.id),
    ...parsed.development_music_candidates.map((entry) => entry.id),
  ];
  if (new Set(ids).size !== ids.length) throw new Error(`source manifest ids must be unique`);
  validateManifestEntries([
    ...parsed.representative_candidates,
    ...parsed.capability_candidates,
    ...parsed.regression_candidates,
    ...parsed.development_music_candidates,
  ], "source manifest");
  return parsed as SourceManifest;
}

export function loadHeldoutManifest(path: string): HeldoutManifest {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<HeldoutManifest>;
  if (parsed.schema !== HELDOUT_MANIFEST_SCHEMA) {
    throw new Error(`unsupported heldout manifest schema: ${String(parsed.schema)}`);
  }
  if (parsed.status !== "qualification-monitor" || !Array.isArray(parsed.references)) {
    throw new Error(`qualification manifest must contain qualification-monitor references`);
  }
  if (new Set(parsed.references.map((entry) => entry.id)).size !== parsed.references.length) {
    throw new Error(`heldout reference ids must be unique`);
  }
  validateManifestEntries(parsed.references, "heldout manifest");
  return parsed as HeldoutManifest;
}

export function resolveSources(manifest: SourceManifest): ResolvedSource[] {
  return [
    ...manifest.representative_candidates.map((entry) => resolveEntry(entry, "representative_candidate", entry.origin_family)),
    ...manifest.capability_candidates.map((entry) => resolveEntry(entry, "capability_candidate", entry.origin_family)),
    ...manifest.regression_candidates.map((entry) => resolveEntry(entry, "regression_candidate", entry.origin_family)),
    ...manifest.development_music_candidates.map((entry) =>
      resolveEntry(entry, "development_music_candidate", entry.origin_family)
    ),
  ];
}

export function resolveHeldoutSources(manifest: HeldoutManifest): ResolvedSource[] {
  return manifest.references.map((entry) => resolveEntry(entry, "qualification_reference", "qualification"));
}

export function assertNoHeldoutIdentity(
  development: ResolvedSource[],
  heldout: ResolvedSource[],
): void {
  const ids = new Set(heldout.map((source) => source.id));
  const modules = new Set(heldout.flatMap((source) => source.module ? [resolve(source.module)] : []));
  const fingerprints = new Set(heldout.map((source) => source.sourceFingerprint));
  for (const source of development) {
    if (ids.has(source.id)) throw new Error(`${source.id}: reserved heldout id`);
    if (source.module !== undefined && modules.has(resolve(source.module))) {
      throw new Error(`${source.id}: reserved heldout module`);
    }
    if (source.module !== undefined) {
      const closure = localImportClosure(resolve(source.module));
      const importedQualification = [...modules].find((module) => closure.has(module));
      if (importedQualification !== undefined) {
        throw new Error(`${source.id}: transitively imports reserved heldout module ${importedQualification}`);
      }
    }
    if (fingerprints.has(source.sourceFingerprint)) {
      throw new Error(`${source.id}: reserved heldout source fingerprint`);
    }
  }
}

function localImportClosure(entry: string): Set<string> {
  const visited = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const path = pending.pop()!;
    if (visited.has(path) || !existsSync(path) || ![".ts", ".tsx", ".js", ".mjs"].includes(extname(path))) continue;
    visited.add(path);
    const contents = readFileSync(path, "utf8");
    const imports = [...contents.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)]
      .map((match) => match[1])
      .filter((specifier) => specifier.startsWith("."));
    for (const specifier of imports) {
      const base = resolve(dirname(path), specifier);
      const candidates = extname(base) === ""
        ? [`${base}.ts`, `${base}.tsx`, `${base}.js`, resolve(base, "index.ts")]
        : [base];
      const imported = candidates.find(existsSync);
      if (imported !== undefined && !visited.has(imported)) pending.push(imported);
    }
  }
  return visited;
}

export async function loadSpecModule(modulePath: string): Promise<Spec> {
  const absolute = resolve(modulePath);
  const imported = await import(pathToFileURL(absolute).href);
  if (imported.default === undefined) throw new Error(`${modulePath} has no default spec export`);
  return imported.default as Spec;
}

export async function loadSourceSpec(source: ResolvedSource): Promise<Spec> {
  if (source.scoreSource !== undefined) {
    const loaded = loadBenchmarkScore(source.scoreSource);
    if (loaded.document.id !== source.id) {
      throw new Error(`${source.id}: score document id is ${loaded.document.id}`);
    }
    return loaded.spec;
  }
  if (source.module === undefined) throw new Error(`${source.id}: no module or score source`);
  return loadSpecModule(source.module);
}

function resolveEntry(
  entry: SourceManifestEntry,
  role: SourceRole,
  originFamily: string,
): ResolvedSource {
  return {
    id: entry.id,
    role,
    ...(entry.module === undefined ? {} : { module: entry.module }),
    ...(entry.score_source === undefined ? {} : { scoreSource: entry.score_source }),
    sourceFiles: [...entry.source_files],
    sourceFingerprint: fingerprintFiles(entry.source_files),
    originFamily,
    musicBacked: entry.music_backed,
    musicWorkId: entry.music_work_id ?? (entry.music_backed ? entry.id : undefined),
    rhythmSource: entry.rhythm_source,
    referencePulseSeconds: entry.reference_pulse_seconds,
    eligibleComponents: [...entry.eligible_components],
    diagnosticComponents: [...(entry.diagnostic_components ?? [])],
    notes: entry.notes,
    caseMetadata: entry.case_metadata,
    parentId: entry.case_metadata?.parent_id,
  };
}

function validateManifestEntries(entries: SourceManifestEntry[], label: string): void {
  for (const entry of entries) {
    const primary = entry.module ?? entry.score_source;
    if (!entry.id || primary === undefined || (entry.module !== undefined && entry.score_source !== undefined)) {
      throw new Error(`${label}: ${entry.id || "<missing>"} needs exactly one module or score_source`);
    }
    if (!Array.isArray(entry.source_files) || entry.source_files.length === 0 || !entry.source_files.includes(primary)) {
      throw new Error(`${label}: ${entry.id} source_files must include its primary source`);
    }
    if (new Set(entry.source_files).size !== entry.source_files.length) {
      throw new Error(`${label}: ${entry.id} source_files must be unique`);
    }
    if (primary.startsWith("specs/golden/")) {
      throw new Error(`Benchmark V1 specs/golden modules must remain outside V2`);
    }
  }
}

export function fingerprintFiles(paths: string[]): string {
  const hash = createHash("sha256");
  for (const path of [...paths].sort()) {
    hash.update(`${path.length}:${path}\0`);
    hash.update(readFileSync(resolve(path)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function characterizeSpec(source: ResolvedSource, spec: Spec): SourceCharacterization {
  const durationFrames = secToFrame(spec.duration);
  const contacts = spec.contacts
    .map((contact) => ({ ...contact, frame: secToFrame(contact.t) }))
    .sort((a, b) => a.frame - b.frame);
  const contactFrames = contacts.map((contact) => contact.frame);
  const interGapFrames = contactFrames.slice(1).map((frame, index) => frame - contactFrames[index]);
  const interGapSeconds = interGapFrames.map((frames) => frames / FPS);
  const gaps = sliceTimeline(contactFrames, durationFrames).filter((gap) => gap.endsWithContact);
  const targetRows = gaps.map((gap) => effectiveAxes(gap, spec));
  const rawInterContactGapsSeconds = contacts.slice(1).map(
    (contact, index) => round(contact.t - contacts[index].t),
  );
  const targetValues = new Map<AxisName, number[]>();
  for (const axis of TARGET_AXES) {
    const values = targetRows.flatMap((row) => row[axis] === undefined ? [] : [row[axis]!]);
    if (values.length > 0) targetValues.set(axis, values);
  }
  const impactedContacts = contacts.filter((contact) => contact.impact !== undefined);
  const impacts = impactedContacts.map((contact) => contact.impact!);
  if (impacts.length > 0) targetValues.set("impact", impacts);

  const activeTargetAxes = [...targetValues.keys()];
  const authoredAxes = Object.keys(spec.axes ?? {}) as AxisName[];
  const inertAuthoredAxes = authoredAxes.filter((axis) => !activeTargetAxes.includes(axis));
  const targets: Partial<Record<AxisName, AxisTargetSummary>> = {};
  const gapTargetCorrelations: Partial<Record<AxisName, number | null>> = {};
  const targetSeries: Partial<Record<AxisName, Array<number | null>>> = {};
  for (const [axis, values] of targetValues) {
    targets[axis] = targetSummary(values);
    const alignedGaps = axis === "impact"
      ? contacts.flatMap((contact, index) => contact.impact === undefined
        ? []
        : [(contact.frame - (contactFrames[index - 1] ?? 0)) / FPS])
      : gaps.flatMap((gap, index) => targetRows[index][axis] === undefined
        ? []
        : [(gap.endFrame - gap.startFrame) / FPS]);
    gapTargetCorrelations[axis] = correlation(alignedGaps, values);
    targetSeries[axis] = axis === "impact"
      ? contacts.map((contact) => contact.impact ?? null)
      : targetRows.map((row) => row[axis] ?? null);
  }

  const score = source.scoreSource === undefined ? undefined : loadBenchmarkScore(source.scoreSource);
  const eventRoleCounts = score === undefined
    ? undefined
    : Object.fromEntries([...new Set(score.events.map((event) => event.role))].sort().map((role) => [
      role,
      score.events.filter((event) => event.role === role).length,
    ]));

  return {
    id: source.id,
    ...(source.parentId === undefined ? {} : { parentId: source.parentId }),
    role: source.role,
    ...(source.module === undefined ? {} : { module: source.module }),
    ...(source.scoreSource === undefined ? {} : { scoreSource: source.scoreSource }),
    sourceFiles: [...source.sourceFiles],
    sourceFingerprint: source.sourceFingerprint,
    originFamily: source.originFamily,
    musicBacked: source.musicBacked,
    musicWorkId: source.musicWorkId,
    rhythmSource: source.rhythmSource,
    eligibleComponents: source.eligibleComponents,
    diagnosticComponents: source.diagnosticComponents,
    notes: source.notes,
    durationSeconds: round(spec.duration),
    durationFrames,
    contactCount: contacts.length,
    activeTargetAxes,
    inertAuthoredAxes,
    cadence: cadenceSummary(
      contacts.map((contact) => contact.t),
      contactFrames,
      spec.duration,
      source.referencePulseSeconds,
    ),
    targets,
    gapTargetCorrelations,
    contactTimesSeconds: contacts.map((contact) => round(contact.t)),
    rawInterContactGapsSeconds,
    impacts: contacts.map((contact) => contact.impact ?? null),
    targetSeries,
    ...(score === undefined && source.caseMetadata === undefined ? {} : {
      scoreMetadata: {
        primaryFamily: source.originFamily,
        diagnosticTags: source.caseMetadata?.diagnostic_tags ?? [...score!.document.diagnostic_tags],
        eventRoleCounts: source.caseMetadata?.event_role_counts ?? eventRoleCounts!,
        provenanceKind: source.caseMetadata?.provenance_kind ?? score!.document.provenance.kind,
        phases: (source.caseMetadata?.phases ?? score!.document.phases ?? []).map((phase) => ({ ...phase })),
      },
    }),
  };
}

export function buildCharacterizationReport(
  manifestPath: string,
  manifestContents: string,
  sources: SourceCharacterization[],
  heldout?: { path: string; contents: string },
): CharacterizationReport {
  const ordered = [...sources].sort((a, b) => roleOrder(a.role) - roleOrder(b.role) || a.id.localeCompare(b.id));
  const reportWithoutFingerprint = {
    schema: CHARACTERIZATION_SCHEMA,
    sourceManifest: manifestPath,
    manifestFingerprint: sha256(manifestContents),
    ...(heldout === undefined ? {} : {
      heldoutManifest: heldout.path,
      heldoutManifestFingerprint: sha256(heldout.contents),
    }),
    sources: ordered,
    exactContactDuplicates: duplicateGroups(ordered, (source) => source.cadence.exactContactHash),
    frameGapDuplicates: duplicateGroups(ordered, (source) => source.cadence.frameGapHash),
  };
  return {
    ...reportWithoutFingerprint,
    dataFingerprint: sha256(JSON.stringify(reportWithoutFingerprint)),
  };
}

export function characterizationDataFingerprint(report: CharacterizationReport): string {
  const { dataFingerprint: _stored, ...contents } = report;
  return sha256(JSON.stringify(contents));
}

export function renderCharacterizationMarkdown(report: CharacterizationReport): string {
  const representative = report.sources.filter((source) => source.role === "representative_candidate");
  const capability = report.sources.filter((source) => source.role === "capability_candidate");
  const regression = report.sources.filter((source) => source.role === "regression_candidate");
  const developmentMusic = report.sources.filter((source) => source.role === "development_music_candidate");
  const qualification = report.sources.filter((source) => source.role === "qualification_reference");
  const lines: string[] = [
    "# Benchmark V2 Static Characterization",
    "",
    `Data fingerprint: \`${report.dataFingerprint.slice(0, 16)}\`.`,
    "",
    "This report inspects source only. It contains no compiler run or heldout outcome.",
    "",
    "## Inventory",
    "",
    `- Representative candidates: ${representative.length}.`,
    `- Capability candidates: ${capability.length}.`,
    `- Legacy-derived regression candidates: ${regression.length}.`,
    `- Development-music candidates: ${developmentMusic.length}.`,
    `- Qualification references: ${qualification.length}.`,
    `- Exact duplicate contact skeleton groups: ${report.exactContactDuplicates.length}.`,
    "",
    "## Representative candidates",
    "",
    "Each score is manually phrase-authored. Distinct hashes establish only timeline identity; the separate audit checks near-copy and target-program similarity.",
    "",
    "| Source | Family | Duration | Contacts | Raw min / median / p90 / max | <350ms (max run) | >=1.5s | Targets |",
    "|---|---|---:|---:|---:|---:|---:|---|",
  ];
  for (const source of representative) {
    const gaps = source.cadence.rawInterContactGapsSeconds;
    lines.push(
      `| ${source.id} | ${source.originFamily} | ${fmt(source.durationSeconds, 1)}s | ${source.contactCount} | ` +
      `${fmtMs(gaps.min)} / ${fmtMs(gaps.median)} / ${fmtMs(gaps.p90)} / ${fmtMs(gaps.max)} | ` +
      `${shortGapCount(source)} (${shortGapMaximumRun(source)}) | ${longGapCount(source)} | ` +
      `${source.activeTargetAxes.join(", ")} |`,
    );
  }
  lines.push(
    "",
    "## Development-music candidates",
    "",
    "Believer variants remain one correlated work and share one fixed allocation in the canonical headline.",
    "",
    "| Source | Family | Duration | Contacts | Raw min / median / max | Targets |",
    "|---|---|---:|---:|---:|---|",
  );
  for (const source of developmentMusic) {
    const gaps = source.cadence.rawInterContactGapsSeconds;
    lines.push(
      `| ${source.id} | ${source.originFamily} | ${fmt(source.durationSeconds, 1)}s | ${source.contactCount} | ` +
      `${fmtMs(gaps.min)} / ${fmtMs(gaps.median)} / ${fmtMs(gaps.max)} | ${source.activeTargetAxes.join(", ")} |`,
    );
  }
  lines.push(
    "",
    "## Capability candidates",
    "",
    "Capability cases are long-form frontier scores and contribute through a fixed canonical stratum.",
    "",
    "| Source | Family | Duration | Contacts | Raw min / median / max | <250ms | >=2s | Targets |",
    "|---|---|---:|---:|---:|---:|---:|---|",
  );
  for (const source of capability) {
    const gaps = source.cadence.rawInterContactGapsSeconds;
    lines.push(
      `| ${source.id} | ${source.originFamily} | ${fmt(source.durationSeconds, 1)}s | ${source.contactCount} | ` +
      `${fmtMs(gaps.min)} / ${fmtMs(gaps.median)} / ${fmtMs(gaps.max)} | ${bandCount(source, "lt_250ms")} | ` +
      `${bandCount(source, "2_3s") + bandCount(source, "3_5s") + bandCount(source, "gte_5s")} | ` +
      `${source.activeTargetAxes.join(", ")} |`,
    );
  }
  lines.push(
    "",
    "## Legacy-derived regression candidates",
    "",
    "These scores preserve useful historical failure modes without importing raw V1 membership.",
    "",
    "| Source | Family | Duration | Contacts | Raw min / median / max | Targets |",
    "|---|---|---:|---:|---:|---|",
  );
  for (const source of regression) {
    const gaps = source.cadence.rawInterContactGapsSeconds;
    lines.push(
      `| ${source.id} | ${source.originFamily} | ${fmt(source.durationSeconds, 1)}s | ${source.contactCount} | ` +
      `${fmtMs(gaps.min)} / ${fmtMs(gaps.median)} / ${fmtMs(gaps.max)} | ${source.activeTargetAxes.join(", ")} |`,
    );
  }
  lines.push(
    "",
    "## Qualification references",
    "",
    "Static information supports design and leakage analysis. Compiler outcomes remain outside ordinary development.",
    "",
    "| Source | Duration | Contacts | Raw p10 / median / p90 | <350ms | >=1.5s | Eligible components |",
    "|---|---:|---:|---:|---:|---:|---|",
  );
  for (const source of qualification) {
    const gaps = source.cadence.rawInterContactGapsSeconds;
    lines.push(
      `| ${source.id} | ${fmt(source.durationSeconds, 1)}s | ${source.contactCount} | ` +
      `${fmtMs(gaps.p10)} / ${fmtMs(gaps.median)} / ${fmtMs(gaps.p90)} | ${shortGapCount(source)} | ` +
      `${longGapCount(source)} | ${source.eligibleComponents.join(", ")} |`,
    );
  }
  lines.push(
    "",
    "AMOUR air and speed remain diagnostic because its source labels them as placeholders.",
  );
  return `${lines.join("\n")}\n`;
}

function cadenceSummary(
  contactSeconds: number[],
  contactFrames: number[],
  durationSeconds: number,
  referencePulseSeconds?: number,
): CadenceSummary {
  const rawInterGapSeconds = contactSeconds.slice(1).map(
    (seconds, index) => seconds - contactSeconds[index],
  );
  const interGapFrames = contactFrames.slice(1).map((frame, index) => frame - contactFrames[index]);
  const interGapSeconds = interGapFrames.map((frames) => frames / FPS);
  const frameCounts = countsOf(interGapFrames);
  const commonFrameGaps = [...frameCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 8)
    .map(([frames, count]) => ({
      frames,
      seconds: round(frames / FPS),
      count,
      share: ratio(count, interGapFrames.length),
    }));
  const gapBands = Object.fromEntries(GAP_BANDS.map((band) => {
    const count = interGapSeconds.filter(band.test).length;
    return [band.label, { count, share: ratio(count, interGapSeconds.length) }];
  }));
  const maximumConsecutiveGaps = Object.fromEntries(GAP_BANDS.map((band) => [
    band.label,
    longestRun(interGapSeconds.map(band.test)),
  ]));
  return {
    initialContactSeconds: contactFrames.length > 0 ? round(contactFrames[0] / FPS) : null,
    rawInterContactGapsSeconds: numericSummary(rawInterGapSeconds),
    interContactGapsSeconds: numericSummary(interGapSeconds),
    contactsPerSecond: round(contactFrames.length / Math.max(durationSeconds, 1e-9)),
    gapCoefficientOfVariation: coefficientOfVariation(interGapSeconds),
    gapBinEntropyBits: round(entropyBits([...frameCounts.values()])),
    exactContactHash: sha256(contactSeconds.map((seconds) => seconds.toFixed(6)).join(",")),
    frameGapHash: sha256(interGapFrames.join(",")),
    commonFrameGaps,
    gapBands,
    maximumConsecutiveGaps,
    maximumConsecutiveShortGaps: longestRun(interGapSeconds.map((seconds) => seconds < 0.35)),
    ...(referencePulseSeconds === undefined
      ? {}
      : { pulse: pulseSummary(rawInterGapSeconds, referencePulseSeconds) }),
  };
}

function pulseSummary(gaps: number[], pulseSeconds: number): NonNullable<CadenceSummary["pulse"]> {
  const ratioCounts: Record<string, number> = Object.fromEntries(PULSE_RATIOS.map((ratio) => [ratio.label, 0]));
  let offRatioCount = 0;
  for (const gap of gaps) {
    const observed = gap / pulseSeconds;
    const nearest = PULSE_RATIOS.reduce((best, candidate) =>
      Math.abs(candidate.value - observed) < Math.abs(best.value - observed) ? candidate : best
    );
    const relativeError = Math.abs(nearest.value - observed) / nearest.value;
    if (relativeError <= 0.12) ratioCounts[nearest.label]++;
    else offRatioCount++;
  }
  return { seconds: pulseSeconds, ratioCounts, offRatioCount };
}

function targetSummary(values: number[]): AxisTargetSummary {
  const steps = values.slice(1).map((value, index) => Math.abs(value - values[index]));
  return {
    ...numericSummary(values),
    meanAbsoluteStep: steps.length > 0 ? round(mean(steps)) : null,
    p90AbsoluteStep: steps.length > 0 ? round(quantile(steps, 0.9)) : null,
  };
}

export function numericSummary(values: number[]): NumericSummary {
  if (values.length === 0) {
    return { count: 0, min: null, p10: null, median: null, p90: null, max: null, mean: null, standardDeviation: null };
  }
  return {
    count: values.length,
    min: round(Math.min(...values)),
    p10: round(quantile(values, 0.1)),
    median: round(quantile(values, 0.5)),
    p90: round(quantile(values, 0.9)),
    max: round(Math.max(...values)),
    mean: round(mean(values)),
    standardDeviation: round(standardDeviation(values)),
  };
}

export function quantile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * Math.max(0, Math.min(1, p));
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low];
  const fraction = index - low;
  return sorted[low] * (1 - fraction) + sorted[high] * fraction;
}

function duplicateGroups(
  sources: SourceCharacterization[],
  keyOf: (source: SourceCharacterization) => string,
): DuplicateGroup[] {
  const groups = new Map<string, string[]>();
  for (const source of sources) groups.set(keyOf(source), [...(groups.get(keyOf(source)) ?? []), source.id]);
  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([hash, members]) => ({ hash, members: [...members].sort() }))
    .sort((a, b) => b.members.length - a.members.length || a.hash.localeCompare(b.hash));
}

function countsOf(values: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function longestRun(matches: boolean[]): number {
  let best = 0;
  let current = 0;
  for (const match of matches) {
    current = match ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

function coefficientOfVariation(values: number[]): number | null {
  if (values.length === 0) return null;
  const average = mean(values);
  return average === 0 ? null : round(standardDeviation(values) / average);
}

function entropyBits(counts: number[]): number {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;
  return -counts.reduce((sum, count) => {
    const p = count / total;
    return sum + p * Math.log2(p);
  }, 0);
}

function correlation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let numerator = 0;
  let x2 = 0;
  let y2 = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    numerator += dx * dy;
    x2 += dx * dx;
    y2 += dy * dy;
  }
  if (x2 <= 1e-18 || y2 <= 1e-18) return null;
  return round(numerator / Math.sqrt(x2 * y2));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function round(value: number, digits = 4): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function roleOrder(role: SourceRole): number {
  if (role === "representative_candidate") return 0;
  if (role === "capability_candidate") return 1;
  if (role === "regression_candidate") return 2;
  if (role === "development_music_candidate") return 3;
  return 4;
}

function fmt(value: number | null, digits: number): string {
  return value === null || !Number.isFinite(value) ? "-" : value.toFixed(digits);
}

function fmtMs(seconds: number | null): string {
  return seconds === null || !Number.isFinite(seconds) ? "-" : `${Math.round(seconds * 1000)}ms`;
}

function bandCount(source: SourceCharacterization, label: string): number {
  return source.cadence.gapBands[label]?.count ?? 0;
}

function longGapCount(source: SourceCharacterization): number {
  return bandCount(source, "1500_2000ms") + bandCount(source, "2_3s") +
    bandCount(source, "3_5s") + bandCount(source, "gte_5s");
}

function shortGapCount(source: SourceCharacterization): number {
  return bandCount(source, "lt_250ms") + bandCount(source, "250_350ms");
}

function shortGapMaximumRun(source: SourceCharacterization): number {
  return source.cadence.maximumConsecutiveShortGaps;
}

function formatPulseCounts(counts: Record<string, number>): string {
  return PULSE_RATIOS
    .map((ratio) => [ratio.label, counts[ratio.label] ?? 0] as const)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label.replaceAll("_", " ")} ${count}`)
    .join(", ") || "-";
}
