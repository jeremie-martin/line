/** Damped local response step in normalized curve-control coordinates. */
export function arcResponseStep(jacobian: number[][], residuals: number[], damping: number): number[] | null {
  const n = jacobian[0]?.length ?? 0;
  if (!n || jacobian.length !== residuals.length) return null;
  const matrix = Array.from({length: n}, (_, a) => Array.from({length: n + 1}, (_, b) =>
    b === n ? -jacobian.reduce((sum, row, r) => sum + row[a] * residuals[r], 0) :
      jacobian.reduce((sum, row) => sum + row[a] * row[b], 0) + (a === b ? damping : 0)));
  for (let d = 0; d < n; d++) {
    let pivot = d;
    for (let r = d + 1; r < n; r++) if (Math.abs(matrix[r][d]) > Math.abs(matrix[pivot][d])) pivot = r;
    [matrix[d], matrix[pivot]] = [matrix[pivot], matrix[d]];
    const divisor = matrix[d][d];
    if (!Number.isFinite(divisor) || Math.abs(divisor) < 1e-14) return null;
    for (let c = d; c <= n; c++) matrix[d][c] /= divisor;
    for (let r = 0; r < n; r++) if (r !== d) {
      const factor = matrix[r][d];
      for (let c = d; c <= n; c++) matrix[r][c] -= factor * matrix[d][c];
    }
  }
  const step = matrix.map(row => row[n]);
  return step.every(Number.isFinite) ? step : null;
}

/** Update a local response with one physically observed displacement. Inputs
 * use the same normalized control coordinates as the response matrix. */
export function arcSecantUpdate(jacobian:number[][], step:number[], change:number[]):number[][]|null {
  const length=step.reduce((s,v)=>s+v*v,0);
  if(length<1e-12||!Number.isFinite(length)||jacobian.length!==change.length||jacobian.some(r=>r.length!==step.length))return null;
  const updated=jacobian.map((row,r)=>{
    const error=change[r]-row.reduce((s,v,k)=>s+v*step[k],0);
    return row.map((v,k)=>v+error*step[k]/length);
  });
  return updated.every(r=>r.every(Number.isFinite))?updated:null;
}
