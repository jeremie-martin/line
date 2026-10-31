"""Lead-in (approach) heading against the rider's arrival heading (research only).

    python3 -I tools/measure/geometry_hygiene/leadin_angle.py ANALYSIS.json

For every section with a lead-in segment (role `approach` in analyze.ts): the
angle between the lead-in, directed from its free end to the anchor it shares
with the shaped rail, and the rider's centre-of-mass velocity two frames
before the section's beat (from the result's saved trace). Split by family and
by whether a point crossed the next section's lead-in or first faces from
their solid side before the beat (analyze.ts `through-back`, relation later).
"""
import json, sys, math, collections

rides = json.load(open(sys.argv[1]))
rows = []
for r in rides:
    x = json.load(open(r['path']))
    lines = {l['id']: l for l in x['track']['lines']}
    tr = x['trace']['frames']
    com = lambda f: (sum(tr[f][2 * p] for p in range(10)) / 10, sum(tr[f][2 * p + 1] for p in range(10)) / 10)
    crossed = {c['section'] for c in r['crossings'] if c['kind'] == 'through-back' and c['role'] in ('approach', 'main') and c['section'] > c['activeSection']}
    secs = {s['section']: s for s in r['sections']}
    for l in r['lines']:
        if l['role'] != 'approach':
            continue
        s = secs[l['section']]
        g = lines[l['id']]
        # the anchor is the endpoint shared with another main line of the section
        others = [m for m in x['track']['lines'] if (m['id'] - 1000) // 10000 == l['section'] and m['id'] != l['id']]
        ends = {(m['x1'], m['y1']) for m in others} | {(m['x2'], m['y2']) for m in others}
        if (g['x2'], g['y2']) in ends:
            dx, dy = g['x2'] - g['x1'], g['y2'] - g['y1']
        elif (g['x1'], g['y1']) in ends:
            dx, dy = g['x1'] - g['x2'], g['y1'] - g['y2']
        else:
            continue
        f = s['frame']
        if f < 3:
            continue
        a, b = com(f - 3), com(f - 2)
        vx, vy = b[0] - a[0], b[1] - a[1]
        ang = abs(math.degrees(math.atan2(dx * vy - dy * vx, dx * vx + dy * vy)))
        rows.append({'family': s['construction'], 'angle': ang, 'crossed': l['section'] in crossed, 'len': math.hypot(dx, dy)})


def q(xs, p):
    xs = sorted(xs)
    return round(xs[min(len(xs) - 1, int(p * len(xs)))], 1) if xs else None


for fam in sorted({r['family'] for r in rows}):
    xs = [r for r in rows if r['family'] == fam]
    print(f"{fam:11s} lead-ins {len(xs):4d}  angle p25/p50/p75 {q([r['angle'] for r in xs], .25)}/{q([r['angle'] for r in xs], .5)}/{q([r['angle'] for r in xs], .75)}"
          f"  crossed {sum(r['crossed'] for r in xs)}  length p50 {q([r['len'] for r in xs], .5)}")
for lo, hi in [(0, 15), (15, 30), (30, 60), (60, 181)]:
    xs = [r for r in rows if lo <= r['angle'] < hi]
    print(f"angle {lo}-{hi}: lead-ins {len(xs)}, with a lead-in crossing {sum(r['crossed'] for r in xs)} ({100 * sum(r['crossed'] for r in xs) / max(1, len(xs)):.0f}%)")
