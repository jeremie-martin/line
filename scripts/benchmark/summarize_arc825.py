"""Verify and compact the immutable Arc 825 research panels (not promotion)."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--root', default='generated/benchmark-v2/arc-825')
parser.add_argument('--reference', default='generated/benchmark-v2/compiler-integrity-audit/retry-anchor-750000')
parser.add_argument('--out', default='benchmark/v2/studies/arc-825-research.json')
args = parser.parse_args()
root, reference = Path(args.root), Path(args.reference)


def checked(path):
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().strip(), path
    return json.loads(body), digest


panels = []
for directory in sorted(root.iterdir()):
    if not directory.is_dir() or not (directory / 'plan.json').exists():
        continue
    plan, plan_hash = checked(directory / 'plan.json')
    if plan.get('mode') != 'compile' or not (directory / 'summary.json').exists():
        continue
    summary, summary_hash = checked(directory / 'summary.json')
    rows = []
    for source in plan['sourceIds']:
        record, record_hash = checked(directory / f'{source}.json')
        before, before_hash = checked(reference / f'{source}.json')
        assert record['sourceId'] == source and record['seed'] == plan['seed']
        assert all(record['implementation'].get(k) == v for k, v in plan['implementation'].items()
                   if not k.startswith('/'))
        assert record['stats']['sim_frames'] <= record['budget'] == plan['budget']
        rows.append(dict(source=source, sha256=record_hash, referenceSha256=before_hash,
                         score=record['score']['score'], valid=record['score']['valid'],
                         delta=record['score']['score'] - before['score']['score'],
                         frames=record['stats']['sim_frames'],
                         referenceFrames=before['stats']['sim_frames'],
                         memo=record.get('candidateMemo'), planning=record.get('lookaheadStats'),
                         failure=record.get('failure')))
    assert len(rows) == summary['sources']
    assert sum(r['valid'] for r in rows) == summary['valid']
    assert sum(r['frames'] for r in rows) == summary['totalFrames']
    panels.append(dict(name=directory.name, planSha256=plan_hash, summarySha256=summary_hash,
                       options=plan['options'], budget=plan['budget'], seed=plan['seed'],
                       sources=len(rows), valid=summary['valid'],
                       exploratoryHeadline=summary['score']['score'] if summary['score'] else None,
                       pilotMean=summary['exploratoryMean'],
                       meanDelta=sum(r['delta'] for r in rows) / len(rows),
                       totalFrames=summary['totalFrames'], maxFrames=summary['maxFrames'], rows=rows))

result = dict(schema='line.arc-825-research.v1', researchOnly=True,
              reference='compiler-integrity canonical 777.8193; exact-parity rich 750k reference',
              note='Pilot means are screening evidence. Full-suite headlines use the unchanged weighted '
                   'summarizer, one seed per case, and are not canonical confirmation. '
                   'Higher-budget trials are research teachers, not 750k results.',
              panels=panels)
output = Path(args.out)
output.parent.mkdir(parents=True, exist_ok=True)
body = (json.dumps(result, indent=2) + '\n').encode()
output.write_bytes(body)
Path(str(output) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')
print(json.dumps(dict(panels=len(panels), path=str(output), bytes=len(body))))
