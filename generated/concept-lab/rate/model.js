// The judging model of the ratings site, shared by the page (index.html) and the report (report.mjs).
//   fold(events)          → the current record: verdicts (latest per theme), duels, notes; retracted events removed
//   fit(themes, record)   → per theme: strength (Bradley–Terry with ties, Davidson), its uncertainty, P(among the best `top`)
//   choosePair(...)       → the next duel and why: coverage first, then the line around `top`, siblings, some random
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
export function fit(themes, record, {top = 32, iterations = 400} = {}) {
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
  const se = info.map(x => 1 / Math.sqrt(x)), K = Math.min(top, n), inTop = new Array(n).fill(0), draws = 400;
  let seed = 12345; const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const normal = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  for (let d = 0; d < draws; d++) {
    const x = s.map((v, i) => v + se[i] * normal()), cut = [...x].sort((a, b) => b - a)[K - 1];
    x.forEach((v, i) => {if (v >= cut) inTop[i]++;});
  }
  const rows = ids.map((id, i) => ({id, strength: s[i], se: se[i], pTop: inTop[i] / draws, duels: duelsOf[i], verdict: record.verdicts[id] ?? null}));
  const order = [...rows].sort((a, b) => b.strength - a.strength);
  order.forEach((r, k) => {r.rank = k + 1;});
  return {rows: Object.fromEntries(rows.map(r => [r.id, r])), order, tie: Math.exp(lnu), games: games.length};
}

/** The next duel among the themes not cut, as [left, right, why]. `group` maps a theme to its draft (siblings share it). */
export function choosePair(themes, record, {top = 32, last = [], rand = Math.random, group = () => null} = {}) {
  const live = themes.filter(t => record.verdicts[t.id] !== 'cut').map(t => t.id).filter(id => !last.includes(id));
  if (live.length < 2) return null;
  const {rows} = fit(themes, record, {top, iterations: 150});
  const met = new Set(record.duels.map(d => [d.left, d.right].sort().join(' ')));
  const unmet = (a, b) => !met.has([a, b].sort().join(' '));
  const pick = xs => xs[Math.floor(rand() * xs.length)];
  const p = (a, b) => 1 / (1 + Math.exp(rows[b].strength - rows[a].strength));
  const opponent = (a, pool) => {
    const others = pool.filter(b => b !== a), fresh = others.filter(b => unmet(a, b));
    const from = fresh.length ? fresh : others;
    return from.sort((x, y) => Math.abs(p(a, x) - 0.5) - Math.abs(p(a, y) - 0.5) || rows[x].duels - rows[y].duels)[0];
  };
  const order = (a, b, why) => rand() < 0.5 ? [a, b, why] : [b, a, why];
  // 1. coverage: every theme reaches three duels
  const least = Math.min(...live.map(id => rows[id].duels));
  if (least < 3) {const a = pick(live.filter(id => rows[id].duels === least)); return order(a, opponent(a, live), 'coverage');}
  const r = rand();
  // 2. siblings: versions of one draft against each other ("which version")
  if (r < 0.15) {
    const pairs = [];
    for (const a of live) for (const b of live) if (a < b && group(a) && group(a) === group(b) && unmet(a, b)) pairs.push([a, b]);
    if (pairs.length) {const [a, b] = pick(pairs); return order(a, b, 'sibling');}
  }
  // 3. a few at random, against a biased model
  if (r > 0.9) {const a = pick(live); return order(a, pick(live.filter(b => b !== a)), 'random');}
  // 4. information: the theme whose place among the best is least certain, against an even opponent
  const a = [...live].sort((x, y) => Math.abs(rows[x].pTop - 0.5) - Math.abs(rows[y].pTop - 0.5) || rows[x].duels - rows[y].duels)[0];
  return order(a, opponent(a, live), 'info');
}
