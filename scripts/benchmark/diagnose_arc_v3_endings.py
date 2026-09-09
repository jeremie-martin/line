"""Audit completed-trajectory loss and search work against a canonical compiler run."""
import argparse
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--canonical', required=True)
parser.add_argument('--research', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args()


def read(path):
    path = Path(path)
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().split()[0], path
    return json.loads(gzip.decompress(body) if path.suffix == '.gz' else body), digest


canonical, canonical_sha = read(args.canonical)
root = Path(args.research)
plan, plan_sha = read(root / 'plan.json')
baseline = {r['sourceId']: r for r in canonical['rows'] if r['seed'] == plan['seed']}
assert set(baseline) == set(plan['sources']) and len(baseline) == 88
axis_loss, region_loss, work, depths = Counter(), Counter(), Counter(), Counter()
cases = []
for source in plan['sources']:
    record, digest = read(root / (source + '.json.gz'))
    reference = baseline[source]
    assert record['planSha256'] == plan_sha
    assert record['score'] == reference['score']
    assert record['trackHash'] == reference['trackHash']
    assert record['stats']['sim_frames'] == reference['resources']['physicalFrames']
    assert record['score']['valid']
    gaps, axes = Counter(), Counter()
    tail_loss = 0.
    for o in reference['observations']:
        component = reference['score']['components'][o['axis']]
        mass = 1 if o['axis'] == 'impact' else o['endFrame'] - o['startFrame']
        loss = component['weight'] * mass / component['weightSum'] * o['error'] ** 2
        gaps[o['gap']] += loss
        axes[o['axis']] += loss
        axis_loss[o['axis']] += loss
        region_loss['ending' if o['tail'] else 'body'] += loss
        if o['tail']:
            tail_loss += loss
    total = sum(gaps.values())
    assert abs(total - reference['score']['weightedAxisRms'] ** 2) < 1e-15
    assert abs(record['terminalSelectionStats']['finalLoss'] - total) < 1e-12
    last = record['rows'][-1]
    previous_spent = record['rows'][-2]['spent'] if len(record['rows']) > 1 else 0
    ending_work = last['spent'] - previous_spent
    work['compilerFrames'] += record['stats']['sim_frames']
    work['lookaheadFrames'] += record['lookaheadStats']['physicsFrames']
    work['endingFrames'] += ending_work
    work['candidateAttempts'] += record['samples']
    work['memoHits'] += record['candidateMemo']['hits']
    work['backtracks'] += record['backtracks']
    for decision in record['planningDecisions']:
        depths[str(decision['depth'])] += 1
    cases.append(dict(id=source, recordSha256=digest, score=reference['score']['score'],
                      axisLoss=dict(axes), endingLossShare=tail_loss / total,
                      topFiveGapLossShare=sum(sorted(gaps.values(), reverse=True)[:5]) / total,
                      worstGap=gaps.most_common(1)[0], endingWork=ending_work,
                      endingRideFrames=last['next'] - last['frame'],
                      endingObservations=[o for o in reference['observations'] if o['tail']],
                      finalSelection=record['terminalSelectionStats'],
                      endingInterrupted=any(b.get('index') == len(record['rows']) - 1
                                            for b in record['budgetInterruptions'])))
result = dict(schema='line.arc-v3-ending-diagnosis.v1',
              canonical=dict(path=args.canonical, sha256=canonical_sha,
                             headline=canonical['summary']['headline']),
              research=dict(path=args.research, planSha256=plan_sha),
              note='Case-pooled squared-loss diagnostics, not a replacement headline. Each source appears once. Research tracks, scores and compiler frame counts match canonical results. Final compiler objective agrees with the cold judge.',
              pooledAxisLoss=dict(axis_loss), pooledRegionLoss=dict(region_loss),
              work=dict(work), planningDepthCounts=dict(depths), cases=cases)
out = Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
body = (json.dumps(result, indent=2, allow_nan=False) + '\n').encode()
out.write_bytes(body)
Path(str(out) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')
print(json.dumps(dict(cases=len(cases), work=dict(work), planningDepthCounts=dict(depths),
                      endingLossShare=region_loss['ending'] / sum(region_loss.values()))))
