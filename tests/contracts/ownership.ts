// Compile-only negative contracts, included in the normal TypeScript gate.
import type {LineRiderEngine} from '../../scripts/lib/native_motion/engine.ts';
import type {Detection, DetectionContinuation, RawTrajectory} from '../../scripts/lib/detector.ts';
import type {CandidateGeometry, CandidateMemo, EvaluatedCandidate, MeasuredCandidate} from '../../scripts/v0/optimizer/arc_candidates.ts';

export function ownership(engine: LineRiderEngine, detection: Detection, continuation: DetectionContinuation,
  raw: RawTrajectory, lines: CandidateGeometry, evaluated: EvaluatedCandidate, candidate: MeasuredCandidate) {
  // @ts-expect-error cached prefix geometry cannot be edited
  lines[0].x1 = 0;
  // @ts-expect-error cached prefix geometry cannot grow
  lines.push(lines[0]);
  // @ts-expect-error observations cannot be mutated
  detection.measurements.speed.push(1);
  // @ts-expect-error nested observations are also read-only
  detection.measurements.position[0].x = 0;
  // @ts-expect-error live evaluations cannot enter an owned measurement memo
  const memo: CandidateMemo = evaluated;
  // @ts-expect-error attaching a handle to the facts is also forbidden
  const attached: CandidateMemo = {...candidate, child: engine};
  // @ts-expect-error list and memo share immutable candidate facts
  candidate.cost = 0;
  engine.readCachedMotionWindow(0, 1, values => {
    // @ts-expect-error WASM observations are read-only
    values[0] = 1;
    return Array.from(values);
  });
  // @ts-expect-error a borrowed observation cannot cross an await
  engine.readCachedMotionWindow(0, 1, async values => values.length);
  // @ts-expect-error detector observations cannot cross an await
  continuation.withDetection(raw, async result => result.measurements.speed.length);
  return {memo, attached};
}
