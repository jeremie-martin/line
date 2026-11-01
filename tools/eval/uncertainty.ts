/** Uncertainty of a paired comparison across seeds (docs/benchmark.md).
 *
 * The unit is the seed block: one seed of every spec in the suite. Within a
 * block, the headline difference d_k (candidate − reference) uses the
 * headline's own weights, so the blocks are independent replicates of the
 * same weighted comparison, and their mean is the observed difference. This
 * is V2's seed-block idea (scripts/v0/benchmark_v2/decision_model.ts at
 * archive/pre-rework-2026-10-03): its jackknife over seed blocks reduces
 * exactly to this for a headline that is linear in the rides, as V7's is.
 *
 * What it claims, and no more: under a normal model of the block differences,
 * a 95% interval for the mean change on this fixed suite across seeds, and
 * the directional support P(mean change > 0), the posterior under a flat prior,
 * which equals one minus the one-sided t-test p-value. It says nothing about
 * new music. Looking at it repeatedly while a run grows, and stopping when it
 * looks good, makes the nominal level optimistic. */

export type SeedBlocks = {n: number; mean: number; sd: number; se: number; df: number;
  interval: [number, number]; support: number; blocks: number[]} | {n: number; mean: number; blocks: number[]; unavailable: string};

/** Fewer blocks than this give no interval: with 2 the t quantile is 12.7. */
export const MIN_BLOCKS = 3;

export function seedBlocks(blocks: number[]): SeedBlocks {
  const n = blocks.length, mean = n ? blocks.reduce((a, b) => a + b, 0) / n : NaN;
  if (n < MIN_BLOCKS) return {n, mean, blocks, unavailable: `needs ${MIN_BLOCKS} complete seed blocks (has ${n})`};
  const sd = Math.sqrt(blocks.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)), se = sd / Math.sqrt(n), df = n - 1;
  if (se === 0) return {n, mean, sd, se, df, interval: [mean, mean], support: mean > 0 ? 1 : mean < 0 ? 0 : .5, blocks};
  const q = studentTQuantile(.975, df);
  return {n, mean, sd, se, df, interval: [mean - q * se, mean + q * se], support: studentTCdf(mean / se, df), blocks};
}

/** Directional support as a reader should see it: coarse above 0.99 and
 * below 0.01, where a few blocks cannot resolve the tail. */
export function formatSupport(p: number) {
  return p > .99 ? '> 0.99' : p < .01 ? '< 0.01' : p.toFixed(2);
}

// Student t, from the V2 decision model (unchanged).
export function studentTQuantile(probability: number, degreesOfFreedom: number): number {
  if (!(probability > 0 && probability < 1)) throw new Error('t probability must be in (0,1)');
  if (!(degreesOfFreedom > 0)) throw new Error('t degrees of freedom must be positive');
  if (!Number.isFinite(degreesOfFreedom)) return inverseNormal(probability);
  if (probability < 0.5) return -studentTQuantile(1 - probability, degreesOfFreedom);
  let low = 0, high = 1;
  while (studentTCdf(high, degreesOfFreedom) < probability) high *= 2;
  for (let iteration = 0; iteration < 80; iteration++) {
    const middle = (low + high) / 2;
    if (studentTCdf(middle, degreesOfFreedom) < probability) low = middle; else high = middle;
  }
  return (low + high) / 2;
}
export function studentTCdf(value: number, degreesOfFreedom: number): number {
  if (value === 0) return 0.5;
  const x = degreesOfFreedom / (degreesOfFreedom + value * value);
  const tail = 0.5 * regularizedIncompleteBeta(x, degreesOfFreedom / 2, 0.5);
  return value > 0 ? 1 - tail : tail;
}
function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  return x < (a + 1) / (a + b + 2) ? front * betaContinuedFraction(x, a, b) / a : 1 - front * betaContinuedFraction(1 - x, b, a) / b;
}
function betaContinuedFraction(x: number, a: number, b: number): number {
  const tiny = 1e-300;
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let result = d;
  for (let iteration = 1; iteration <= 200; iteration++) {
    const even = 2 * iteration;
    let numerator = iteration * (b - iteration) * x / ((a + even - 1) * (a + even));
    d = 1 + numerator * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + numerator / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; result *= d * c;
    numerator = -(a + iteration) * (a + b + iteration) * x / ((a + even) * (a + even + 1));
    d = 1 + numerator * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + numerator / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    result *= delta;
    if (Math.abs(delta - 1) < 1e-12) break;
  }
  return result;
}
function logGamma(value: number): number {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406,
    12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const z = value - 1;
  let series = 0.9999999999998099;
  for (let index = 0; index < coefficients.length; index++) series += coefficients[index] / (z + index + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(series);
}
function inverseNormal(probability: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lower = 0.02425;
  if (probability < lower) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (probability > 1 - lower) return -inverseNormal(1 - probability);
  const q = probability - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
