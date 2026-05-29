import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { detect, extractRawTrajectory } from "../scripts/lib/detector.ts";
import { LineRiderEngine, createLineFromJson } from "../scripts/lib/_lr_engine.ts";
import { compile } from "../scripts/v1/compile.ts";
import { buildDriftReport } from "../scripts/v1/completion_oracle.ts";
import { normalizeSpec } from "../scripts/v1/normalize.ts";
import { proposePolishCandidates } from "../scripts/v1/polish.ts";
import { scoreDriftReport } from "../scripts/v0/score.ts";
import type { CompleteCandidate, Spec, TrackJson } from "../scripts/v1/types.ts";

const ONE_CONTACT: Spec = {
  duration: 1.5,
  contacts: [{ t: 1 }],
  sections: [{ t0: 0, t1: 1.5, air: 0.7 }],
};

const ONE_CONTACT_WITH_STYLE: Spec = {
  duration: 1.5,
  contacts: [{ t: 1 }],
  sections: [{ t0: 0, t1: 1.5, air: 0.7, grain: 0.5, contact_style: 0.5 }],
};

const ORDINARY_DENSE_SHAPE: Spec = {
  duration: 4,
  contacts: [{ t: 0.5 }, { t: 1 }, { t: 1.5 }, { t: 2 }],
  sections: [{ t0: 0, t1: 4, air: 0.6, speed: 0.4 }],
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

describe("v1 coverage search", () => {
  test("finds a contract-passing candidate on a one-contact smoke spec", () => {
    const result = compile(ONE_CONTACT, { seed: 0, budget: { kind: "work", units: 50_000 } });
    const score = scoreDriftReport(result.report, { totalFrames: Math.round(ONE_CONTACT.duration * 40) });

    expect(score.contract_passed).toBe(true);
    expect(result.stats.no_contract_candidate_found).toBe(false);
    expect(result.stats.completed_candidates).toBeGreaterThan(0);
    expect(result.stats.contract_passing_candidates).toBeGreaterThan(0);
    expect(result.stats.best_found_at_work_unit).not.toBeNull();
  });

  test("best returned axis quality is monotonic over increasing work budgets", () => {
    const budgets = [15_000, 30_000, 50_000] as const;
    const qualities = budgets.map((units) => {
      const result = compile(ONE_CONTACT, { seed: 0, budget: { kind: "work", units } });
      return scoreDriftReport(result.report, { totalFrames: Math.round(ONE_CONTACT.duration * 40) }).axis_quality;
    });

    expect(qualities[1]).toBeGreaterThanOrEqual(qualities[0] - 1e-12);
    expect(qualities[2]).toBeGreaterThanOrEqual(qualities[1] - 1e-12);
  });

  test("returned DriftReport matches independent resimulation from TrackJson", () => {
    const result = compile(ONE_CONTACT_WITH_STYLE, { seed: 0, budget: { kind: "work", units: 50_000 } });
    const context = normalizeSpec(ONE_CONTACT_WITH_STYLE, 0);
    const replay = replayEngine(result.track);
    const detection = detect(extractRawTrajectory(replay, context.durationFrames + 20));
    const rebuilt = buildDriftReport(detection, context, [], result.track.lines);

    expect(rebuilt).toEqual(result.report);
  });

  test("ordinary specs do not enter dense recovery mode", () => {
    const result = compile(ORDINARY_DENSE_SHAPE, { seed: 0, budget: { kind: "work", units: 2_000 } });

    expect(result.stats.recovery_promotions).toBe(0);
    expect(result.stats.candidates_sampled).toBeGreaterThan(0);
  });

  test("polish proposals are separate candidates and do not mutate the base track", () => {
    const result = compile(ONE_CONTACT, { seed: 0, budget: { kind: "work", units: 50_000 } });
    const context = normalizeSpec(ONE_CONTACT, 0);
    const base: CompleteCandidate = {
      track: result.track,
      report: result.report,
      score: scoreDriftReport(result.report, { totalFrames: context.durationFrames }),
      foundAtWorkUnit: result.stats.best_found_at_work_unit ?? 0,
      candidateKey: {
        specHash: context.specHash,
        seed: 0,
        gapIndex: context.gaps.length,
        prefixHash: "test",
        stream: "coverage",
        ordinal: 0,
      },
      trackHash: hash(result.track),
      rmsContactDrift: 0,
    };
    const before = hash(result.track);
    const proposals = proposePolishCandidates(base, context);

    expect(proposals.length).toBeGreaterThan(0);
    expect(hash(result.track)).toBe(before);
    expect(proposals.every((proposal) => proposal.candidateKey.stream === "polish")).toBe(true);
    expect(proposals.some((proposal) => hash(proposal.track) !== before)).toBe(true);
  });

  test("polish candidates cannot lower the returned contract-passing result", () => {
    const result = compile(ONE_CONTACT, { seed: 0, budget: { kind: "work", units: 50_000 } });
    const score = scoreDriftReport(result.report, { totalFrames: Math.round(ONE_CONTACT.duration * 40) });

    expect(score.contract_passed).toBe(true);
    expect(result.stats.polish_iterations).toBeGreaterThan(0);
    expect(result.stats.polish_candidates).toBeGreaterThan(0);
  });
});

function replayEngine(track: TrackJson): any {
  let engine = new LineRiderEngine().setStart(
    track.riders[0].startPosition,
    track.riders[0].startVelocity,
  );
  for (const line of track.lines) {
    engine = engine.addLine(createLineFromJson(line));
  }
  return engine;
}
