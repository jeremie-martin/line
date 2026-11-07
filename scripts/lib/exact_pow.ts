/** `pow` with the same bits on every machine: Math.pow as V8 12 computed it, fdlibm's
 * e_pow with a slightly different final division. Later engines call the system libm,
 * which rounds 9% of results differently, and curve geometry feeds on these powers:
 * one last bit moves a ride. `x ** 2` is plain multiplication on every engine.
 *
 * Covers finite x > 0 and finite y, and results between about 1e-300 and 1e300.
 * Everything else (zero, negative, infinite or NaN inputs, and extreme results) has
 * no rounding question in this compiler's use, so it goes to Math.pow. */
const float = new Float64Array(1), words = new Int32Array(float.buffer);
const clearLow = (x: number) => { float[0] = x; words[0] = 0; return float[0]; };
const withHigh = (x: number, high: number) => { float[0] = x; words[1] = high; return float[0]; };

const L1 = 5.99999999999994648725e-01, L2 = 4.28571428578550184252e-01, L3 = 3.33333329818377432918e-01,
  L4 = 2.72728123808534006489e-01, L5 = 2.30660745775561754067e-01, L6 = 2.06975017800338417784e-01,
  P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05,
  P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08,
  LG2 = 6.93147180559945286227e-01, LG2_H = 6.93147182464599609375e-01, LG2_L = -1.90465429995776804525e-09,
  CP = 9.61796693925975554329e-01, CP_H = 9.61796700954437255859e-01, CP_L = -7.02846165095275826516e-09,
  DP_H = 5.84962487220764160156e-01, DP_L = 1.35003920212974897128e-08;

export function exactPow(x: number, y: number): number {
  if (!(x > 0) || x === Infinity || y !== y || Math.abs(y) > 2147483648) return Math.pow(x, y);
  if (y === 0 || x === 1) return 1;
  if (y === 1) return x;
  if (y === -1) return 1 / x;
  if (y === 2) return x * x;
  if (y === .5) return Math.sqrt(x);

  float[0] = x;
  let high = words[1], n = 0;
  if (high < 0x00100000) { float[0] = x * 9007199254740992; high = words[1]; n = -53; } // subnormal x
  const ax0 = float[0], mantissa = high & 0x000fffff;
  n += (high >> 20) - 0x3ff;
  // Normalize into [sqrt(3/4), sqrt(3)), split at sqrt(3/2).
  let k = 0, normal = mantissa | 0x3ff00000;
  if (mantissa > 0x3988e) {
    if (mantissa < 0xbb67a) k = 1;
    else { n += 1; normal -= 0x00100000; }
  }
  const ax = withHigh(ax0, normal), bp = k ? 1.5 : 1, dpH = k ? DP_H : 0, dpL = k ? DP_L : 0;

  // ss = (ax - bp) / (ax + bp), split into high and low parts.
  let u = ax - bp, v = 1 / (ax + bp);
  const ss = u * v, sH = clearLow(ss);
  let tH = withHigh(0, ((normal >> 1) | 0x20000000) + 0x00080000 + (k << 18));
  let tL = ax - (tH - bp);
  const sL = v * ((u - sH * tH) - sH * tL);
  // log(ax)
  let s2 = ss * ss, r = s2 * s2 * (L1 + s2 * (L2 + s2 * (L3 + s2 * (L4 + s2 * (L5 + s2 * L6)))));
  r += sL * (sH + ss);
  s2 = sH * sH;
  tH = clearLow(3 + s2 + r);
  tL = r - ((tH - 3) - s2);
  u = sH * tH;
  v = sL * tH + tL * ss;
  // log2(ax) = n + dp + zH + zL
  let pH = clearLow(u + v), pL = v - (pH - u);
  const zH = CP_H * pH, zL = CP_L * pH + pL * CP + dpL, t = n;
  const t1 = clearLow(((zH + zL) + dpH) + t), t2 = zL - (((t1 - t) - dpH) - zH);

  // y * log2(x) = pH + pL, then 2^(pH + pL)
  const y1 = clearLow(y);
  pL = (y - y1) * t1 + y * t2;
  pH = y1 * t1;
  let z = pL + pH;
  float[0] = z;
  const j = words[1], i = j & 0x7fffffff;
  if (i >= 0x408f4000) return Math.pow(x, y); // |z| >= 1000
  let exponent = (i >> 20) - 0x3ff, m = 0;
  if (i > 0x3fe00000) { // |z| > 0.5: m = nearest integer
    const rounded = j + (0x00100000 >> (exponent + 1));
    exponent = ((rounded & 0x7fffffff) >> 20) - 0x3ff;
    const whole = withHigh(0, rounded & ~(0x000fffff >> exponent));
    m = ((rounded & 0x000fffff) | 0x00100000) >> (20 - exponent);
    if (j < 0) m = -m;
    pH -= whole;
  }
  const f = clearLow(pL + pH);
  u = f * LG2_H;
  v = (pL - (f - pH)) * LG2 + f * LG2_L;
  z = u + v;
  const w = v - (z - u), square = z * z;
  const c = z - square * (P1 + square * (P2 + square * (P3 + square * (P4 + square * P5))));
  r = (z * c) / ((c - 2) - (w + z * w)); // V8's form; e_pow.c subtracts after dividing
  z = 1 - (r - z);
  float[0] = z;
  words[1] += m << 20;
  return float[0];
}
