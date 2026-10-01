"""Describe a complete frozen V6 run without changing its score or filtering it.

Construction/context diagnostics use the authored frozen plans. Observations from
valid tracks describe achieved behavior; every failure remains in the run summary.
"""
import argparse, collections, gzip, hashlib, json, math, statistics
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--run', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()

def checked(path):
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path)+'.sha256').read_text().strip(), path
    return json.loads(body), digest

root = Path(a.run)
run, digest = checked(root/'run.json')
plan, _ = checked(root/'plan.json')
assert plan == run['plan']
rows = run['rows']
assert len(rows) == len(plan['ids'])*len(plan['seeds'])
assert {(r['id'], r['seed']) for r in rows} == {(i, s) for i in plan['ids'] for s in plan['seeds']}
catalog_bytes = Path('benchmark/v6/catalog.json.gz').read_bytes()
catalog = json.loads(gzip.decompress(catalog_bytes))
cases = {c['id']: c for c in catalog['cases']}

def distribution(values):
    xs = sorted(values)
    return dict(count=len(xs), mean=statistics.mean(xs) if xs else None,
        median=statistics.median(xs) if xs else None,
        p95=xs[min(len(xs)-1, int(.95*len(xs)))] if xs else None,
        maximum=max(xs) if xs else None)

def work(rs):
    return {key: distribution([r[key] for r in rs if isinstance(r.get(key), (int, float))])
            for key in ['physicalFrames', 'compileMs', 'judgeMs']}

groups = collections.defaultdict(list)
for r in rows:
    assert r['id'] in cases and cases[r['id']]['split'] == plan['split']
    request_plan = cases[r['id']]['plans'][str(r['seed'])]
    requests = request_plan['requests']
    realized = {s['section']: s for s in r.get('realization', {}).get('sections', [])}
    motion = {s['section']: s['summary'] for s in r.get('motion', {}).get('sections', [])}
    by_start = {q['frame']: q['section'] for q in requests}
    by_start[0] = 0
    observations = collections.defaultdict(list)
    for o in r.get('observations', []):
        section = by_start.get(o['endFrame'] if o['axis'] == 'impact' else o['startFrame'])
        if section is not None:
            observations[section].append(o)
    for q in requests:
        key = (r['panel'], q['construction'], q['guidance'], q.get('railLayout', 'paired'),
               'calm' if q.get('context', {}).get('quiet', 0) >= .5 else 'other')
        groups[key].append(dict(parent=r['sourceId'], run=(r['id'], r['seed']), valid=r['valid'],
            request=q, realized=realized.get(q['section']), motion=motion.get(q['section']),
            observations=observations[q['section']]))

contexts = []
for (panel, construction, guidance, layout, context), items in sorted(groups.items()):
    valid = [x for x in items if x['valid']]
    observed = [x for x in valid if x['motion']]
    axes = {}
    for axis in ['air', 'speed', 'amplitude', 'impact']:
        values = [o for x in valid for o in x['observations'] if o['axis'] == axis and isinstance(o.get('error'), (int, float))]
        mass = sum(1 if axis == 'impact' else o['endFrame']-o['startFrame'] for o in values)
        axes[axis] = dict(observations=len(values), rms=math.sqrt(sum(o['error']**2*(1 if axis == 'impact' else o['endFrame']-o['startFrame']) for o in values)/mass) if mass else None)
    contexts.append(dict(panel=panel, construction=construction, guidance=guidance, layout=layout, context=context,
        requests=len(items), validRequests=len(valid), musicalParents=len({x['parent'] for x in items}),
        requestedSeconds=sum(max(0, x['request']['next']-x['request']['frame'])/40 for x in items),
        fulfilled=sum(bool(x['realized'] and x['realized']['fulfilled']) for x in items),
        mainContactFrames=distribution([x['realized']['mainContactFrames'] for x in valid if x['realized']]),
        guideContactFrames=distribution([x['realized']['guideContactFrames'] for x in valid if x['realized']]),
        musicalAxes=axes,
        gravitySpeedChange=distribution([x['motion']['gravityGain'] for x in observed]),
        speedWeightedDirectionChange=distribution([x['motion']['directionCorrection'] for x in observed]),
        burstBurden=[dict(frames=f, **distribution([next(b['excessIntegral'] for b in x['motion']['bursts'] if b['frames']==f)/max(1/40, x['motion']['frames']/40) for x in observed])) for f in [1, 4, 10]]))

result = dict(schema='line.intentional-motion-delivery.v1', source=str(root/'run.json'), sha256=digest,
    catalogSha256=hashlib.sha256(catalog_bytes).hexdigest(), plan=plan, summary=run['summary'],
    allConstructionRequests=dict(requested=sum(x['realization']['requested'] for x in rows if x.get('realization')),
        fulfilled=sum(x['realization']['fulfilledSections'] for x in rows if x.get('realization')),
        completeTracks=sum(bool(x.get('realization', {}).get('fulfilled')) for x in rows),
        unavailableTracks=sum(not bool(x.get('realization')) for x in rows)),
    executionErrors=run['executionErrors'], work=work(rows),
    panels=[dict(panel=panel, runs=len(rs), valid=sum(r['valid'] for r in rs),
        distinctTracks=len({r['trackHash'] for r in rs if r.get('trackHash')}), work=work(rs))
        for panel in ['fixed', 'automatic'] if (rs := [r for r in rows if r['panel']==panel])],
    contexts=contexts,
    failures=[{k:r.get(k) for k in ['id','seed','score','musicalScore','valid','fulfilled','requested','executionError','constructionFailure']}
              for r in rows if not r['valid'] or r['fulfilled'] != r['requested'] or r.get('executionError')],
    worstMusical=[{k:r.get(k) for k in ['id','seed','panel','sourceId','score','musicalScore','physicalFrames']}
                  for r in sorted(rows, key=lambda r:r['score'])[:20]],
    interpretation='The frozen headline includes every scheduled outcome. Context diagnostics are request-weighted descriptions, not another headline or independent population samples. Calm means frozen authored quiet >=0.5. Musical RMS uses valid available observations, time weights for spans and event weights for impacts. All support requests are shown, including ordinary surroundings of fixed windows. Contact counts establish engagement, not continuous sliding or artistic approval. Work includes failed compiler attempts; independent judgment is separate. Wall times share a loaded host and are not isolated throughput measurements.')
out = Path(a.out)
out.parent.mkdir(parents=True, exist_ok=True)
body = (json.dumps(result, indent=2)+'\n').encode()
out.write_bytes(body)
Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(out=str(out), runs=len(rows), contexts=len(contexts), failures=len(result['failures']))))
