/**
 * Small immutable physics vocabulary for target-blind post-impact studies.
 *
 * This is intentionally independent of the broad authoring/types module. The
 * fixture boundary supplies the active impact convention at replay time, so
 * construction cannot inspect `process.env` or inherit compiler modules just
 * to obtain line shapes, speed normalization, or impact-scale arithmetic.
 */
export type PostimpactTrackLine = {
  id: number;
  type: 0 | 1 | 2;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  flipped: boolean;
  leftExtended: boolean;
  rightExtended: boolean;
};

export type PostimpactImpactConvention = {
  impactWindowFrames: number;
  catchableRedirFraction: number;
  redirArcSoftPxPerFrame: number;
  redirArcVeryStrongPxPerFrame: number;
  /** Canonical authored-speed ruler sealed for descriptive measurement. */
  speedRulerMinPxPerFrame: number;
  speedRulerMaxPxPerFrame: number;
};

/** Descriptive speed conversion can be sealed independently of impact scoring. */
export type PostimpactSpeedRuler = Readonly<{
  speedRulerMinPxPerFrame: number;
  speedRulerMaxPxPerFrame: number;
}>;

export function postimpactImpactToRedirArcPx(
  impact: number,
  convention: PostimpactImpactConvention,
): number {
  assertImpactConvention(convention);
  return convention.redirArcSoftPxPerFrame + clamp01(impact) *
    (convention.redirArcVeryStrongPxPerFrame - convention.redirArcSoftPxPerFrame);
}

export function postimpactRedirArcToImpact(
  redirArcPxPerFrame: number,
  convention: PostimpactImpactConvention,
): number {
  assertImpactConvention(convention);
  return clamp01(
    (redirArcPxPerFrame - convention.redirArcSoftPxPerFrame) /
      (convention.redirArcVeryStrongPxPerFrame - convention.redirArcSoftPxPerFrame),
  );
}

export function postimpactSpeedPxToAuthored(
  pxPerFrame: number,
  ruler: PostimpactSpeedRuler,
): number {
  assertPostimpactSpeedRuler(ruler);
  return (pxPerFrame - ruler.speedRulerMinPxPerFrame) /
    (ruler.speedRulerMaxPxPerFrame - ruler.speedRulerMinPxPerFrame);
}

export function assertImpactConvention(convention: PostimpactImpactConvention): void {
  if (!Number.isSafeInteger(convention.impactWindowFrames) || convention.impactWindowFrames < 1) {
    throw new Error("post-impact impact window must be a positive safe integer");
  }
  if (!Number.isFinite(convention.catchableRedirFraction) ||
      !(convention.catchableRedirFraction > 0) || convention.catchableRedirFraction > 1) {
    throw new Error("post-impact catchable redirection fraction must be in (0, 1]");
  }
  if (!Number.isFinite(convention.redirArcSoftPxPerFrame) ||
      !Number.isFinite(convention.redirArcVeryStrongPxPerFrame) ||
      !(convention.redirArcVeryStrongPxPerFrame > convention.redirArcSoftPxPerFrame)) {
    throw new Error("post-impact impact normalization anchors must be finite and increasing");
  }
  assertPostimpactSpeedRuler(convention);
}

export function assertPostimpactSpeedRuler(ruler: PostimpactSpeedRuler): void {
  if (!Number.isFinite(ruler.speedRulerMinPxPerFrame) ||
      !Number.isFinite(ruler.speedRulerMaxPxPerFrame) ||
      !(ruler.speedRulerMaxPxPerFrame > ruler.speedRulerMinPxPerFrame)) {
    throw new Error("post-impact speed ruler anchors must be finite and increasing");
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
