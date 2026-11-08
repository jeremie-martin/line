# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Variety of the committed moves, per arm (report only, never a target; unvalidated
until compared with the owner's eye in a blind pairwise study).

  uv run --offline -q tools/research/move_variety.py NAME=INPUT NAME2=INPUT2 ...

Each INPUT is either
  - a candidate_origins.ts study (rides.jsonl): a move is its CONTROLS, the six main
    controls relative to the arrival (entry and exit minus the incoming heading, turn,
    support over span, bias, offset);
  - a saved compare arm (generated/eval/arms/<key>): a move is its DRAWN LINE, the
    direction of the arc's main line (guides left out) at 16 points evenly spaced along
    it, in the world frame, so size does not count. The line's length is reported apart.
    Only rides every arm has are read.
Every component is standardized per family on the pooled arcs of every arm read, so all
arms are measured on one scale.
  spread      mean distance between two random arcs of one family (bigger: more varied)
  own ride    median distance from an arc to the nearest same-family arc of its own ride
  other songs the same, against as many same-family arcs drawn from other songs
  ratio       own ride / other songs; below 1, a ride repeats itself more than songs differ
  moves/ride  24 move clusters per family on the pooled arcs; distinct clusters per ride
              (exponential of the entropy), median over rides
  moves used  clusters an arm uses at all
  motifs      share of 3-arc runs (cluster triples) that recur within the ride
Then each later arm against the first, paired by ride, with a bootstrap over rides."""
import gzip, json, os, sys, collections
import numpy as np
from sklearn.cluster import KMeans

rng = np.random.default_rng(1)
dist = lambda A, v: np.sqrt(((A - v) ** 2).sum(-1))
family = lambda construction, guidance: construction + (' (unguided)' if guidance == 'forbidden' else '')


def controls(path):
    rel = lambda c, x: [c['entry'] - x['incoming'], c['turn'], c['exit'] - x['incoming'], c['support'] / x['span'], c['bias'], c['offset']]
    for line in open(path):
        ride = json.loads(line)
        for r in ride['rows']:
            if r['family']: yield dict(ride=ride['spec'], song=ride['spec'].split('~')[0], family=family(r['family'], r['guidance']), x=rel(r['control'], r))


def main_chain(lines):
    """The longest connected run of an arc's main lines, as points."""
    chains, last = [], None
    for l in sorted(lines, key=lambda l: l['id']):
        if last is None or abs(l['x1'] - last['x2']) + abs(l['y1'] - last['y2']) > 1e-6: chains.append([(l['x1'], l['y1'])])
        chains[-1].append((l['x2'], l['y2'])); last = l
    return max((np.asarray(c) for c in chains), key=lambda c: np.linalg.norm(np.diff(c, axis=0), axis=1).sum())


def shape(points, n=16):
    seg = np.linalg.norm(np.diff(points, axis=0), axis=1); s = np.concatenate([[0], np.cumsum(seg)])
    t = np.linspace(0, s[-1], n + 1); p = np.stack([np.interp(t, s, points[:, 0]), np.interp(t, s, points[:, 1])], 1)
    d = np.diff(p, axis=0); a = np.arctan2(d[:, 1], d[:, 0])
    return np.concatenate([np.cos(a), np.sin(a)]), s[-1]


