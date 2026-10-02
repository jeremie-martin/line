"""Publish compact evidence for the owner's named interaction examples."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

p = argparse.ArgumentParser()
p.add_argument('--source', default='generated/tiki-interactions-20261002')
p.add_argument('--out', default='docs/evidence')
args = p.parse_args()
source, out = Path(args.source), Path(args.out)
out.mkdir(parents=True, exist_ok=True)
data = (source / 'audit.json').read_bytes()
assert hashlib.sha256(data).hexdigest() == (source / 'audit.json.sha256').read_text().strip()
audit = json.loads(data)
runs = {r['seed']: r for r in audit['focused']}
captures = json.loads((source / 'browser-detail-check.json').read_text())
assert captures['errors'] == [] and captures['zoom'] == 3 and captures['nativeRenderer']

examples = [
    (303, 12.32, 12.8, 12.45, 'Extra upper hit confirmed by owner', '15:guide', 15),
    (303, 13.8, 14.4, 13.95, 'Cleaner lower landing confirmed by owner', '19:main', 18),
    (101, 13.8, 14.5, 14.25, 'Appealing transfer: lower landing, then upper receiver', '19:guide', 18),
    (101, 14.7, 15.13, 14.95, 'Two distinct interactions partly merged into one impact', '20:guide', 19),
]
fig, axes = plt.subplots(4, 2, figsize=(13, 12), gridspec_kw={'width_ratios': [1, 1.3]}, constrained_layout=True)
for (seed, lo, hi, still, title, group, beat), (left, right) in zip(examples, axes):
    r = runs[seed]
    frames = [f for f in r['frames'] if lo <= f['time'] <= hi]
    image = source / f'detail-{seed}-{still:.3f}.png'
    shot = next(s for s in captures['shots'] if s['name'] == image.name)
    assert hashlib.sha256(image.read_bytes()).hexdigest() == shot['sha256']
    left.imshow(plt.imread(image))
    left.axis('off')
    left.set_title(f'Tiki {seed} · native rider at {still:.3f} s', fontsize=10, loc='left')
    right.plot([f['time'] for f in frames], [f['meanImpulse'] for f in frames], color='#235a9f', marker='.', label='Physical body correction')
    # Keep stored-score timestamp; do not slide the scored curve to match physics.
    right.step([f['time'] for f in frames], [f['scoreStep'] if f['scoreWindows'] else 0 for f in frames],
               color='#888888', where='mid', label='Scored landing contribution')
    for e in r['episodes']:
        if e['holes'] == 0 and e['group'] == group:
            right.axvspan(e['first'] / 40, (e['last'] + 1) / 40, color='#ce7d32', alpha=.13)
    b = next(b for b in r['beats'] if b['index'] == beat)
    right.axvline(b['authoredTime'], color='#18826c', ls='--', label='Authored beat')
    right.axvline(still, color='#b34263', ls=':', label='Shown frame')
    right.set_title(title, fontsize=10, loc='left')
    right.set_xlim(lo, hi)
    right.set_ylim(bottom=0)
    right.set_xlabel('Music time (seconds)')
    right.set_ylabel('World units/frame')
    right.spines[['top', 'right']].set_visible(False)
    right.grid(axis='y', alpha=.2)
    right.legend(fontsize=7, loc='upper right')
fig.suptitle('Physical interactions and landing-score bookkeeping are different observations', fontsize=14)
fig.savefig(out / 'interaction-roles-examples-20261002.png', dpi=140)
plt.close(fig)

# Keep the full focused audit: raw full-ride data and screenshot sets stay local.
(out / 'interaction-roles-audit-20261002.json.gz').write_bytes(gzip.compress(data, mtime=0))
summary = {
    'schema': audit['schema'],
    'sourceAuditSha256': hashlib.sha256(data).hexdigest(),
    'notes': audit['notes'],
    'nativeStills': captures,
    'focused': [{k: v for k, v in r.items() if k not in ['frames', 'assays']} | {
        'assays': [{k: v for k, v in a.items() if k not in ['compared', 'removed']} | {'removedSegments': len(a['removed'])} for a in r['assays']]
    } for r in audit['focused']],
    'poseScreen': {
        'records': len(audit['poseScreen']),
        'uniqueTracks': len({r['trackHash'] for r in audit['poseScreen']}),
        'episodesIncludingRepeatedTracks': sum(len(r['episodes']) for r in audit['poseScreen']),
        'longestConsecutiveFrames': max(e['frames'] for r in audit['poseScreen'] for e in r['episodes']),
        'limitation': 'Brief inverted-contact candidates, not proof of sustained overhead skiing. This pose screen excludes tilted/vertical variants and uses saved tracks rather than a new search.',
    },
    'contract': audit['contract'],
}
(out / 'interaction-roles-summary-20261002.json').write_text(json.dumps(summary, indent=2) + '\n')
for name in ['interaction-roles-audit-20261002.json.gz', 'interaction-roles-summary-20261002.json', 'interaction-roles-examples-20261002.png']:
    artifact = out / name
    Path(str(artifact) + '.sha256').write_text(hashlib.sha256(artifact.read_bytes()).hexdigest() + '\n')
print(json.dumps(summary['poseScreen']))
