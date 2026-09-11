"""Compact checked full-suite studies into a behavioral/compiler-work audit.

This reports existing frozen-judge scores; it does not define another scorer.
Raw tracks and reports remain in the local study directories.
"""
import argparse
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
import statistics

p = argparse.ArgumentParser()
p.add_argument('--baseline', required=True)
p.add_argument('--candidate', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()


def read(path):
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().strip(), path
    return json.loads(gzip.decompress(data) if path.suffix == '.gz' else data), digest


def audit(root):
    run, digest = read(root / 'run.json.gz')
    plan, plan_sha = read(root / 'plan.json')
    assert run['plan'] == plan and 'headline' in run['summary']
    assert len(run['rows']) == len(plan['sources']) == 176
    guides, controls = Counter(), Counter()
    intervals = 0
    for row in run['rows']:
        cell, _ = read(root / (row['sourceId'] + '.json.gz'))
        assert cell['planSha256'] == plan_sha
        assert cell['trackHash'] == row['trackHash'] and cell['score'] == row['score']
        assert row['stats']['sim_frames'] <= plan['budget']
        for span in cell['guidanceReduction']['spans']:
            guides['absent' if span['after'] == 0 else 'shortened' if span['after'] < span['before'] else 'full'] += 1
        for interval in cell['rows']:
            intervals += 1
            controls.update(interval['control'].keys())
    previews = [r['policyPreviewStats'] for r in run['rows']]
    total = sum(r['stats']['sim_frames'] for r in run['rows'])
    return run, dict(
        directory=str(root), runSha256=digest, planSha256=plan_sha,
        compiler=plan['compiler'], options=plan['options'], summary=run['summary'],
        totalFrames=total,
        previewFrames=sum(r['previewFrames'] for r in previews),
        generalSearchFrames=sum(r['searchFrames'] for r in previews),
        selectedAttempts=dict(Counter(r['selected'] for r in previews)),
        completePreviews=sum(r['previewComplete'] for r in previews),
        generalSearchImprovesCompletePreview=sum(
            r['previewComplete'] and r['previewLoss'] is not None and
            r['searchLoss'] is not None and r['searchLoss'] < r['previewLoss'] for r in previews),
        completeGeneralSearches=sum(r['searchComplete'] for r in previews),
        memoHits=sum(r['candidateMemo']['hits'] for r in run['rows']),
        candidateRequests=sum(r['samples'] for r in run['rows']),
        planningFrames=sum(sum(a['lookahead']['physicsFrames'] for a in r['attempts'])
                           if 'attempts' in r else r['lookaheadStats']['physicsFrames'] for r in run['rows']),
        medianCompileMs=statistics.median(r['compileMs'] for r in run['rows']),
        selectedGeometry=dict(intervals=intervals, guides=dict(guides), controlFields=dict(controls)),
    )


baseline, baseline_audit = audit(Path(a.baseline))
candidate, candidate_audit = audit(Path(a.candidate))
assert baseline['plan']['judge'] == candidate['plan']['judge']
assert baseline['plan']['seed'] == candidate['plan']['seed']
assert baseline['plan']['budget'] == candidate['plan']['budget']
old = {r['sourceId']: r for r in baseline['rows']}
assert set(old) == {r['sourceId'] for r in candidate['rows']}
rows = [dict(sourceId=r['sourceId'], baseline=old[r['sourceId']]['score']['score'],
             candidate=r['score']['score'], delta=r['score']['score'] - old[r['sourceId']]['score']['score'],
             valid=r['score']['valid'], physicalFrames=r['stats']['sim_frames'],
             changedTrack=r['trackHash'] != old[r['sourceId']]['trackHash']) for r in candidate['rows']]
result = dict(schema='line.arc-design-audit.v1',
              note='Full 176-specification, single-seed V4 research studies at the same budget and frozen judge. Development evidence, not held-out generalization or two-seed canonical qualification.',
              baseline=baseline_audit, candidate=candidate_audit, rows=rows,
              comparison=dict(improved=sum(r['delta'] > 0 for r in rows),
                              regressed=sum(r['delta'] < 0 for r in rows),
                              changedTracks=sum(r['changedTrack'] for r in rows)))
out = Path(a.out)
out.parent.mkdir(parents=True, exist_ok=True)
data = (json.dumps(result, indent=2, allow_nan=False) + '\n').encode()
out.write_bytes(data)
Path(str(out) + '.sha256').write_text(hashlib.sha256(data).hexdigest() + '\n')
print(json.dumps(dict(out=str(out), comparison=result['comparison'],
                      baseline=baseline['summary']['headline'], candidate=candidate['summary']['headline'])))
