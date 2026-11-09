// The judging model of the ratings site, shared by the page (index.html) and the report (report.mjs).
//   fold(events)          → the current record: verdicts (latest per theme), duels, notes; retracted events removed
//   fit(themes, record)   → per theme: strength (Bradley–Terry with ties, Davidson), its uncertainty, P(among the best `top`)
//   choosePair(...)       → the next duel and why: coverage first, then the line around `top`, siblings, some random
// A set may retire themes (set.json `retired`): they stay in the fit, so every judgment that involved them still informs the
// others, but they are never shown again and never count for the best `top` (fit's `among`, choosePair's `retired`).
// Events refer to themes by id (a hash of the full specification, freeze.mjs), so a judgment always means one exact theme.

export const VERDICTS = ['love', 'keep', 'unsure', 'cut'];
// a verdict is an absolute anchor for the strength: its prior mean (on the natural-log scale of Bradley–Terry)
const PRIOR = {love: 1.2, keep: 0.4, unsure: -0.4, cut: -1.2}, PRIOR_SD = 0.7, NO_VERDICT_SD = 1.2;

/** The record as of now: retracted events dropped, the latest verdict per theme, every duel and note in order. */
export function fold(events) {
  const retracted = new Set(events.filter(e => e.kind === 'retract').map(e => e.target));
  const live = events.filter(e => e.kind !== 'retract' && !retracted.has(e.id));
  const verdicts = {}, duels = [], notes = [];
  for (const e of live) {
    if (e.kind === 'verdict') verdicts[e.theme] = e.value;
    else if (e.kind === 'duel') duels.push(e);
    else if (e.kind === 'note') notes.push(e);
  }
  return {verdicts, duels, notes, live};
}

/** Bradley–Terry with ties (Davidson), each theme's verdict a Gaussian prior on its strength. Passes carry no information. */
export function fit(themes, record, {top = 32, iterations = 400, among = null} = {}) {
  const ids = themes.map(t => t.id), at = new Map(ids.map((id, i) => [id, i])), n = ids.length;
  const mu = ids.map(id => PRIOR[record.verdicts[id]] ?? 0), sd = ids.map(id => record.verdicts[id] ? PRIOR_SD : NO_VERDICT_SD);
  const games = record.duels.filter(d => d.outcome !== 'pass' && at.has(d.left) && at.has(d.right))
    .map(d => [at.get(d.left), at.get(d.right), d.outcome]);
  const s = mu.slice(); let lnu = Math.log(0.5);
  const probs = (i, j) => {
    const a = Math.exp(s[i]), b = Math.exp(s[j]), t = Math.exp(lnu) * Math.sqrt(a * b), z = a + b + t;
    return [a / z, b / z, t / z];
  };
  for (let it = 0; it < iterations; it++) {
    const g = s.map((x, i) => -(x - mu[i]) / sd[i] ** 2); let gnu = 0;
    for (const [i, j, o] of games) {
      const [pi, pj, pt] = probs(i, j);
      // d log P / d s: a win for i: 1 - pi - pt/2; a tie: 1/2 - pi - pt/2 (and symmetrically for j)
      const wi = o === 'left' ? 1 : o === 'equal' ? 0.5 : 0, wj = o === 'right' ? 1 : o === 'equal' ? 0.5 : 0;
      g[i] += wi - pi - pt / 2; g[j] += wj - pj - pt / 2;
      gnu += (o === 'equal' ? 1 : 0) - pt;
    }
    const lr = 0.5 / (1 + it / 100);
    for (let i = 0; i < n; i++) s[i] += lr * g[i] / (1 + games.length / n);
    lnu = Math.max(-4, Math.min(1, lnu + 0.1 * lr * gnu / Math.max(1, games.length)));
  }
  // uncertainty from the curvature (information) at the fit; P(among the best `top`) by sampling
  const info = sd.map(x => 1 / x ** 2), duelsOf = new Array(n).fill(0);
  for (const [i, j] of games) {const [pi, pj] = probs(i, j); const v = pi * (1 - pi) + pj * (1 - pj); info[i] += v / 2; info[j] += v / 2; duelsOf[i]++; duelsOf[j]++;}
  // the best `top` among the themes that compete (`among`, every theme by default): a retired theme is never in it
  const competes = ids.map(id => !among || among.has(id)), m = competes.filter(Boolean).length;
  const se = info.map(x => 1 / Math.sqrt(x)), K = Math.min(top, m), inTop = new Array(n).fill(0), draws = 400;
  let seed = 12345; const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  for (let d = 0; d < draws; d++) {
    const x = s.map((v, i) => v + se[i] * normal()), cut = x.filter((_, i) => competes[i]).sort((a, b) => b - a)[K - 1];
    x.forEach((v, i) => {if (competes[i] && v >= cut) inTop[i]++;});
  }
  const rows = ids.map((id, i) => ({id, strength: s[i], se: se[i], pTop: competes[i] ? inTop[i] / draws : null, duels: duelsOf[i],
    verdict: record.verdicts[id] ?? null, retired: !competes[i]}));
  // the order of the competing themes (ranked), then the retired ones (unranked)
  const order = [...rows].sort((a, b) => (a.retired - b.retired) || b.strength - a.strength);
  order.filter(r => !r.retired).forEach((r, k) => {r.rank = k + 1;});
  return {rows: Object.fromEntries(rows.map(r => [r.id, r])), order, tie: Math.exp(lnu), games: games.length};
}

