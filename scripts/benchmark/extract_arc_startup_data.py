"""Extract independently reconstructed opening controls without mixing catch data."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--data',required=True);p.add_argument('--catch-reference',required=True);p.add_argument('--out',required=True);a=p.parse_args()
def read(path):
    b=Path(path).read_bytes();h=hashlib.sha256(b).hexdigest();assert h==Path(path+'.sha256').read_text().split()[0];return json.loads(b),h
data,source_sha=read(a.data);reference,reference_sha=read(a.catch_reference)
assert data['featureSchema']==reference['featureSchema']=='line.arc-control-policy-features.v1'
assert [r for r in data['rows'] if r['index']>0]==reference['rows']
rows=[r for r in data['rows'] if r['index']==0];assert len(rows)==len({r['source'] for r in rows})==len(data['provenance'])==176
result={**data,'rows':rows,'startupExtraction':dict(sourceSha256=source_sha,catchReferenceSha256=reference_sha,allNonStartupRowsMatched=True),
    'note':'Exposed development opening controls. Independently reconstructed physical prefixes; catch rows exactly match the declared independently checked reference. Runtime features have no source, seed or absolute-position identifiers.'}
out=Path(a.out);assert not out.exists();out.parent.mkdir(parents=True,exist_ok=True);b=(json.dumps(result,separators=(',',':'),allow_nan=False)+'\n').encode();out.write_bytes(b);Path(str(out)+'.sha256').write_text(hashlib.sha256(b).hexdigest()+'\n');print(json.dumps(dict(out=str(out),rows=len(rows))))
