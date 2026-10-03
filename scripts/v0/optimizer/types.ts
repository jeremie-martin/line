/** The compiler's public output types. */
import type {TrackJson} from '../../lib/primitive.ts';
import type {CompileStats, DriftReport, Spec} from '../types.ts';

export type {CompileStats, DriftReport, Spec};

/** Where the physics allowance went: one entry per compile stage. */
export type CompileWork = {
  schema: 'line.compile-work.v1';
  allowance: number;
  physicalFrames: number;
  exhausted: boolean;
  stages: Array<{stage: string; allowance: number; physicalFrames: number; complete: boolean}>;
};

/** One compile: the track, its drift report, counters and work. */
export type CompileCheckpoint = {
  budget: number;
  track: TrackJson;
  report: DriftReport;
  stats: CompileStats;
  work: CompileWork;
};
