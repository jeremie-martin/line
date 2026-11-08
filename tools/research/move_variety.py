# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Variety of the committed moves, per arm (report only, never a target; unvalidated
until compared with the owner's eye in a blind pairwise study).

Reads candidate_origins.ts studies (rides.jsonl), one per arm, same seed and specs:
  uv run --offline -q tools/research/move_variety.py main=DIR/rides.jsonl none=DIR2/rides.jsonl ...

A move is the six main controls relative to the arrival (entry and exit minus the
incoming heading, turn, support over span, bias, offset), standardized per family on
the pooled arcs of every arm read, so all arms are measured on one scale.
  spread      mean distance between two random arcs of one family (bigger: more varied)
  own ride    median distance from an arc to the nearest same-family arc of its own ride
  other songs the same, against as many same-family arcs drawn from other songs
  ratio       own ride / other songs; below 1, a ride repeats itself more than songs differ
  moves/ride  24 move clusters per family on the pooled arcs; distinct clusters per ride
              (exponential of the entropy), median over rides
  moves used  clusters an arm uses at all
  motifs      share of 3-arc runs (cluster triples) that recur within the ride
Then each later arm against the first, paired by spec, with a bootstrap over specs.
Moves are controls, not rendered shapes: two controls can draw similar lines."""
import json, sys, collections
import numpy as np
from sklearn.cluster import KMeans

rng = np.random.default_rng(1)
rel = lambda c, x: [c['entry'] - x['incoming'], c['turn'], c['exit'] - x['incoming'], c['support'] / x['span'], c['bias'], c['offset']]
fam = lambda r: r['family'] + (' (unguided)' if r['guidance'] == 'forbidden' else '')
dist = lambda A, v: np.sqrt(((A - v) ** 2).sum(-1))

arms = {}
for a in sys.argv[1:]:
    name, path = a.split('=', 1)
    rides = [json.loads(l) for l in open(path)]
    arms[name] = [dict(r, spec=ride['spec'], song=ride['spec'].split('~')[0]) for ride in rides for r in ride['rows'] if r['family']]
assert len(arms) >= 1, __doc__

pool = [r for rs in arms.values() for r in rs]
for f in sorted(set(map(fam, pool))):
    xs = [r for r in pool if fam(r) == f]
    A = np.asarray([rel(r['control'], r) for r in xs])
    Z = (A - A.mean(0)) / (A.std(0) + 1e-9)
    for r, v in zip(xs, Z): r['v'] = v
    k = min(24, len(xs) // 30)
    if k >= 2:
        for r, l in zip(xs, KMeans(k, n_init=3, random_state=1).fit_predict(Z)): r['move'] = f'{f}:{l}'

summary, per = {}, {}
for name, rows in arms.items():
    spread, own, other = [], collections.defaultdict(list), collections.defaultdict(list)
    by_f = collections.defaultdict(list)
    for r in rows: by_f[fam(r)].append(r)
    for xs in by_f.values():
        A = np.asarray([r['v'] for r in xs]); spec = np.asarray([r['spec'] for r in xs]); song = np.asarray([r['song'] for r in xs])
        if len(xs) > 1:
            i, j = rng.integers(0, len(xs), (2, 4000)); keep = i != j
            spread.extend(np.sqrt(((A[i[keep]] - A[j[keep]]) ** 2).sum(-1)))
        for i in range(len(xs)):
            mine = np.flatnonzero((spec == spec[i]) & (np.arange(len(xs)) != i)); others = np.flatnonzero(song != song[i])
            if not len(mine) or len(others) < len(mine): continue
            own[spec[i]].append(dist(A[mine], A[i]).min())
            other[spec[i]].append(np.mean([dist(A[rng.choice(others, len(mine), replace=False)], A[i]).min() for _ in range(5)]))
    by_spec = collections.defaultdict(list)
    for r in rows: by_spec[r['spec']].append(r)
    per[name] = {}
    for spec, xs in by_spec.items():
        seq = [r['move'] for r in xs if 'move' in r]
        if len(seq) < 6: continue
        p = np.asarray(list(collections.Counter(seq).values())) / len(seq)
        tri = collections.Counter(tuple(seq[i:i + 3]) for i in range(len(seq) - 2))
        per[name][spec] = dict(ratio=np.median(own[spec]) / np.median(other[spec]) if own[spec] else np.nan,
                               moves=np.exp(-(p * np.log(p)).sum()), motifs=sum(v for v in tri.values() if v > 1) / (len(seq) - 2))
    allOwn, allOther = [x for v in own.values() for x in v], [x for v in other.values() for x in v]
    summary[name] = (len(rows), np.mean(spread), np.median(allOwn), np.median(allOther),
                     np.median([m['moves'] for m in per[name].values()]), len({r['move'] for r in rows if 'move' in r}),
                     np.mean([m['motifs'] for m in per[name].values()]))

print(f"{'arm':<12} {'arcs':>5} {'spread':>7} {'own ride':>9} {'other songs':>12} {'ratio':>6} {'moves/ride':>11} {'moves used':>11} {'motifs':>7}")
for name, (n, s, o, t, m, u, mo) in summary.items():
    print(f"{name:<12} {n:>5} {s:>7.2f} {o:>9.2f} {t:>12.2f} {o / t:>6.2f} {m:>11.1f} {u:>11} {mo:>7.1%}")

base = next(iter(arms))
for name in list(arms)[1:]:
    print(f"\n{name} against {base}, paired by spec (bootstrap over specs, 95%)")
    specs = sorted(set(per[base]) & set(per[name]))
    for k, label in [('ratio', 'own ride / other songs'), ('moves', 'distinct moves per ride'), ('motifs', 'recurring 3-arc motifs')]:
        d = np.asarray([per[name][s][k] - per[base][s][k] for s in specs]); d = d[~np.isnan(d)]
        bs = [rng.choice(d, len(d)).mean() for _ in range(4000)]
        print(f"  {label:<24} {d.mean():+.3f}  [{np.quantile(bs, .025):+.3f}, {np.quantile(bs, .975):+.3f}]  lower in {np.mean(d < 0):.0%} of {len(d)} rides")
