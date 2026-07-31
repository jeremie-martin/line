import { studentTQuantile } from "../v0/benchmark_v2/decision_model.ts";

export type ActiveCampaignAnalysisContract = {
  promotionSeeds: number;
  expectedRows: number;
  paired95Critical: number;
};

/** Validate the retained archive shape used by the current-baseline analysis.
 *
 * Campaign promotion may stop at any declared sequential look. The analysis
 * must describe that exact accepted prefix; it must never extend or relabel an
 * early acceptance merely to satisfy an N=48 reporting assumption.
 */
export function activeCampaignAnalysisContract(
  baseline: any,
  archive: any,
  developmentCases: number,
): ActiveCampaignAnalysisContract {
  const promotionSeeds = baseline?.scope?.promotion_seeds;
  const looks = baseline?.scope?.sequential_looks;
  if (
    !Number.isSafeInteger(promotionSeeds) || promotionSeeds < 2 ||
    !Array.isArray(looks) || !looks.includes(promotionSeeds) ||
    !Number.isSafeInteger(developmentCases) || developmentCases < 1
  ) throw new Error(`active campaign baseline has no declared promotion depth`);

  const expectedRows = developmentCases * promotionSeeds;
  const schedule = archive?.identity?.seedSchedule;
  const baselineSchedule = baseline?.development?.seed_schedule;
  if (
    !Array.isArray(archive?.runs) || archive.runs.length !== expectedRows ||
    schedule?.seedsPerBudget !== promotionSeeds ||
    !Array.isArray(schedule?.byBudget) || schedule.byBudget.length !== 1 ||
    schedule.byBudget[0]?.actualSeeds?.length !== promotionSeeds ||
    baselineSchedule?.seedsPerBudget !== promotionSeeds ||
    JSON.stringify(schedule) !== JSON.stringify(baselineSchedule)
  ) {
    throw new Error(
      `active campaign archive is not the exact 750k/N=${promotionSeeds} promotion prefix`,
    );
  }

  return {
    promotionSeeds,
    expectedRows,
    paired95Critical: studentTQuantile(0.975, promotionSeeds - 1),
  };
}

export function activeCampaignComparisonGuidance(depth: number): string {
  return `Future candidates should compare against matching prefixes of this exact active archive on the declared N=48 seed schedule; its promotion headline remains tied to N=${depth}.`;
}
