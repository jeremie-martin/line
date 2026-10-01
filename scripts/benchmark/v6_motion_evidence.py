"""Complete-panel motion evidence; headline and qualification are separate.

Compare identical cases/seeds, including invalid outcomes in the execution ledger.
Report matched-valid observations and newly completed tracks separately.
"""
import argparse, hashlib, json, random, statistics
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--baseline', required=True)
parser.add_argument('--candidate', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args()
def checked(path):
    body = path.read_bytes()
    assert hashlib.sha256(body).hexdigest() == Path(str(path)+'.sha256').read_text().strip(), path
    return json.loads(body)
def load(root):
    plan = checked(root/'plan.json')
    rows = [checked(root/'cells'/f'{case}-{seed}.json') for case in plan['ids'] for seed in plan['seeds']]
    assert len(rows) == len(plan['ids'])*len(plan['seeds'])
    return plan, {(r['id'], r['seed']): r for r in rows}
a, old = load(Path(args.baseline)); b, new = load(Path(args.candidate))
assert a['ids'] == b['ids'] and a['seeds'] == b['seeds'] and a['budget'] == b['budget'], 'not a matched panel'
assert a['judge'] == b['judge'], 'different frozen judges'
def distribution(xs):
    xs = sorted(xs)
    return dict(count=len(xs), mean=statistics.mean(xs) if xs else None,
        median=statistics.median(xs) if xs else None,
        p95=xs[min(len(xs)-1, max(0, int(.95*len(xs))))] if xs else None,
        maximum=max(xs) if xs else None)
def motion(rows):
    available = [r for r in rows if r.get('motion')]
    return dict(scheduled=len(rows), observed=len(available), valid=sum(r['valid'] for r in rows),
        bands=[dict(frames=f, burden=distribution([next(x['excessIntegral'] for x in r['motion']['full']['bursts'] if x['frames']==f)/(r['motion']['full']['frames']/40) for r in available]),
            maxExcess=distribution([next(x['maxExcess'] for x in r['motion']['full']['bursts'] if x['frames']==f) for r in available])) for f in [1,4,10]])
matched = [k for k in new if old[k]['valid'] and new[k]['valid']]
newly = [k for k in new if not old[k]['valid'] and new[k]['valid']]
regressed = [k for k in new if old[k]['valid'] and not new[k]['valid']]
both_invalid = [k for k in new if not old[k]['valid'] and not new[k]['valid']]
paired = []
for f in [1,4,10]:
    groups = {}
    for k in matched:
        def burden(r):
            m = r['motion']['full']
            return next(x['excessIntegral'] for x in m['bursts'] if x['frames']==f)/(m['frames']/40)
        groups.setdefault(new[k]['sourceId'], []).append(burden(new[k])-burden(old[k]))
    parents = [statistics.mean(v) for v in groups.values()]
    rng = random.Random(20261001)
    bootstrap = sorted(statistics.mean(rng.choices(parents, k=len(parents))) for _ in range(1000)) if parents else []
    paired.append(dict(frames=f, matchedRuns=len(matched), sourceParents=len(parents),
        meanParentBurdenDelta=statistics.mean(parents) if parents else None,
        parentBootstrap95=[bootstrap[25],bootstrap[974]] if bootstrap else None))
worst = sorted((r for r in new.values() if r['valid'] and r.get('motion')),
    key=lambda r: max(x['maxExcess'] for x in r['motion']['full']['bursts']), reverse=True)[:20]
result = dict(schema='line.v6-motion-comparison.v1', plans=dict(baseline=a,candidate=b),
    allScheduled=dict(baseline=motion(list(old.values())),candidate=motion(list(new.values()))),
    matchedValid=dict(baseline=motion([old[k] for k in matched]),candidate=motion([new[k] for k in matched]),pairedByParent=paired),
    newlyCompleted=motion([new[k] for k in newly]),
    completionChanges=dict(newlyCompleted=newly,regressed=regressed,bothInvalid=both_invalid),
    executionErrors=[dict(id=r['id'],seed=r['seed'],error=r['executionError']) for r in new.values() if r.get('executionError')],
    worstValid=[dict(id=r['id'],seed=r['seed'],sourceId=r['sourceId'],score=r['score'],motion=r['motion']['full']) for r in worst],
    families=[dict(panel=panel,family=family,**motion([r for r in new.values() if r['panel']==panel and r['family']==family])) for panel,family in sorted({(r['panel'],r['family']) for r in new.values()})],
    interpretation='Motion diagnostics do not filter the headline. All-scheduled summaries include available invalid trajectories; infer improvements from matched-valid comparisons and report completion changes. Bootstrap resamples musical parents, not frames or duplicate seeds; it is descriptive uncertainty on these known sources, not a population aesthetic claim.')
out = Path(args.out);out.parent.mkdir(parents=True,exist_ok=True)
body=(json.dumps(result,indent=2)+'\n').encode();out.write_bytes(body);Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(matchedValid=len(matched),newlyCompleted=len(newly),regressed=len(regressed),bothInvalid=len(both_invalid))))
