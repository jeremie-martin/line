import { authoredSpeedToPx, impactToRawPx, type Gap } from "../v0/types.ts";

/** Authored motion proposal only. The native compiler must physically realize
 * and independently measure every proposed velocity and contact interval. */
export function nativeMotionSchedule(gaps: readonly Gap[], duration: number,
  options: { drift?: number; amplitudeScale?: number; impact?: boolean } = {}) {
  const desired: Array<{ x: number; y: number }> = [];
  const grounded = Array<boolean>(duration + 1).fill(false);
  const rows: any[] = [];
  for (const gap of gaps) {
    const span = gap.endFrame - gap.startFrame;
    if (span < 1) continue;
    const speed = authoredSpeedToPx(gap.targets.speed ?? 0.55);
    const air = Math.max(Math.min(6, span - 3), Math.min(span - 3, Math.round((gap.targets.air ?? 0.5) * (span + 1))));
    const support = Math.max(3, span - air);
    const velocities = (acceleration: number) => Array.from({ length: span + 1 }, (_, k) =>
      acceleration * Math.min(k, support) + 0.175 * Math.max(0, k - support));
    const height = (v: number[]) => {
      const total = v.slice(1).reduce((s, x) => s + x, 0);
      let sum = 0, peak = 0;
      for (let k = 1; k <= span; k++) { sum += v[k]; peak = Math.max(peak, k / span * total - sum); }
      return peak;
    };
    const requestedHeight = gap.targets.amplitude === undefined ? null : gap.targets.amplitude * 60 * (options.amplitudeScale ?? 1);
    let low = -2, high = 4;
    for (let j = 0; j < 48; j++) {
      const mid = (low + high) / 2;
      if (height(velocities(mid)) < (requestedHeight ?? 0)) low = mid; else high = mid;
    }
    const vertical = velocities(requestedHeight === null ? 0 : (low + high) / 2);
    const center = (Math.max(...vertical) + Math.min(...vertical)) / 2;
    for (let k = 0; k <= span; k++) vertical[k] += (options.drift ?? 0.15) * speed - center;
    const vxAt = (s: number, k: number) => Math.sqrt(Math.max(4, s * s - vertical[Math.min(k, support)] ** 2));
    low = 2; high = speed * 2;
    for (let j = 0; j < 32; j++) {
      const mid = (low + high) / 2;
      const mean = vertical.reduce((s, y, k) => s + Math.hypot(vxAt(mid, k), y), 0) / vertical.length;
      if (mean < speed) low = mid; else high = mid;
    }
    const pace = (low + high) / 2;
    for (let k = 0; k < span; k++) {
      const frame = gap.startFrame + k;
      grounded[frame] = k < support;
      desired[frame] = { x: vxAt(pace, Math.min(k + 1, span)), y: vertical[Math.min(k + 1, span)] };
    }
    rows.push({ gapIndex: gap.index, span, support, air, requestedHeight, proposedHeight: height(vertical), pace });
  }
  for (const gap of gaps) if (gap.endsWithContact) grounded[gap.endFrame] = true;
  for (let frame = 0; frame <= duration; frame++) desired[frame] ??= desired[frame - 1] ?? { x: 10, y: 0 };
  if (options.impact) for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    if (!gap.endsWithContact || gap.targets.impact === undefined) continue;
    const h = gap.endFrame, end = Math.min(duration, h + 5);
    if (end - h < 5 || !grounded.slice(h, end + 1).every(Boolean)) continue;
    const incoming = desired[h - 1];
    const make = (delta: number) => Array.from({ length: 6 }, (_, k) => {
      const v = desired[h + k], angle = Math.atan2(v.y, v.x) + delta * Math.sin(2 * Math.PI * (k + 1) / 6);
      return { x: Math.hypot(v.x, v.y) * Math.cos(angle), y: Math.hypot(v.x, v.y) * Math.sin(angle) };
    });
    const raw = (vs: Array<{ x: number; y: number }>) => {
      let previous = incoming, sum = 0;
      for (const v of vs) {
        const angle = Math.atan2(v.y, v.x) - Math.atan2(previous.y, previous.x);
        sum += (Math.hypot(v.x, v.y) + Math.hypot(previous.x, previous.y)) / 2 * Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
        previous = v;
      }
      return sum;
    };
    const target = impactToRawPx(gap.targets.impact);
    let best = make(0), error = Math.abs(raw(best) - target);
    for (let j = -60; j <= 60; j++) {
      const vs = make(j * 0.005), e = Math.abs(raw(vs) - target);
      if (e < error) { best = vs; error = e; }
    }
    best.forEach((v, k) => desired[h + k] = v);
  }
  return { desired, grounded, rows };
}
