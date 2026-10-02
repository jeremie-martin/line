"""Render the preserved diagnostic evidence; does not choose or alter tracks."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

parser = argparse.ArgumentParser()
parser.add_argument('--source', default='generated/ride-accents-20261002')
parser.add_argument('--history', default='generated/beat-salience-history-20261002')
parser.add_argument('--out', default='docs/evidence')
args = parser.parse_args()
source, history, out = map(Path, (args.source, args.history, args.out))
out.mkdir(parents=True, exist_ok=True)


def load(path):
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == Path(str(path) + '.sha256').read_text().strip()
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data)


audit = load(source / 'audit.json')
series = {s['id']: s for s in load(source / 'frames.json.gz')['series']}
old = load(history / 'audit.json')
fig, axes = plt.subplots(2, 2, figsize=(12, 7), constrained_layout=True)
for col, (ident, title, lo, hi) in enumerate([
    ('current-tiki_tiki_48s-303', 'Tiki 303: an extra hit before the beat', 12.32, 12.85),
    ('current-luna_bala_44s-202', 'Luna 202: the same mechanism in a ripple transfer', 15.85, 16.45),
]):
    run = next(r for r in audit['runs'] if r['id'] == ident)
    assay = next(c for c in audit['causal'] if c['id'] == ident)
    fs = [f for f in series[ident]['frames'] if lo <= f['frame'] / 40 <= hi]
    top, bottom = axes[0, col], axes[1, col]
    top.plot([f['frame'] / 40 for f in fs], [f['meanImpulse'] for f in fs], color='#235a9f', label='Mean body velocity change', marker='.', ms=4)
    top.plot([f['frame'] / 40 for f in fs], [f['pointRmsImpulse'] for f in fs], color='#8a65a7', alpha=.8, label='Body-point RMS change')
    cs = assay['compared']
    top.plot([c['frame'] / 40 for c in cs], [c['withoutSelectedGuide']['meanImpulse'] for c in cs], color='#dc7518', label='Guide removed: local probe only', marker='o', ms=3)
    for ax in (top, bottom):
        ax.axvline(assay['nextAuthoredTime'], color='#1c8469', ls='--', label='Authored beat')
        ax.axvline(assay['time'], color='#b53939', ls=':', label='Guide jolt')
        ax.set_xlim(lo, hi)
        ax.spines[['top', 'right']].set_visible(False)
        ax.grid(axis='y', alpha=.2)
    top.set_title(title, loc='left', fontsize=11)
    top.set_ylabel('Velocity correction (world units/frame)')
    # The saved scored step at f+1 observes the prior solver frame. Show its
    # actual stored-velocity timestamp, not an artificially shifted curve.
    allfs = series[ident]['frames']
    sf = [f for f in allfs if lo <= (f['frame'] + 1) / 40 <= hi]
    bottom.step([(f['frame'] + 1) / 40 for f in sf], [f['nextFrameScoredStep'] if f['scoreWindows'] else 0 for f in sf],
                where='mid', color='#56616d', label='Contribution inside a scored landing window')
    bottom.set_ylabel('Scored redirection contribution')
    bottom.set_xlabel('Music time (seconds)')
    bottom.set_ylim(bottom=0)
    top.legend(fontsize=7, loc='upper right')
    bottom.legend(fontsize=7, loc='upper right')
fig.suptitle('An accurately scored landing can coexist with a larger, unscored guide collision', fontsize=14)
fig.savefig(out / 'ride-accents-examples-20261002.png', dpi=160)
plt.close(fig)

fig, axes = plt.subplots(1, 2, figsize=(12, 4.6), constrained_layout=True)
groups = [
    ('July 6 Amor', ['july-06-amor']),
    ('852-era Amor', ['arc-850-852-amor_na_praia_46s']),
    ('Current Amor\n3 seeds pooled', [f'current-amor_na_praia_46s-{s}' for s in (101, 202, 303)]),
]
data = [[b['peakOffsetMs'] for r in old['runs'] if r['id'] in ids for b in r['beats'] if b['target'] >= .5] for _, ids in groups]
axes[0].boxplot(data, showfliers=True, widths=.5)
axes[0].set_xticks(range(1, len(groups) + 1), [label for label, _ in groups])
axes[0].set_ylabel('Physical landing peak after authored beat (ms)')
axes[0].set_title('Saved Amor landings: timing distributions', loc='left', fontsize=11)
for ident, label, color in [('arc-v3-910-luna_bala_44s', '910-era Luna', '#235a9f'),
                           ('current-luna_bala_44s-101', 'Current Luna 101', '#dc7518')]:
    r = next(r for r in old['runs'] if r['id'] == ident)
    b = next(b for b in r['beats'] if b['t'] == 42.38)
    axes[1].plot([(f['frame'] / 40 - b['t']) * 1000 for f in b['physicalWindow']], [f['impulse'] for f in b['physicalWindow']],
                 marker='o', ms=4, color=color, label=f"{label}: scored impact {b['impact']:.3f}")
axes[1].axvline(0, color='#1c8469', ls='--', label='Authored beat')
axes[1].set_title('Luna 42.38 s: similar score, later physical peak', loc='left', fontsize=11)
axes[1].set_xlabel('Time after authored beat (ms)')
axes[1].set_ylabel('Mean body velocity change (world units/frame)')
axes[1].legend(fontsize=8)
for ax in axes:
    ax.spines[['top', 'right']].set_visible(False)
    ax.grid(axis='y', alpha=.2)
fig.suptitle('Historical saved geometry replayed on the same current engine', fontsize=14)
fig.savefig(out / 'historical-impact-examples-20261002.png', dpi=160)
plt.close(fig)

summary = {k: v for k, v in audit.items() if k not in ('runs', 'causal')}
summary['causal'] = [{k: v for k, v in c.items() if k != 'compared'} | {
    'atPeak': next(row for row in c['compared'] if row['frame'] == c['frame'])} for c in audit['causal']]
summary['history'] = [{k: v for k, v in r.items() if k != 'beats'} for r in old['runs']]
summary['artifacts'] = {str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in [source / 'audit.json.gz', history / 'audit.json.gz']}
summary['reporterSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
(out / 'ride-accents-summary-20261002.json').write_text(json.dumps(summary, indent=2) + '\n')
for name, path in [('ride-accents-audit-20261002.json.gz', source / 'audit.json.gz'),
                   ('historical-impact-audit-20261002.json.gz', history / 'audit.json.gz')]:
    (out / name).write_bytes(path.read_bytes())
print(json.dumps({'runs': len(audit['runs']), 'causalProbes': len(audit['causal']), 'historicalAndCurrentReplays': len(old['runs']), 'out': str(out)}))
