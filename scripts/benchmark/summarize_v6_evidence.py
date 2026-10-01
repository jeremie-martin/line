"""Preserve every scheduled result compactly; raw observations/tracks stay local."""
import argparse, gzip, hashlib, json
from pathlib import Path
p = argparse.ArgumentParser()
p.add_argument('--runs', required=True)
p.add_argument('--out', required=True)
a = p.parse_args()
def checked(path):
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path)+'.sha256').read_text().strip(), path
    return json.loads(body), digest
panels = []
for name in a.runs.split(','):
    path = Path(name)/'run.json'
    r, digest = checked(path)
    plan = r['plan']
    assert {(x['id'],x['seed']) for x in r['rows']} == {(i,s) for i in plan['ids'] for s in plan['seeds']}
    assert len(r['rows']) == len(plan['ids'])*len(plan['seeds'])
    keys = ['id','seed','sourceId','panel','family','split','score','musicalScore','valid','fulfilled','requested',
            'trackHash','geometryError','foreignGeometry','constructionFailure','physicalFrames','compileMs','judgeMs','executionError']
    rows = [{**{k:x.get(k) for k in keys},'motion':x.get('motion',{}).get('full'),
             'failedRequests':[{k:s.get(k) for k in ['section','construction','guidance','reasons']}
                               for s in x.get('realization',{}).get('sections',[]) if not s['fulfilled']]}
            for x in r['rows']]
    panels.append(dict(source=str(path),sha256=digest,plan=plan,summary=r['summary'],executionErrors=r['executionErrors'],rows=rows))
result = dict(schema='line.v6-compact-evidence.v1',runs=panels,
    interpretation='Complete scheduled panels, without motion filtering. Definitions, compiler identity and raw run checksums are retained. Invalid and execution-error cells remain in the frozen headline. Wall times share a host.')
body = gzip.compress((json.dumps(result,separators=(',',':'))+'\n').encode(),mtime=0)
out = Path(a.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(body)
Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(out=str(out),runs=len(panels),cells=sum(len(r['rows']) for r in panels),bytes=len(body))))
