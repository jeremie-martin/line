import type { CompleteCandidate } from "./types.ts";
import {
  compareNumber,
  compareString,
  compareTuple,
  FLOAT_EPS,
} from "./deterministic_math.ts";
import { CompileStatsBuilder } from "./stats.ts";

export class BestArchive {
  best: CompleteCandidate | null = null;
  bestRejected: CompleteCandidate | null = null;
  considered = 0;
  contractPassing = 0;
  private readonly stats: CompileStatsBuilder;

  constructor(stats: CompileStatsBuilder) {
    this.stats = stats;
  }

  consider(candidate: CompleteCandidate): boolean {
    this.considered++;
    this.stats.recordCompletedCandidate(candidate.score.contract_passed, candidate.foundAtWorkUnit);
    if (!candidate.score.contract_passed) {
      if (this.bestRejected === null || compareRejectedCandidates(candidate, this.bestRejected) < 0) {
        this.bestRejected = candidate;
      }
      this.stats.recordRejectedCandidate({
        found_at_work_unit: candidate.foundAtWorkUnit,
        score: candidate.score.score,
        axis_quality: candidate.score.axis_quality,
        hits: candidate.score.hits,
        drift: candidate.score.drift,
        missing: candidate.score.missing,
        off_beat_landings: candidate.score.off_beat_landings,
        died: candidate.score.died,
        hard_failures: candidate.score.hard_failures,
        missing_contact_frames: contactFramesWithStatus(candidate, "missing"),
        drift_contact_frames: contactFramesWithStatus(candidate, "drift"),
      });
      return false;
    }

    this.contractPassing++;
    if (this.best === null || compareCompleteCandidates(candidate, this.best) < 0) {
      this.best = candidate;
      this.stats.recordArchiveUpdate(candidate.foundAtWorkUnit);
      return true;
    }
    return false;
  }
}

function compareRejectedCandidates(a: CompleteCandidate, b: CompleteCandidate): number {
  return compareTuple([
    b.score.hits - a.score.hits,
    -compareNumber(a.score.score, b.score.score, FLOAT_EPS),
    -compareNumber(a.score.axis_quality, b.score.axis_quality, FLOAT_EPS),
    a.score.missing - b.score.missing,
    a.score.off_beat_landings - b.score.off_beat_landings,
    a.score.died - b.score.died,
    compareNumber(a.rmsContactDrift, b.rmsContactDrift, FLOAT_EPS),
    a.track.lines.length - b.track.lines.length,
    compareString(a.trackHash, b.trackHash),
    compareString(candidateKeySortKey(a), candidateKeySortKey(b)),
  ]);
}

function contactFramesWithStatus(
  candidate: CompleteCandidate,
  status: "missing" | "drift",
): number[] {
  return candidate.report.contacts
    .filter((contact) => contact.status === status)
    .map((contact) => Math.round(contact.t_target * 40));
}

export function compareCompleteCandidates(a: CompleteCandidate, b: CompleteCandidate): number {
  return compareTuple([
    -compareNumber(a.score.axis_quality, b.score.axis_quality, FLOAT_EPS),
    -compareNumber(a.score.score, b.score.score, FLOAT_EPS),
    compareNumber(a.rmsContactDrift, b.rmsContactDrift, FLOAT_EPS),
    a.track.lines.length - b.track.lines.length,
    compareString(a.trackHash, b.trackHash),
    compareString(candidateKeySortKey(a), candidateKeySortKey(b)),
  ]);
}

function candidateKeySortKey(candidate: CompleteCandidate): string {
  const key = candidate.candidateKey;
  return [
    key.specHash,
    key.seed,
    key.gapIndex,
    key.prefixHash,
    key.stream,
    key.ordinal,
  ].join("|");
}
