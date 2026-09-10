"""Audit exact control transfer and the complete, physically metered preview study."""
import gzip
import hashlib
import json
import statistics
from collections import Counter
from pathlib import Path

root = Path('generated/benchmark-v4/arc-940')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def checked(path):
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == Path(str(path)+'.sha256').read_text().strip(), path
    return json.loads(gzip.decompress(raw) if path.suffix == '.gz' else raw)

old_data = checked(root/'data/rollout-949/data.json')
data = checked(root/'data/rollout-949-reference/data.json')
assert len(data['rows']) == len(old_data['rows']) == 16138
for old, row in zip(old_data['rows'], data['rows']):
    assert old == {k:v for k,v in row.items() if k not in ['incoming','span']}
policy = checked(root/'models/rollout-949-reference/policy.json')
original = checked(root/'models/rollout-949/policy.json')
for startup in [False, True]:
    library = policy['startupModel'] if startup else policy
    rows = [row for row in data['rows'] if (row['index'] == 0) == startup]
    assert len(rows) == len(library['exemplars'])
    for row, example in zip(rows, library['exemplars']):
        assert example['controlReference'] == {k:row[k] for k in ['control','incoming','span']}
        del example['controlReference']
del policy['provenance']['controlReferences']
assert policy == original, 'retrieval parameters, values or ordering changed'
package = checked(root/'models/preview-949/reconstructed/proof.json')

studies = []
for name in ['policy-rollout-949','policy-rollout-949-reference','policy-preview-949']:
    path = root/'full'/name/'run.json.gz'
    run = checked(path)
    assert len(run['rows']) == 176 and run['plan']['budget'] == 750000
    rows = []
    for row in run['rows']:
        cell_path = path.parent/(row['sourceId']+'.json.gz')
        cell = checked(cell_path)
        frames = cell['stats']['sim_frames']
        assert frames == row['resources']['physicalFrames'] and 0 <= frames <= 750000
        assert cell['trackHash'] == row['trackHash']
        assert all(line['type'] == 0 for line in cell['track']['lines'])
        preview = cell.get('policyPreviewStats')
        if preview:
            assert preview['previewFrames'] + preview['searchFrames'] == frames == preview['totalFrames']
            assert preview['previewFrames'] <= 37500
            # JSON represents an incomplete track's infinite loss as null.
            losses = {k:(preview[k+'Loss'] if preview[k+'Loss'] is not None else float('inf')) for k in ['preview','search']}
            assert preview['selected'] == ('preview' if losses['preview'] < losses['search'] else 'search')
        rows.append(dict(source=row['sourceId'], valid=row['score']['valid'],
            physicalFrames=frames, recordSha256=digest(cell_path),
            rollout=cell.get('policyRolloutStats'), preview=preview))
    frames = [r['physicalFrames'] for r in rows]
    studies.append(dict(name=name, runSha256=digest(path), planSha256=digest(path.parent/'plan.json'),
        headline=run['summary']['headline'], valid=sum(r['valid'] for r in rows),
        totalFrames=sum(frames), medianFrames=statistics.median(frames), maxFrames=max(frames),
        selected=dict(Counter(r['preview']['selected'] for r in rows if r['preview'])), rows=rows))

# Preserve the rejected standalone rollout's adverse diagnostic, including the
# original implementation hashes. That earlier integration snapshot is no
# longer the live checkout, so this audit checks raw records, not current code.
directory = root/'jitter/policy-rollout-949-reference'
plan = checked(directory/'plan.json')
summary = checked(directory/'summary.json')
cells = [checked(directory/f'{source}-{seed}.json') for source in plan['sources'] for seed in plan['seeds']]
assert len(cells) == summary['cells'] == 176
assert sum(c['score']['valid'] for c in cells) == summary['valid']
assert len({c['trackSha256'] for c in cells}) == summary['distinctTracks']
assert sum(c['stats']['sim_frames'] for c in cells) == summary['totalFrames']
assert abs(sum(c['score']['score'] for c in cells)/len(cells)-summary['meanCellScore']) < 1e-9
record = dict(schema='line.arc-exact-preview-evidence.v1', exactAll16138OriginalRecords=True,
    exactControlsAndIncomingReferences=True, unchangedRetrievalAfterRemovingReferences=True,
    oldDataSha256=digest(root/'data/rollout-949/data.json'), dataSha256=digest(root/'data/rollout-949-reference/data.json'),
    independentReconstructionProof='benchmark/v4/studies/arc-940-rollout-949-reference-transfer.json',
    package=package, studies=studies,
    rejectedStandaloneJitter=dict(plan=plan, summary=summary, planSha256=digest(directory/'plan.json'),
        summarySha256=digest(directory/'summary.json'),
        cellSha256={f"{c['source']}-{c['seed']}":digest(directory/f"{c['source']}-{c['seed']}.json") for c in cells}),
    scriptSha256=digest(Path(__file__)),
    limitations=['Exposed V4 development data, not held-out generalization.',
        'Reference decoding changes both floating-point reconstruction and omitted-field preservation; their individual causal contributions are not isolated.',
        'The rejected standalone jitter panel uses reused V2 development cases and is not a V4 headline.',
        'A full public canonical run is required for promotion.'])
out = Path('benchmark/v4/studies/arc-940-exact-preview.json')
body = (json.dumps(record, indent=2, allow_nan=False)+'\n').encode()
out.write_bytes(body)
Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(out=str(out), studies=[{k:v for k,v in s.items() if k!='rows'} for s in studies])))
