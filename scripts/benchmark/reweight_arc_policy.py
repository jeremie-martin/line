"""Change only a checked policy mixture's declared proposal allocation."""
import argparse,hashlib,json,math
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--policy',required=True);p.add_argument('--weights',required=True);p.add_argument('--out',required=True);args=p.parse_args()
path=Path(args.policy);b=path.read_bytes();digest=hashlib.sha256(b).hexdigest();assert digest==Path(str(path)+'.sha256').read_text().split()[0]
policy=json.loads(b);weights=list(map(float,args.weights.split(',')))
assert len(weights)==len(policy['models']) and all(math.isfinite(w) and w>0 for w in weights)
old=policy.get('proposalWeights',[1]*len(weights));policy['proposalWeights']=weights
policy['allocationProvenance']=dict(parentPath=str(path),parentSha256=digest,previousWeights=old,weights=weights,
    note='All component predictors and measured examples are unchanged; only proposal shares change.',
    scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
out=Path(args.out);assert not out.exists();out.parent.mkdir(parents=True,exist_ok=True)
b=(json.dumps(policy,separators=(',',':'),allow_nan=False)+'\n').encode();out.write_bytes(b);Path(str(out)+'.sha256').write_text(hashlib.sha256(b).hexdigest()+'\n')
print(json.dumps(dict(out=str(out),weights=weights,sha256=hashlib.sha256(b).hexdigest())))
