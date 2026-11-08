# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1"]
# ///
"""How the strong beats are caught, per arm (report only).

  uv run --offline -q tools/research/strong_catches.py NAME=ORIGINS_DIR:ARM_DIR [NAME2=...]

ORIGINS_DIR is a candidate_origins.ts study (committed rows with controls, situation
features and root sources); ARM_DIR the saved compare arm with the same tracks (the study
checks identity), which holds each beat's requested and achieved strength.

Beat j is the landing on arc j + 1 (row j + 1 owns its impact); row j is the arc before,
which sets the arrival. For each beat requested at 0.6 or more:
  achieved      the impact account's strength (0 when no event matched)
  arrival speed feature 2 of the landing row (the rider's speed at the catch, compiler units)
  incidence     entry - incoming of the landing arc (degrees): how steeply the arc meets the rider
  turn, exit    the landing arc's turn and exit - incoming
  air before    the flight before the catch, in frames (row j's release to the beat)
  heading, pose the arrival's heading (degrees, positive descending) and the sled's pose
                (features 0-1 and 3-4 of the landing row)
  sources       root source of the landing arc and of the arc before
Then how much of the achieved strength simple linear fits explain; a pairing of the first two
arms beat by beat (which beats only one of them catches short, and how those catches look);
the arrival heading bands (composition against conversion); a straight-line rule for the
first arm’s landing controls; and a linear fit of achieved on arrival speed and incidence (pooled over arms) splits each
arm's mean difference from the first arm into the part from arrival speed, the part from
incidence, and the rest."""
import json, os, sys, collections
import numpy as np


def load(spec):
    name, paths = spec.split('=', 1); odir, adir = paths.split(':', 1)
    out = []
    for line in open(os.path.join(odir, 'rides.jsonl')):
        ride = json.loads(line)
        cell = json.load(open(os.path.join(adir, 'cells', f"{ride['spec']}~{ride['seed']}.json")))
        assert cell['trackHash'] == ride['trackHash'], ride['spec']
        rows, beats = ride['rows'], cell['impact3']['perBeat']
        for j, b in enumerate(beats):
            if b['requested'] < .6 or j + 1 >= len(rows): continue
            r, p = rows[j + 1], rows[j]
            hit = (b.get('hit') or {}).get('strength')
            c = r['control']
            f = r['features']
            out.append(dict(ride=ride['spec'], j=j, requested=b['requested'], achieved=hit or 0.0, matched=hit is not None,
                            heading=float(np.degrees(np.arctan2(f[0], f[1]))), pose=float(np.degrees(np.arctan2(f[3], f[4]))),
                            head_down=bool((b.get('hit') or {}).get('headDown')), side=c.get('contactSide'),
                            speed=r['features'][2], incidence=c['entry'] - r['incoming'], turn=c['turn'], exit=c['exit'] - r['incoming'],
                            air=(r['frame'] - p['frame']), family=r['family'] or '-', prev_family=p['family'] or '-',
                            source=r['origin'].split('>')[0], prev_source=p['origin'].split('>')[0]))
    return name, out


arms = dict(load(a) for a in sys.argv[1:])
q = lambda xs, p: float(np.quantile(xs, p))
med = lambda xs: f"{q(xs, .5):6.2f} ({q(xs, .25):.2f}–{q(xs, .75):.2f})"
print(f"{'arm':<10} {'strong beats':>12} {'requested':>10} {'achieved, median (quartiles)':>30} {'short by >0.2':>14} {'unmatched':>10}")
for n, xs in arms.items():
    a = np.asarray([x['achieved'] for x in xs]); rq = np.asarray([x['requested'] for x in xs])
    print(f"{n:<10} {len(xs):>12} {rq.mean():>10.2f} {med(a):>30} {np.mean(a < rq - .2):>14.0%} {np.mean([not x['matched'] for x in xs]):>10.0%}")