def drawn(armdir, rides):
    for ride in rides:
        g = json.load(gzip.open(os.path.join(armdir, 'cells', ride + '.gallery.json.gz')))
        requests = {r['section']: r for r in g['production']['plan']['requests']}
        guides = {i for ids in g['production'].get('railGuides', {}).values() for i in ids}
        by_section = collections.defaultdict(list)
        for l in g['result']['track']['lines']:
            if l['id'] not in guides: by_section[(l['id'] - 1000) // 10000].append(l)
        for section, lines in by_section.items():
            r = requests.get(section)
            if not r or not r.get('construction') or len(lines) < 2: continue
            x, length = shape(main_chain(lines))
            yield dict(ride=ride, song=ride.split('~')[0], family=family(r['construction'], r.get('guidance')), x=x, length=length)


inputs = dict(a.split('=', 1) for a in sys.argv[1:])
assert inputs, __doc__
dirs = [p for p in inputs.values() if os.path.isdir(p)]
common = set.intersection(*[{f[:-len('.gallery.json.gz')] for f in os.listdir(os.path.join(p, 'cells')) if f.endswith('.gallery.json.gz')} for p in dirs]) if dirs else set()
arms = {name: list(drawn(p, sorted(common)) if os.path.isdir(p) else controls(p)) for name, p in inputs.items()}

pool = [r for rs in arms.values() for r in rs]
for f in sorted({r['family'] for r in pool}):
    xs = [r for r in pool if r['family'] == f]
    A = np.asarray([r['x'] for r in xs]); Z = (A - A.mean(0)) / (A.std(0) + 1e-9)
    for r, v in zip(xs, Z): r['v'] = v
    k = min(24, len(xs) // 30)
    if k >= 2:
        for r, l in zip(xs, KMeans(k, n_init=3, random_state=1).fit_predict(Z)): r['move'] = f'{f}:{l}'

summary, per, fam_ratio = {}, {}, collections.defaultdict(dict)
for name, rows in arms.items():
    spread, own, other = [], collections.defaultdict(list), collections.defaultdict(list)
    by_f = collections.defaultdict(list)
    for r in rows: by_f[r['family']].append(r)
    for xs in by_f.values():
        A = np.asarray([r['v'] for r in xs]); ride = np.asarray([r['ride'] for r in xs]); song = np.asarray([r['song'] for r in xs])
        if len(xs) > 1:
            i, j = rng.integers(0, len(xs), (2, 4000)); keep = i != j
            spread.extend(np.sqrt(((A[i[keep]] - A[j[keep]]) ** 2).sum(-1)))
        for i in range(len(xs)):
            mine = np.flatnonzero((ride == ride[i]) & (np.arange(len(xs)) != i)); others = np.flatnonzero(song != song[i])
            if not len(mine) or len(others) < len(mine): continue
            own[ride[i]].append(dist(A[mine], A[i]).min())
            other[ride[i]].append(np.mean([dist(A[rng.choice(others, len(mine), replace=False)], A[i]).min() for _ in range(5)]))
            own[(xs[i]['family'], 'all')].append(own[ride[i]][-1]); other[(xs[i]['family'], 'all')].append(other[ride[i]][-1])
        f = xs[0]['family']
        per_ride = collections.Counter(r['ride'] for r in xs)
        moves = [np.exp(-(p * np.log(p)).sum()) for rd in per_ride if per_ride[rd] >= 6
                 for p in [np.asarray(list(collections.Counter(r['move'] for r in xs if r['ride'] == rd and 'move' in r).values()), float)]
                 for p in [p / p.sum()]]
        if own[(f, 'all')]: fam_ratio[f][name] = (len(xs), np.median(own[(f, 'all')]) / np.median(other[(f, 'all')]), np.median(moves) if moves else np.nan)
    by_ride = collections.defaultdict(list)
    for r in rows: by_ride[r['ride']].append(r)
    per[name] = {}
    for ride, xs in by_ride.items():
        seq = [r['move'] for r in xs if 'move' in r]
        if len(seq) < 6: continue
        p = np.asarray(list(collections.Counter(seq).values())) / len(seq)
        tri = collections.Counter(tuple(seq[i:i + 3]) for i in range(len(seq) - 2))
        per[name][ride] = dict(ratio=np.median(own[ride]) / np.median(other[ride]) if own[ride] else np.nan,
                               moves=np.exp(-(p * np.log(p)).sum()), motifs=sum(v for v in tri.values() if v > 1) / (len(seq) - 2))
    allOwn = [x for k, v in own.items() if not isinstance(k, tuple) for x in v]
    allOther = [x for k, v in other.items() if not isinstance(k, tuple) for x in v]
    lengths = [r['length'] for r in rows if 'length' in r]
    summary[name] = (len(by_ride), len(rows), np.mean(spread), np.median(allOwn), np.median(allOther),
                     np.median([m['moves'] for m in per[name].values()]), len({r['move'] for r in rows if 'move' in r}),
                     np.mean([m['motifs'] for m in per[name].values()]),
                     f"{np.median(lengths):.0f} ({np.quantile(lengths, .25):.0f}–{np.quantile(lengths, .75):.0f})" if lengths else '')

print(f"{'arm':<12} {'rides':>5} {'arcs':>6} {'spread':>7} {'own ride':>9} {'other songs':>12} {'ratio':>6} {'moves/ride':>11} {'moves used':>11} {'motifs':>7}  line length")
for name, (nr, n, s, o, t, m, u, mo, ln) in summary.items():
    print(f"{name:<12} {nr:>5} {n:>6} {s:>7.2f} {o:>9.2f} {t:>12.2f} {o / t:>6.2f} {m:>11.1f} {u:>11} {mo:>7.1%}  {ln}")

print(f"\nper family: arcs, ratio (own ride / other songs), distinct moves per ride (rides with 6+ arcs of the family)")
print(f"  {'family':<22} " + ''.join(f"{n:>24}" for n in arms))
for f in sorted(fam_ratio, key=lambda f: -max(v[0] for v in fam_ratio[f].values())):
    print(f"  {f:<22} " + ''.join(f"{'%5d  %.2f  %5.1f' % fam_ratio[f][n] if n in fam_ratio[f] else '':>24}" for n in arms))

base = next(iter(arms))
for name in list(arms)[1:]:
    print(f"\n{name} against {base}, paired by ride (bootstrap over rides, 95%)")
    rides = sorted(set(per[base]) & set(per[name]))
    for k, label in [('ratio', 'own ride / other songs'), ('moves', 'distinct moves per ride'), ('motifs', 'recurring 3-arc motifs')]:
        d = np.asarray([per[name][s][k] - per[base][s][k] for s in rides]); d = d[~np.isnan(d)]
        bs = [rng.choice(d, len(d)).mean() for _ in range(4000)]
        print(f"  {label:<24} {d.mean():+.3f}  [{np.quantile(bs, .025):+.3f}, {np.quantile(bs, .975):+.3f}]  lower in {np.mean(d < 0):.0%} of {len(d)} rides")
