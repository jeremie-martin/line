/** Independent V6 judgment of one compiled track, extracted verbatim from the
 * V6 worker so that parity checks and the benchmark share one implementation. */
import {replayV6} from '../../benchmark/v6/replay.ts';
import {requestScore} from '../../benchmark/v6/evaluator.ts';
import {inspectRepertoireLayout} from '../../scripts/v0/optimizer/repertoire_layout.ts';
import {arcRailGroups} from '../../scripts/v0/optimizer/arc_rail_groups.ts';

export function judgeV6Track(track: any, c: any, music: any, seed: number) {
  const requested = c.plans[seed], replay = replayV6(track, music, requested);
  // Infer connected roles from endpoint geometry, not the compiler's claimed realization.
  const fragments = new Set(requested.requests.filter((r: any) => r.construction === 'scattered').map((r: any) => r.section));
  const roles: Record<number, number[]> = {};
  let geometryError: string | null = null;
  try {
    for (const [i, chains] of arcRailGroups(track.lines.filter((l: any) => !fragments.has(Math.floor((l.id - 1000) / 10000)))))
      roles[i] = (chains[1] ?? []).map((l: any) => l.id);
  } catch (e) { geometryError = String(e); }
  const realization = inspectRepertoireLayout(requested, track.lines, roles, replay.collisions, replay.positions);
  const foreign = track.lines.some((l: any) => !requested.requests[Math.floor((l.id - 1000) / 10000)]);
  const valid = replay.grade.score.valid && !geometryError && !foreign, scored: number[] = c.scoredSections[seed];
  const fulfilled = scored.map(i => realization.sections[i].fulfilled), musicalScore = replay.grade.score.score;
  return {replay, realization, geometryError, foreign, valid, musicalScore,
    fulfilled: fulfilled.filter(Boolean).length, requested: fulfilled.length,
    score: requestScore(musicalScore, valid, fulfilled)};
}
