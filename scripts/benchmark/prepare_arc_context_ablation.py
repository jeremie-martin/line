"""Remove only the six prior-span context inputs from a checked dataset."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--data',required=True);p.add_argument('--out',required=True);args=p.parse_args()
path=Path(args.data);raw=path.read_bytes();digest=hashlib.sha256(raw).hexdigest()
assert digest==Path(str(path)+'.sha256').read_text().split()[0]
data=json.loads(raw);assert data['featureSchema']=='line.arc-context-control-policy-features.v1'
assert all(len(row['features'])==63 for row in data['rows'])
data={**data,'featureSchema':'line.arc-control-policy-features.v1',
      'contextSource':dict(path=str(path),sha256=digest),
      'rows':[{**row,'features':row['features'][:57]} for row in data['rows']],
      'note':'Matched ablation: only six prior-span context inputs removed; physical actions and all source provenance unchanged.',
      'projectionScriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
out=Path(args.out);assert not out.exists();out.parent.mkdir(parents=True,exist_ok=True)
body=(json.dumps(data,separators=(',',':'),allow_nan=False)+'\n').encode();out.write_bytes(body)
Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(out=str(out),rows=len(data['rows']))))