print(f"\n{'arm':<10} {'arrival speed':>22} {'incidence (deg)':>22} {'turn':>22} {'exit':>22} {'flight before (frames)':>24}")
for n, xs in arms.items():
    print(f"{n:<10} " + ' '.join(f"{med([x[k] for x in xs]):>22}" for k in ['speed', 'incidence', 'turn', 'exit']) + f" {med([x['air'] for x in xs]):>24}")

pool = [x for xs in arms.values() for x in xs]
y = np.asarray([x['achieved'] for x in pool])
def r2(cols):
    X = np.asarray([[1] + [x[c] for c in cols] for x in pool]); b, *_ = np.linalg.lstsq(X, y, rcond=None)
    return 1 - ((y - X @ b) ** 2).mean() / y.var()
print('\nshare of the achieved strength explained by a linear fit, pooled over arms:')
for cols in [['speed'], ['incidence'], ['speed', 'incidence'], ['heading'], ['pose'], ['turn'], ['heading', 'pose'], ['heading', 'pose', 'turn'], ['speed', 'heading', 'pose', 'turn', 'incidence', 'requested']]:
    print(f"  {' + '.join(cols):<52} R² {r2(cols):.2f}")
X = np.asarray([[1, x['speed'], x['incidence'], x['speed'] * x['incidence']] for x in pool])
beta, *_ = np.linalg.lstsq(X, y, rcond=None)
print('achieved ~ speed, incidence and their product, used for the split below')
base = next(iter(arms))
B = arms[base]; mb = lambda k, xs: np.mean([x[k] for x in xs])
fit = lambda s, i: beta[0] + beta[1] * s + beta[2] * i + beta[3] * s * i
for n, xs in list(arms.items())[1:]:
    d = mb('achieved', xs) - mb('achieved', B)
    sB, iB, sA, iA = mb('speed', B), mb('incidence', B), mb('speed', xs), mb('incidence', xs)
    from_speed = (fit(sA, iB) - fit(sB, iB) + fit(sA, iA) - fit(sB, iA)) / 2
    from_inc = (fit(sB, iA) - fit(sB, iB) + fit(sA, iA) - fit(sA, iB)) / 2
    print(f"  {n} against {base}: mean achieved {d:+.3f} = arrival speed {from_speed:+.3f} + incidence {from_inc:+.3f} + rest {d - from_speed - from_inc:+.3f}")

if len(arms) >= 2:
    (n1, A1), (n2, A2) = list(arms.items())[:2]
    I1, I2 = {(x['ride'], x['j']): x for x in A1}, {(x['ride'], x['j']): x for x in A2}
    keys = sorted(set(I1) & set(I2)); short = lambda x: x['achieved'] < x['requested'] - .2
    groups = {'both fine': [k for k in keys if not short(I1[k]) and not short(I2[k])], f'only {n2} short': [k for k in keys if short(I2[k]) and not short(I1[k])],
              f'only {n1} short': [k for k in keys if short(I1[k]) and not short(I2[k])], 'both short': [k for k in keys if short(I1[k]) and short(I2[k])]}
    F = ['achieved', 'speed', 'heading', 'pose', 'incidence', 'turn', 'air']
    print(f"\n== Paired strong beats, {n1} against {n2} (short: more than 0.2 under the request; medians)")
    print(f"  {'group':<22} {'beats':>5} {'arm':<9} " + ' '.join(f"{f:>9}" for f in F) + f" {'head down':>10} {'side -1':>8}")
    for g, ks in groups.items():
        for n, I in [(n1, I1), (n2, I2)]:
            xs = [I[k] for k in ks]
            if not xs: continue
            print(f"  {g:<22} {len(xs):>5} {n:<9} " + ' '.join(f"{np.median([x[f] for x in xs]):>9.2f}" for f in F) +
                  f" {np.mean([x['head_down'] for x in xs]):>10.0%} {np.mean([x['side'] == -1 for x in xs]):>8.0%}")

