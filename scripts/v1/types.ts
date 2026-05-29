import type { TrackJson, TrackLine } from "../lib/primitive.ts";
import type {
  ContactReport,
  DriftReport,
  Gap,
  SectionAxes,
  SectionReport,
  Spec,
} from "../v0/types.ts";
import type { V0ContractScore } from "../v0/score.ts";

export type {
  DriftReport,
  Gap,
  SectionAxes,
  ContactReport,
  SectionReport,
  Spec,
  TrackJson,
  TrackLine,
  V0ContractScore,
};

export type Budget =
  | { kind: "work"; units: number }
  | { kind: "wall_ms"; ms: number };

export type CompileOptions = {
  seed?: number;
  budget?: Budget;
};

export type CompileStats = {
  work_units_requested: number | null;
  work_units_used: number;
  work_unit_kind: "engine_addLine";

  budget_exhausted: boolean;
  best_found_at_work_unit: number | null;
  no_contract_candidate_found: boolean;

  completed_candidates: number;
  contract_passing_candidates: number;
  archive_updates: number;
  best_rejected_candidate: {
    found_at_work_unit: number;
    score: number;
    axis_quality: number;
    hits: number;
    drift: number;
    missing: number;
    off_beat_landings: number;
    died: number;
    hard_failures: string[];
    missing_contact_frames: number[];
    drift_contact_frames: number[];
  } | null;

  candidates_sampled: number;
  engine_addLine_calls: number;
  engine_rebuilds: number;
  detector_windows: number;
  detector_frames: number;
  physics_frame_requests: number;
  physics_frame_cache_hits: number;
  physics_frames_computed: number;

  gap_commits: number;
  gap_backtracks: number;
  recovery_promotions: number;
  validation_retries: number;
  validation_retry_from_gaps: number[];
  polish_candidates: number;
  polish_iterations: number;

  total_committed_cost: number;
  committed_costs_per_gap: (number | null)[];
};

export type CompileResult = {
  track: TrackJson;
  report: DriftReport;
  stats: CompileStats;
};

export type ResolvedStart = {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
};

export type SectionWindow = {
  sectionIndex: number;
  startFrame: number;
  endFrame: number;
  axes: SectionAxes;
};

export type NormalizedGap = Gap & {
  contactFrame: number | null;
  sectionAxes: SectionAxes;
};

export type PrerollPolicy =
  | { kind: "none" }
  | { kind: "manual_start_consumes_preroll"; seconds: number }
  | { kind: "deferred_start_search"; seconds: number };

export type NormalizedSpecContext = {
  originalSpec: Spec;
  specHash: string;
  seed: number;
  durationFrames: number;
  contactFrames: number[];
  contactFrameSet: ReadonlySet<number>;
  gaps: NormalizedGap[];
  sectionWindows: SectionWindow[];
  startState: ResolvedStart;
  prerollPolicy: PrerollPolicy;
};

export type CandidateStreamName = "coverage" | "quality" | "recovery" | "polish";

export type CandidateKey = {
  specHash: string;
  seed: number;
  gapIndex: number;
  prefixHash: string;
  stream: CandidateStreamName;
  ordinal: number;
};

export type CompleteCandidate = {
  track: TrackJson;
  report: DriftReport;
  score: V0ContractScore;
  foundAtWorkUnit: number;
  candidateKey: CandidateKey;
  trackHash: string;
  rmsContactDrift: number;
  fits?: (import("./search_state.ts").GapFit | null)[];
};
