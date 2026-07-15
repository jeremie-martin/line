/**
 * Neutral compiler-facing materialization for a declared trajectory capture.
 *
 * This deliberately knows nothing about Benchmark V2 panels or the
 * long-carrier cohort. It is shared by both capture entrypoints so the
 * physical input construction is identical without making a validation study
 * import the broad legacy registry.
 */
import { makeRng } from "../../lib/rng.ts";
import { applyJolt } from "../../produce/seed.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline } from "../core/substrate.ts";
import { CALIB, secToFrame, type AxisValues, type Gap, type Spec } from "../types.ts";

export type TrajectoryCaptureCategory = "dense" | "ordinary" | "pickup" | "low_air";
export type TrajectoryCaptureCohort = "calibration" | "validation" | "quarantined";

export type TrajectoryCaptureCase = {
  id: string;
  cohort: TrajectoryCaptureCohort;
  category: TrajectoryCaptureCategory;
  spec: Spec;
  sourcePath: string;
  seed: number;
  targetGap: number;
  selectionRationale: string;
  expectedOutgoingFrames?: number;
  studyScope?: string;
};

export type TrajectoryCaptureTransform = {
  kind: string;
  joltMs: number;
};

export type TrajectoryCaptureSetup = {
  panel: TrajectoryCaptureCase;
  spec: Spec;
  gaps: Gap[];
  gapAxisTargets: AxisValues[];
  allContactFrames: number[];
  durationFrames: number;
};

export type MaterializedTrajectoryCaptureInput = {
  contactFrames: number[];
  durationFrames: number;
  gaps: Array<{
    index: number;
    startFrame: number;
    endFrame: number;
    endsWithContact: boolean;
    targets: AxisValues;
    nextImpact: number | null;
  }>;
  gapAxisTargets: AxisValues[];
};

/** Materialize exactly the compiler-facing input for one declared capture. */
export function buildTrajectoryCaptureSetup(
  panel: TrajectoryCaptureCase,
  transform: TrajectoryCaptureTransform,
): TrajectoryCaptureSetup {
  const jolted = applyJolt(panel.spec, transform.joltMs);
  const feasibleContacts = jolted.contacts.filter((contact) => secToFrame(contact.t) >= 5);
  const spec: Spec = { ...jolted, preroll: undefined, contacts: feasibleContacts };
  const durationFrames = secToFrame(spec.duration);
  const allContactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(panel.seed);
  for (const gap of gaps) {
    gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  }
  const impactByFrame = new Map(
    spec.contacts.flatMap((contact) => contact.impact === undefined
      ? []
      : [[secToFrame(contact.t), contact.impact] as const]),
  );
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (!gap.endsWithContact || impact === undefined) continue;
    gap.targets.impact = impact;
    gapAxisTargets[gap.index].impact = impact;
  }
  for (let index = 0; index + 1 < gaps.length; index++) {
    const next = gaps[index + 1];
    if (gaps[index].endsWithContact && next.endsWithContact && next.targets.impact !== undefined) {
      gaps[index].nextImpact = next.targets.impact;
    }
  }
  return { panel, spec, gaps, gapAxisTargets, allContactFrames, durationFrames };
}

export function materializeTrajectoryCaptureInput(
  setup: TrajectoryCaptureSetup,
): MaterializedTrajectoryCaptureInput {
  return {
    contactFrames: [...setup.allContactFrames],
    durationFrames: setup.durationFrames,
    gaps: setup.gaps.map((gap) => ({
      index: gap.index,
      startFrame: gap.startFrame,
      endFrame: gap.endFrame,
      endsWithContact: gap.endsWithContact,
      targets: { ...gap.targets },
      nextImpact: gap.nextImpact ?? null,
    })),
    gapAxisTargets: setup.gapAxisTargets.map((targets) => ({ ...targets })),
  };
}