for n, xs in arms.items():
    print(f"\n== {n}: strong beats by root source of the landing arc and of the arc before (share, median achieved)")
    for key in ['source', 'prev_source']:
        c = collections.defaultdict(list)
        for x in xs: c[x[key]].append(x['achieved'])
        print(f"  {'landing arc' if key == 'source' else 'arc before':<12} " + ', '.join(f"{k} {len(v) / len(xs):.0%} ({np.median(v):.2f})" for k, v in sorted(c.items(), key=lambda kv: -len(kv[1]))))
    c = collections.defaultdict(list)
    for x in xs: c[x['family']].append(x['achieved'])
    print(f"  {'family':<12} " + ', '.join(f"{k} {len(v)} ({np.median(v):.2f})" for k, v in sorted(c.items(), key=lambda kv: -len(kv[1]))))

# Arrival steepness: how often each arm arrives at a strong beat in each heading band, and how
# often it then falls short there (composition against conversion).
BANDS = [(-90, 15), (15, 25), (25, 35), (35, 45), (45, 90)]
print('\n== Arrival heading at strong beats (degrees descending): share of beats, then share short by more than 0.2')
print(f"  {'arm':<10} " + ' '.join(f"{f'[{lo},{hi})':>16}" for lo, hi in BANDS) + f" {'short, all':>11} {'short at first arm’s headings':>30}")
rate = {}
for n, xs in arms.items():
    H = np.asarray([x['heading'] for x in xs]); S = np.asarray([x['achieved'] < x['requested'] - .2 for x in xs])
    share = [np.mean((H >= lo) & (H < hi)) for lo, hi in BANDS]; rate[n] = [S[(H >= lo) & (H < hi)].mean() if ((H >= lo) & (H < hi)).any() else 0 for lo, hi in BANDS]
    if n == base: base_share = share
    print(f"  {n:<10} " + ' '.join(f"{s:>8.0%} {r:>6.0%} " for s, r in zip(share, rate[n])) + f" {S.mean():>11.0%} {sum(s * r for s, r in zip(base_share, rate[n])):>30.0%}")

# Is there a straight-line recipe? Fit the first arm's landing controls on beats it hits within
# 0.1 of the request (every requested level) from a few named inputs of the situation.
print(f'\n== Straight-line rule for the {base} arm’s landing controls (beats hit within 0.1 of the request): R²')
def recipe(odir, adir):
    out = []
    for line in open(os.path.join(odir, 'rides.jsonl')):
        ride = json.loads(line); cell = json.load(open(os.path.join(adir, 'cells', f"{ride['spec']}~{ride['seed']}.json")))
        rows, beats = ride['rows'], cell['impact3']['perBeat']
        for j, b in enumerate(beats):
            if j + 1 >= len(rows): continue
            r = rows[j + 1]; f = r['features']; c = r['control']; ach = (b.get('hit') or {}).get('strength') or 0
            if abs(ach - b['requested']) < .1:
                out.append(dict(requested=b['requested'], heading=float(np.degrees(np.arctan2(f[0], f[1]))), speed=f[2], pose=float(np.degrees(np.arctan2(f[3], f[4]))),
                                duration=f[47], next_duration=f[52], next_impact=f[53], entry=c['entry'] - r['incoming'], turn=c['turn'], exit=c['exit'] - r['incoming'], support=c['support'] / r['span']))
    return out
first = sys.argv[1].split('=', 1)[1].split(':', 1)
good = recipe(*first)
for cols in [['requested'], ['requested', 'heading', 'speed'], ['requested', 'heading', 'speed', 'pose', 'duration', 'next_duration', 'next_impact']]:
    X = np.asarray([[1] + [x[c] for c in cols] for x in good])
    print(f"  {' + '.join(cols):<80} " + '  '.join(f"{o} {1 - ((np.asarray([x[o] for x in good]) - X @ np.linalg.lstsq(X, np.asarray([x[o] for x in good]), rcond=None)[0]) ** 2).mean() / np.var([x[o] for x in good]):.2f}" for o in ['entry', 'turn', 'exit', 'support']))
