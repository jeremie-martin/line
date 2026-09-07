/** Small dense ridge least squares for exact physical response studies. */
export function ridgeStep(j: number[][], residual: number[], ridge = 1e-6): number[] {
  const m = residual.length, n = j[0]?.length ?? 0;
  if (!m || !n || j.length !== m || j.some(row => row.length !== n) || ridge <= 0 ||
      ![...residual, ...j.flat()].every(Number.isFinite)) throw new Error("invalid response system");
  // Solve (J J^T + ridge I) z = residual, then step = -J^T z.
  // The measured output dimension is small; no compiler/runtime dependency on
  // a general matrix package is needed.
  const l = Array.from({ length: m }, () => Array(m).fill(0));
  for (let i = 0; i < m; i++) for (let k = 0; k <= i; k++) {
    let value = j[i].reduce((s, v, c) => s + v * j[k][c], i === k ? ridge : 0);
    for (let c = 0; c < k; c++) value -= l[i][c] * l[k][c];
    if (i === k) {
      if (!(value > 0)) throw new Error("ridge system lost positive definiteness");
      l[i][k] = Math.sqrt(value);
    } else l[i][k] = value / l[k][k];
  }
  const y = Array(m).fill(0), z = Array(m).fill(0);
  for (let i = 0; i < m; i++) {
    let value = residual[i]; for (let k = 0; k < i; k++) value -= l[i][k] * y[k];
    y[i] = value / l[i][i];
  }
  for (let i = m - 1; i >= 0; i--) {
    let value = y[i]; for (let k = i + 1; k < m; k++) value -= l[k][i] * z[k];
    z[i] = value / l[i][i];
  }
  return Array.from({ length: n }, (_, k) => -j.reduce((s, row, i) => s + row[k] * z[i], 0));
}

export function broydenUpdate(j: number[][], step: number[], outputChange: number[]): number[][] {
  const length2 = step.reduce((s, v) => s + v * v, 0);
  if (length2 <= 1e-24) return j.map(row => row.slice());
  return j.map((row, i) => {
    const error = outputChange[i] - row.reduce((s, v, k) => s + v * step[k], 0);
    return row.map((v, k) => v + error * step[k] / length2);
  });
}
