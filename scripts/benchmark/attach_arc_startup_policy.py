"""Attach a checked opening library while preserving the complete catch policy."""
import argparse,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--base',required=True);p.add_argument('--library-policy',required=True);p.add_argument('--out',required=True);a=p.parse_args()
def read(path):
    b=Path(path).read_bytes();h=hashlib.sha256(b).hexdigest();assert h==Path(path+'.sha256').read_text().split()[0];return json.loads(b),h
base,base_sha=read(a.base);library,library_sha=read(a.library_policy)
assert 'startupModel' not in base and len(library['models'])==2 and library['models'][0]==base
startup=library['models'][1];assert startup['featureSchema']==base['featureSchema'] and startup['featureCount']==base['featureCount']
assert base['featureCount'] in (57,67)
assert startup['exemplars'] and startup.get('proximityTrees')
assert all(len(row['features'])==base['featureCount'] for row in startup['exemplars'])
result={**base,'startupModel':startup,'startupProvenance':dict(baseSha256=base_sha,libraryPolicySha256=library_sha,catchPolicyUnchanged=True,
    note='The compiler separately budgets these opening proposals; every proposed curve still requires physical validation.')}
out=Path(a.out);assert not out.exists();out.parent.mkdir(parents=True,exist_ok=True);b=(json.dumps(result,separators=(',',':'),allow_nan=False)+'\n').encode();out.write_bytes(b);Path(str(out)+'.sha256').write_text(hashlib.sha256(b).hexdigest()+'\n');print(json.dumps(dict(out=str(out),bytes=len(b),startupExamples=len(startup['exemplars']))))
