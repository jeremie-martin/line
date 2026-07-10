import { FPS, type AxisName, type AxisValues, type Contact, type Spec, type StartState } from "../../../scripts/v0/types.ts";
import {
  buildBenchmarkScore,
  type BenchmarkScoreDocument,
} from "../../../scripts/v0/benchmark_v2/score_model.ts";

export const BENCHMARK_CASE_SCHEMA = "line.benchmark-v2.case.v1" as const;

export type CaseComponent =
  | "sync"
  | "survival"
  | "air"
  | "speed"
  | "elevation"
  | "amplitude"
  | "impact";

export type CaseCohort =
  | "representative"
  | "capability"
  | "regression"
  | "development_music"
  | "qualification";

export type CasePhase = {
  id: string;
  start: number;
  end: number;
  intent: string;
};

export type CaseVariant = {
  parentId: string;
  kind: string;
  rationale: string;
  parameters: Record<string, string | number | boolean>;
};

export type BenchmarkCaseMetadata = {
  id: string;
  title: string;
  cohort: CaseCohort;
  originFamily: string;
  musicBacked: boolean;
  musicWorkId?: string;
  referencePulseSeconds?: number;
  eligibleComponents: CaseComponent[];
  diagnosticComponents?: CaseComponent[];
  phases: CasePhase[];
  notes?: string;
  variant?: CaseVariant;
};

export type BenchmarkCase = {
  schema: typeof BENCHMARK_CASE_SCHEMA;
  metadata: BenchmarkCaseMetadata;
  spec: Spec;
  scoreDocument?: BenchmarkScoreDocument;
  directDocument?: SampledCaseDocument;
};

export type SampledAxis = {
  fps: number;
  values: ReadonlyArray<number | null>;
};

export type SampledCaseDocument = {
  duration: number;
  contacts: readonly Contact[];
  axes: Partial<Record<AxisName, SampledAxis>>;
  jitter: 0;
  preroll?: number;
  start?: Readonly<StartState>;
};

export function defineScoreCase(input: {
  metadata: Omit<BenchmarkCaseMetadata, "id" | "title" | "originFamily" | "phases"> &
    Partial<Pick<BenchmarkCaseMetadata, "id" | "title" | "originFamily" | "phases">>;
  document: BenchmarkScoreDocument;
}): BenchmarkCase {
  const loaded = buildBenchmarkScore(input.document, input.document.id);
  const metadata: BenchmarkCaseMetadata = {
    ...input.metadata,
    id: input.document.id,
    title: input.document.title,
    originFamily: input.document.primary_family,
    phases: input.metadata.phases ?? input.document.phases ?? [],
  };
  validateMetadata(metadata, loaded.spec.duration);
  return {
    schema: BENCHMARK_CASE_SCHEMA,
    metadata,
    spec: loaded.spec,
    scoreDocument: input.document,
  };
}

export function defineSampledCase(input: {
  metadata: BenchmarkCaseMetadata;
  document: SampledCaseDocument;
}): BenchmarkCase {
  validateMetadata(input.metadata, input.document.duration);
  const axes: Spec["axes"] = {};
  for (const [name, samples] of Object.entries(input.document.axes) as Array<[AxisName, SampledAxis]>) {
    axes[name] = sampledCurve(samples);
  }
  return {
    schema: BENCHMARK_CASE_SCHEMA,
    metadata: input.metadata,
    spec: {
      duration: input.document.duration,
      contacts: input.document.contacts.map((contact) => ({ ...contact })),
      axes,
      jitter: 0,
      ...(input.document.preroll === undefined ? {} : { preroll: input.document.preroll }),
      ...(input.document.start === undefined ? {} : { start: { ...input.document.start } }),
    },
    directDocument: input.document,
  };
}

export function defineSpecCase(input: {
  metadata: BenchmarkCaseMetadata;
  spec: Spec;
}): BenchmarkCase {
  validateMetadata(input.metadata, input.spec.duration);
  return {
    schema: BENCHMARK_CASE_SCHEMA,
    metadata: input.metadata,
    spec: input.spec,
  };
}

export function cloneScoreDocument(document: BenchmarkScoreDocument): BenchmarkScoreDocument {
  return structuredClone(document);
}

function sampledCurve(samples: SampledAxis): (t: number) => number | undefined {
  if (samples.fps !== FPS || samples.values.length === 0) {
    throw new Error(`sampled case axis must use FPS=${FPS} and contain values`);
  }
  return (t: number): number | undefined => {
    const position = Math.max(0, Math.min(samples.values.length - 1, t * samples.fps));
    const nearest = Math.round(position);
    if (Math.abs(position - nearest) < 1e-9) return samples.values[nearest] ?? undefined;
    const lo = Math.floor(position);
    const hi = Math.ceil(position);
    const a = samples.values[lo];
    const b = samples.values[hi];
    if (a === null || b === null) return undefined;
    return a + (b - a) * (position - lo);
  };
}

function validateMetadata(metadata: BenchmarkCaseMetadata, duration: number): void {
  if (!/^[a-z0-9_]+$/.test(metadata.id) || !metadata.title || !metadata.originFamily) {
    throw new Error(`invalid benchmark case identity ${metadata.id}`);
  }
  if (!metadata.eligibleComponents.includes("sync") || !metadata.eligibleComponents.includes("survival")) {
    throw new Error(`${metadata.id}: sync and survival must be eligible`);
  }
  const eligible = new Set(metadata.eligibleComponents);
  for (const component of metadata.diagnosticComponents ?? []) {
    if (eligible.has(component)) throw new Error(`${metadata.id}: ${component} is scored and diagnostic`);
  }
  let previousEnd = 0;
  const phaseIds = new Set<string>();
  for (const phase of metadata.phases) {
    if (
      !/^[a-z0-9_]+$/.test(phase.id) || phaseIds.has(phase.id) ||
      phase.start < previousEnd || phase.end <= phase.start || phase.end > duration || !phase.intent
    ) {
      throw new Error(`${metadata.id}: invalid phase ${phase.id}`);
    }
    phaseIds.add(phase.id);
    previousEnd = phase.end;
  }
}

export function caseAxisValuesAtContacts(caseDefinition: BenchmarkCase): AxisValues[] {
  return caseDefinition.spec.contacts.map((contact) => {
    const out: AxisValues = {};
    for (const [name, curve] of Object.entries(caseDefinition.spec.axes) as Array<[AxisName, Spec["axes"][AxisName]]>) {
      const value = curve?.(contact.t);
      if (value !== undefined) out[name] = value;
    }
    return out;
  });
}
