/** Correct a planning estimate when the next curve completes the preceding span. */
import type { AxisValues } from '../types.ts';

export function arcSpanLoss(achieved: AxisValues, targets: AxisValues, amplitudeWeight: number): number {
  return (['air', 'speed', 'amplitude'] as const).reduce((sum, key) => {
    const target = targets[key], value = achieved[key];
    return sum + (target === undefined || value === undefined ? 0 :
      (value - target) ** 2 * (key === 'amplitude' ? amplitudeWeight : 1));
  }, 0);
}

/** The subtracted estimate is constant for a physical prefix. Its replacement
 * avoids counting both the truncated span and its completed measurement when
 * neighboring search stages are combined. Residuals retain the actual axes so
 * the local response solver can optimize their effect at the boundary. */
export function arcBoundaryCorrection(achieved: AxisValues, targets: AxisValues,
  priorLoss: number, amplitudeWeight: number, initialCost = 0): {cost: number; residuals: number[]} {
  let cost = initialCost;
  const residuals: number[] = [];
  for (const key of ['air', 'speed', 'amplitude'] as const) {
    const target = targets[key], value = achieved[key];
    if (target === undefined || value === undefined) continue;
    const residual = (value - target) * Math.sqrt(key === 'amplitude' ? amplitudeWeight : 1);
    residuals.push(residual); cost += residual * residual;
  }
  return {cost: cost - priorLoss, residuals};
}
