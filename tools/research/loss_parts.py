# /// script
# requires-python = ">=3.12"
# ///
"""Where an arm's headline difference comes from: score part, stratum, catch family (report only).

  uv run --offline -q tools/research/loss_parts.py REFERENCE_ARM NAME=ARM [NAME2=ARM2 ...]

Reads saved compare arms (generated/eval/arms/<key>). Only rides present in the reference
and every arm are read; the explicit requests (E) are reported apart, as in the headline.

The production grade (scripts/gallery/contact_impact_grade.ts) is
  score = 1000 exp(-sqrt(L) / 0.25),  L = (air + speed + amplitude/3 + impact) / mass,
with air and speed the frame-weighted mean squared gap errors, impact the account's loss
(strength + timing + extra hits + missing). A ride's score difference is split over these
parts linearly at the midpoint loss: part points = dS/dL(L_mid) x (part's change in L).
The remainder (curvature) is shown. Rides then combine like the headline: seeds averaged per
spec, specs averaged per stratum, strata averaged.

Per family: the gap errors (air, speed) of each gap and the impact strength error of the
contact at its end, attributed to the family of the arc that opens the gap (an arc owns the
gap it opens and the impact at its own contact). Timing and extra hits are not split by family.
Impact strength is also split by the requested level (quiet <= 0.15, strong >= 0.6) and by
whether the hit was too soft or too hard."""
import json, math, os, sys, collections

PARTS = ['air', 'speed', 'strength', 'timing', 'extra hits']


def load(arm):
    d = os.path.join(arm, 'cells')
    return {f[:-5]: os.path.join(d, f) for f in os.listdir(d) if f.endswith('.json') and not f.endswith('.gallery.json')}


def parts(cell):
    """Each part's contribution to L, overall and per family."""
    frames = [t['frame'] for t in cell['case']['targets']]
    span = lambda i: frames[i] - (frames[i - 1] if i else 0)
    gaps = collections.defaultdict(dict)
    for g, axis, target, achieved in cell['gaps']:
        gaps[g][axis] = (achieved - target) ** 2 if achieved is not None else 1.0
    sections = cell['geometry']['sections']
    fam = lambda i: (sections[i]['family'] or 'start/end') + (' (unguided)' if sections[i].get('guidance') == 'forbidden' else '') if i < len(sections) else '?'
    imp = cell['impact3']; amp = 'amplitude' in cell['frozen']['axes']
    mass = 3 + (1 / 3 if amp else 0)
    W = sum(span(i) for i in gaps if i < len(frames))
    out = {p: 0.0 for p in PARTS}; by_f = collections.defaultdict(float); bands = collections.defaultdict(float)
    for i, axes in gaps.items():
        if i >= len(frames): continue
        for axis in ('air', 'speed'):
            if axis in axes:
                v = span(i) * axes[axis] / W / mass; out[axis] += v; by_f[fam(i)] += v
    beats = imp['perBeat']
    for i, b in enumerate(beats):
        hit = (b.get('hit') or {}).get('strength')
        v = ((hit if hit is not None else 0) - b['requested']) ** 2 / len(beats) / mass
        out['strength'] += v; by_f[fam(i)] += v
        band = 'strong (>=0.6)' if b['requested'] >= .6 else 'quiet (<=0.15)' if b['requested'] <= .15 else 'middle'
        bands[f"{band}, {'too soft' if (hit or 0) < b['requested'] else 'too hard'}"] += v
    out['timing'] = imp['timingMse'] / mass
    out['extra hits'] = (imp['extraMse'] + imp.get('missing', 0)) / mass
    # The part sums reproduce the grade's L (amplitude, when scored, is left in the remainder).
    L = cell['score']['rms'] ** 2
    return out, by_f, L, bands


def score(L): return 1000 * math.exp(-math.sqrt(L) / 0.25)


ref = sys.argv[1]; arms = dict(a.split('=', 1) for a in sys.argv[2:])
R = load(ref); common = set(R)
for a in arms.values(): common &= set(load(a))
cellsR = {k: json.load(open(R[k])) for k in common}
print(f"{len(common)} rides in common; reference {os.path.basename(ref)}")

for name, arm in arms.items():
    A = load(arm)
    rows = []  # (stratum, spec, delta, partPoints, famPoints, remainder)
    for k in sorted(common):
        a, b = json.load(open(A[k])), cellsR[k]
        if not (a['complete'] and a['score']['valid'] and b['complete'] and b['score']['valid']): continue
        pa, fa, La, ba = parts(a); pb, fb, Lb, bb = parts(b)
        Lm = (La + Lb) / 2; slope = -score(Lm) / (0.25 * 2 * math.sqrt(Lm))
        pts = {p: slope * (pa[p] - pb[p]) for p in PARTS}
        fp = {f: slope * (fa.get(f, 0) - fb.get(f, 0)) for f in set(fa) | set(fb)}
        d = a['score']['score'] - b['score']['score']
        st = b['case']['bench']['stratum']; spec = k.rsplit('~', 1)[0]
        bp = {k: slope * (ba.get(k, 0) - bb.get(k, 0)) for k in set(ba) | set(bb)}
        rows.append((st, spec, d, pts, fp, d - sum(pts.values()), bp))

    def combine(strata, get):
        per = []
        for s in strata:
            specs = collections.defaultdict(list)
            for r in rows:
                if r[0] == s: specs[r[1]].append(get(r))
            if specs: per.append(sum(sum(v) / len(v) for v in specs.values()) / len(specs))
        return sum(per) / len(per) if per else float('nan')

    strata = sorted({r[0] for r in rows if r[0] != 'E'})
    print(f"\n== {name}: headline difference {combine(strata, lambda r: r[2]):+.1f}  (explicit requests apart: {combine(['E'], lambda r: r[2]):+.1f})")
    print(f"  {'part':<12} {'headline':>9}  " + ' '.join(f"{s:>6}" for s in strata) + f"  {'E':>6}")
    for p in PARTS + ['remainder']:
        g = (lambda r: r[5]) if p == 'remainder' else (lambda r, p=p: r[3][p])
        print(f"  {p:<12} {combine(strata, g):>+9.1f}  " + ' '.join(f"{combine([s], g):>+6.1f}" for s in strata) + f"  {combine(['E'], g):>+6.1f}")
    print(f"  impact strength by requested level and direction (headline points):")
    keys = sorted({k for r in rows for k in r[6]})
    for k in keys: print(f"    {k:<32} {combine(strata, lambda r: r[6].get(k, 0)):>+7.1f}")
    fams = collections.Counter()
    for r in rows:
        for f in r[4]: fams[f] += 1
    print(f"  by family (air, speed and impact strength; headline points):")
    for f, _ in fams.most_common():
        print(f"    {f:<24} {combine(strata, lambda r: r[4].get(f, 0)):>+7.1f}")