/** The next duel among the themes not cut, as [left, right, why]. `group` maps a theme to its draft (siblings share it).
 *  The pair whose answer teaches the most: both strengths uncertain (se²), an outcome hard to call (p(1−p)), and near the line
 *  of the best `top` (pTop(1−pTop), with a floor so the whole order keeps improving); a pair already met counts less, and every
 *  theme first reaches three duels. Chosen at random among the four best, so the screen never repeats itself.
 *  In simulation (87 themes, a judge of known taste, rate/ in the 9 November notes) it finds 28.5 of the true best 32 after
 *  500 duels and 29.3 after 1000, against 25.0 and 27.3 for random pairs, and orders the whole set at least as well.
 *  A few pairs are siblings (versions of one draft: "which version", what drafting learns from) or random (against a biased fit). */
export function choosePair(themes, record, {top = 32, last = [], rand = Math.random, group = () => null, retired = new Set()} = {}) {
  const live = themes.filter(t => record.verdicts[t.id] !== 'cut' && !retired.has(t.id)).map(t => t.id), pool = live.filter(id => !last.includes(id));
  if (pool.length < 2) return null;
  const {rows} = fit(themes, record, {top, iterations: 400, among: retired.size ? new Set(themes.filter(t => !retired.has(t.id)).map(t => t.id)) : null});
  const met = new Map();
  for (const d of record.duels) {const k = [d.left, d.right].sort().join(' '); met.set(k, (met.get(k) ?? 0) + 1);}
  const order = (a, b, why) => rand() < 0.5 ? [a, b, why] : [b, a, why];
  const least = Math.min(...live.map(id => rows[id].duels)), covering = least < 3;
  const r = rand();
  if (!covering && r < 0.1) {
    const sibs = [];
    for (const a of pool) for (const b of pool) if (a < b && group(a) && group(a) === group(b) && !met.has(`${a} ${b}`)) sibs.push([a, b]);
    if (sibs.length) {const [a, b] = sibs[Math.floor(rand() * sibs.length)]; return order(a, b, 'sibling');}
  }
  if (!covering && r > 0.95) {const a = pool[Math.floor(rand() * pool.length)], others = pool.filter(b => b !== a); return order(a, others[Math.floor(rand() * others.length)], 'random');}
  const scored = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    const a = rows[pool[i]], b = rows[pool[j]], p = 1 / (1 + Math.exp(b.strength - a.strength));
    let score = (a.se ** 2 + b.se ** 2) * p * (1 - p) * (a.pTop * (1 - a.pTop) + b.pTop * (1 - b.pTop) + 0.1)
      / (1 + (met.get([a.id, b.id].sort().join(' ')) ?? 0));
    if (covering && a.duels > least && b.duels > least) score *= 0.01;
    scored.push([score, a.id, b.id]);
  }
  scored.sort((x, y) => y[0] - x[0]);
  const [, a, b] = scored[Math.floor(rand() * Math.min(4, scored.length))];
  return order(a, b, covering ? 'coverage' : 'info');
}
