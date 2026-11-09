// The judging model of the ratings site, shared by the page (index.html) and the report (report.mjs).
//   fold(events)          → the current record: verdicts (latest per theme), duels, notes; retracted events removed
//   fit(themes, record)   → per theme: strength (Bradley–Terry with ties, Davidson), its uncertainty, P(among the best `top`)
//   choosePair(...)       → the next duel and why: coverage first, then the line around `top`, siblings, some random
// A set may retire themes (set.json `retired`): they stay in the fit, so every judgment that involved them still informs the
// others, but they are never shown again and never count for the best `top` (fit's `among`, choosePair's `retired`).
// A theme may have a twin (set.json `twins`: new id → earlier id), the same theme drawn differently (round 38: the colour response
// changed): its prior is its twin's strength as the comparisons without any twinned theme put it (fixed, so it cannot feed back),
// with that strength's uncertainty plus TWIN_SD; its own comparisons decide from there.
// Events refer to themes by id (a hash of the full specification, freeze.mjs), so a judgment always means one exact theme.

export const VERDICTS = ['love', 'keep', 'unsure', 'cut'];

/** A theme's ground by its paper's lightness (OKLab L): 'dark' below 0.3, 'mid' to 0.6, 'light' above. */
export function groundOf(hex) {
  const lin = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4, [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const L = 0.2104542553 * Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) + 0.793617785 * Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    - 0.0040720468 * Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return L < 0.3 ? 'dark' : L < 0.6 ? 'mid' : 'light';
}
// a verdict is an absolute anchor for the strength: its prior mean (on the natural-log scale of Bradley–Terry)
const PRIOR = {love: 1.2, keep: 0.4, unsure: -0.4, cut: -1.2}, PRIOR_SD = 0.7, NO_VERDICT_SD = 1.2, TWIN_SD = 0.5;

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
export function fit(themes, record, {top = 32, iterations = 400, among = null, twins = null} = {}) {
  const ids = themes.map(t => t.id), at = new Map(ids.map((id, i) => [id, i])), n = ids.length;
  const mu = ids.map(id => PRIOR[record.verdicts[id]] ?? 0), sd = ids.map(id => record.verdicts[id] ? PRIOR_SD : NO_VERDICT_SD);
  // a twinned theme (no verdict of its own) starts from its twin: the twin's strength from the comparisons without any twinned
  // theme, fixed before this fit
  const linked = twins ? ids.filter(id => !record.verdicts[id] && at.has(twins[id])) : [];
  if (linked.length) {
    const without = new Set(linked), base = fit(themes, {...record, duels: record.duels.filter(d => !without.has(d.left) && !without.has(d.right))}, {iterations});
    for (const id of linked) {const r = base.rows[twins[id]], i = at.get(id); mu[i] = r.strength; sd[i] = Math.hypot(r.se, TWIN_SD);}
  }
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
export function choosePair(themes, record, {top = 32, last = [], rand = Math.random, group = () => null, retired = new Set(), within = false, twins = null,
  ground = null, sameGround = 0, repeat = 0} = {}) {
  // within: only versions of one theme are compared (a set of variations, set.json pairs: "group")
  const allowed = (a, b) => !within || (group(a) !== null && group(a) === group(b));
  const live = themes.filter(t => record.verdicts[t.id] !== 'cut' && !retired.has(t.id)).map(t => t.id), pool = live.filter(id => !last.includes(id));
  if (pool.length < 2) return null;
  const {rows} = fit(themes, record, {top, iterations: 400, twins, among: retired.size ? new Set(themes.filter(t => !retired.has(t.id)).map(t => t.id)) : null});
  // a theme's comparisons count with its twin's for coverage: a twin compared three times is already placed
  const seen = id => rows[id].duels + (twins?.[id] && rows[twins[id]] ? rows[twins[id]].duels : 0);
  const met = new Map();
  for (const d of record.duels) {const k = [d.left, d.right].sort().join(' '); met.set(k, (met.get(k) ?? 0) + 1);}
  const order = (a, b, why) => rand() < 0.5 ? [a, b, why] : [b, a, why];
  const least = Math.min(...live.map(seen)), covering = least < 3;
  const r = rand();
  if (!within && !covering && r < 0.1) {
    const sibs = [];
    for (const a of pool) for (const b of pool) if (a < b && group(a) && group(a) === group(b) && !met.has(`${a} ${b}`)) sibs.push([a, b]);
    if (sibs.length) {const [a, b] = sibs[Math.floor(rand() * sibs.length)]; return order(a, b, 'sibling');}
  }
  // now and then a pair already answered, asked again (sides drawn afresh): how consistent the answers are
  if (!covering && repeat > 0 && rand() < repeat) {
    const recent = new Set(record.duels.slice(-10).map(d => [d.left, d.right].sort().join(' ')));
    const done = [...new Map(record.duels.filter(d => d.outcome !== 'pass' && pool.includes(d.left) && pool.includes(d.right) && allowed(d.left, d.right))
      .map(d => [[d.left, d.right].sort().join(' '), d])).entries()].filter(([k]) => !recent.has(k)).map(([, d]) => d);
    if (done.length) {const d = done[Math.floor(rand() * done.length)]; return order(d.left, d.right, 'repeat');}
  }
  // mostly a dark against a dark and a light against a light (a mid-tone ground meets both): where the final choice is decided;
  // the rest across, which keeps one scale for all
  const sameOnly = !covering && ground && sameGround > 0 && rand() < sameGround;
  const near = (a, b) => !sameOnly || ground(a) === ground(b) || ground(a) === 'mid' || ground(b) === 'mid';
  if (!covering && r > 0.95) {
    const a = pool[Math.floor(rand() * pool.length)], others = pool.filter(b => b !== a && allowed(a, b));
    if (others.length) return order(a, others[Math.floor(rand() * others.length)], 'random');
  }
  const scored = [];
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
    if (!allowed(pool[i], pool[j]) || !near(pool[i], pool[j])) continue;
    const a = rows[pool[i]], b = rows[pool[j]], p = 1 / (1 + Math.exp(b.strength - a.strength));
    let score = (a.se ** 2 + b.se ** 2) * p * (1 - p) * (a.pTop * (1 - a.pTop) + b.pTop * (1 - b.pTop) + 0.1)
      / (1 + (met.get([a.id, b.id].sort().join(' ')) ?? 0));
    if (covering && seen(a.id) > least && seen(b.id) > least) score *= 0.01;
    scored.push([score, a.id, b.id]);
  }
  if (!scored.length) return null;
  scored.sort((x, y) => y[0] - x[0]);
  const [, a, b] = scored[Math.floor(rand() * Math.min(4, scored.length))];
  return order(a, b, covering ? 'coverage' : 'info');
}
