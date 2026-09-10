# /// script
# requires-python = ">=3.12"
# dependencies = ["numpy==2.5.1", "scikit-learn==1.7.2"]
# ///
"""Learn measured arc residuals, with a parent-held-out response-change check.

The network proposes a local response; its predictions never replace the engine
or the frozen judge. Training uses measured probes, not expert action labels.
"""
import argparse, hashlib, json
from pathlib import Path
import numpy as np
from sklearn.model_selection import GroupKFold
from sklearn.neural_network import MLPRegressor

p=argparse.ArgumentParser();p.add_argument('--data',required=True);p.add_argument('--out',required=True)
p.add_argument('--epochs',type=int,default=80);args=p.parse_args()
path=Path(args.data);body=path.read_bytes();digest=hashlib.sha256(body).hexdigest()
assert digest==Path(str(path)+'.sha256').read_text().split()[0]
data=json.loads(body);assert data['featureSchema']=='line.arc-measured-control-correction-features.v1'
matrix=np.asarray([r['features'] for r in data['rows']],dtype=np.float64)
assert matrix.shape[1]==77 and np.isfinite(matrix).all()
X,y=matrix[:,:73],matrix[:,73:]
parents=np.asarray([r['parent'] for r in data['rows']]);contexts={}
for i,r in enumerate(data['rows']):contexts.setdefault((r['source'],r['index']),[]).append(i)
source_provenance=data['sourceProvenance'];del data,body
out=Path(args.out);out.mkdir(parents=True,exist_ok=True);assert not (out/'model.json').exists()
def write(name,value):
    b=(json.dumps(value,separators=(',',':'),allow_nan=False)+'\n').encode();q=out/name;q.write_bytes(b)
    Path(str(q)+'.sha256').write_text(hashlib.sha256(b).hexdigest()+'\n')
def fit(indices):
    xm=X[indices].mean(axis=0);xs=np.maximum(X[indices].std(axis=0),1e-6)
    ym=y[indices].mean(axis=0);ys=np.maximum(y[indices].std(axis=0),.01)
    model=MLPRegressor(hidden_layer_sizes=(96,96),activation='tanh',solver='adam',alpha=.01,
        batch_size=1024,learning_rate_init=.001,max_iter=args.epochs,early_stopping=True,
        validation_fraction=.1,n_iter_no_change=10,tol=1e-5,random_state=260910)
    model.fit((X[indices]-xm)/xs,(y[indices]-ym)/ys)
    return model,xm,xs,ym,ys
def predict(bundle,indices):
    m,xm,xs,ym,ys=bundle;return m.predict((X[indices]-xm)/xs)*ys+ym
def export(bundle,indices):
    m,xm,xs,ym,ys=bundle
    return dict(schema='line.arc-response-network.v1',featureSchema='line.arc-response-network-features.v1',featureCount=73,
        activation='tanh',inputMean=xm.tolist(),inputScale=xs.tolist(),outputMean=ym.tolist(),outputScale=ys.tolist(),
        layers=[dict(weights=w.tolist(),bias=b.tolist()) for w,b in zip(m.coefs_,m.intercepts_)],
        provenance=dict(dataPath=str(path),dataSha256=digest,rows=len(indices),parents=sorted(set(parents[indices])),
            epochs=m.n_iter_,sourceProvenance=source_provenance,trainerSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()))
train,test=next(GroupKFold(3).split(X,y,parents));held=fit(train);pred=predict(held,test)
position={int(index):j for j,index in enumerate(test)}
weights=np.asarray([15,12,10,10,4,5,8,12.5,30/7,3.2]);pairs=[]
for indices in contexts.values():
    if indices[0] not in position or len(indices)<2:continue
    controls=X[indices,63:73]*weights
    distances=np.sum((controls[:,None,:]-controls[None,:,:])**2,axis=2);np.fill_diagonal(distances,np.inf)
    a,b=np.unravel_index(np.argmin(distances),distances.shape)
    if distances[a,b]<=9:pairs.append((indices[a],indices[b],float(np.sqrt(distances[a,b]))))
actual=np.asarray([y[b]-y[a] for a,b,_ in pairs]);estimated=np.asarray([pred[position[b]]-pred[position[a]] for a,b,_ in pairs])
assert len(pairs)>100
validation=dict(rows=len(X),heldParents=sorted(set(parents[test])),train=len(train),test=len(test),
    residualRms=np.sqrt(np.mean((pred-y[test])**2,axis=0)).tolist(),
    constantResidualRms=np.sqrt(np.mean((y[train].mean(axis=0)-y[test])**2,axis=0)).tolist(),
    nearbyContexts=len(pairs),responseChangeRms=np.sqrt(np.mean((estimated-actual)**2,axis=0)).tolist(),
    zeroResponseRms=np.sqrt(np.mean(actual**2,axis=0)).tolist(),
    note='One declared fold holds out complete parent families. Nearby pairs are the closest two distinct measured controls in each held context, within three normalized search steps. These diagnostics do not establish a compiler score or physical feasibility.')
write('held-model.json',export(held,train));write('validation.json',validation);print(json.dumps(validation),flush=True)
final=fit(np.arange(len(X)));write('model.json',export(final,np.arange(len(X))))
indices=np.linspace(0,len(X)-1,32,dtype=int);predictions=predict(final,indices)
write('parity.json',[dict(features=X[i].tolist(),residuals=r.tolist()) for i,r in zip(indices,predictions)])
print(json.dumps(dict(out=str(out),rows=len(X),epochs=final[0].n_iter_)),flush=True)
