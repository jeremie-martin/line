"""Draw a ride moment for the geometry hygiene study (research only).

    python3 -I tools/measure/geometry_hygiene/plot_event.py RIDE-production.json FRAME OUT.png [--before=3] [--after=3] [--zoom=1]

Lines near the rider, coloured by role (main black, guide or receiver blue,
other sections grey); short ticks point into each line's solid side (where a
point moving into it would collide). The rider's bones are drawn at each
frame from FRAME-before to FRAME+after, darker at FRAME. Positions come from
the result's saved trace (identical to a native replay, checked in analyze.ts).
"""
import json, sys, math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=') for a in sys.argv[1:] if a.startswith('--'))
path, frame, out = args[0], int(args[1]), args[2]
before, after = int(opt.get('before', 3)), int(opt.get('after', 3))
r = json.load(open(path))
lines = r['track']['lines']
guides = {i for ids in (r['production'].get('railGuides') or r['railGuides'] or {}).values() for i in ids}
reqs = r['production']['plan']['requests']
trace = r['trace']['frames']
BONES = [(0, 1), (1, 2), (2, 3), (4, 5), (5, 6), (5, 7), (4, 8), (4, 9)]
section_at = next((q['section'] for q in reqs if q['frame'] <= frame < q['next']), None)
pts = [(trace[f][2 * p], trace[f][2 * p + 1]) for f in range(max(0, frame - before), min(len(trace), frame + after + 1)) for p in range(10)]
cx = sum(x for x, _ in pts) / len(pts); cy = sum(y for _, y in pts) / len(pts)
R = 45 / float(opt.get('zoom', 1))
fig, ax = plt.subplots(figsize=(7, 7))
for l in lines:
    if max(l['x1'], l['x2']) < cx - R or min(l['x1'], l['x2']) > cx + R or max(l['y1'], l['y2']) < cy - R or min(l['y1'], l['y2']) > cy + R:
        continue
    s = (l['id'] - 1000) // 10000
    role = 'guide' if l['id'] in guides else 'main'
    if reqs[s].get('railLayout') == 'transfer' and role == 'guide':
        role = 'receiver'
    col = ('#1f5fbf' if role != 'main' else 'black') if s == section_at else ('#7aa7e0' if role != 'main' else '#888888')
    ax.plot([l['x1'], l['x2']], [l['y1'], l['y2']], color=col, lw=1.6)
    vx, vy = l['x2'] - l['x1'], l['y2'] - l['y1']; n = math.hypot(vx, vy) or 1
    sg = -1 if l.get('flipped') else 1
    nx, ny = -vy / n * sg, vx / n * sg
    mx, my = (l['x1'] + l['x2']) / 2, (l['y1'] + l['y2']) / 2
    ax.plot([mx, mx + nx * 1.5], [my, my + ny * 1.5], color=col, lw=.6)
for f in range(max(0, frame - before), min(len(trace), frame + after + 1)):
    a = 1.0 if f == frame else .25 + .5 * (1 - abs(f - frame) / (max(before, after) + 1))
    c = '#d62728' if f == frame else ('#ff9896' if f < frame else '#98df8a')
    for i, j in BONES:
        ax.plot([trace[f][2 * i], trace[f][2 * j]], [trace[f][2 * i + 1], trace[f][2 * j + 1]], color=c, alpha=a, lw=1.2)
NAMES = ['PEG', 'TAIL', 'NOSE', 'STRING', 'BUTT', 'SHOULDER', 'RHAND', 'LHAND', 'LFOOT', 'RFOOT']
if opt.get('labels'):
    for f in [int(x) for x in opt['labels'].split(',')]:
        for p in range(10):
            ax.annotate(f"{NAMES[p]}@{f}", (trace[f][2 * p], trace[f][2 * p + 1]), fontsize=5, color='#555555')
ax.set_xlim(cx - R, cx + R); ax.set_ylim(cy + R, cy - R); ax.set_aspect('equal')
ax.set_title(f"{r['case']['song']} {r['seed']} frame {frame} ({frame / 40:.3f} s), section {section_at}: "
             f"{reqs[section_at]['construction']}/{reqs[section_at]['guidance']}/{reqs[section_at].get('railLayout')}", fontsize=8)
fig.savefig(out, dpi=110, bbox_inches='tight')
