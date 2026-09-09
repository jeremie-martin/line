"""Preserve compact provenance for compiler-campaign teacher/model experiments."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--name', required=True)
args = parser.parse_args()
assert args.name.startswith('arc-') and args.name[4:].isdigit()
root = Path('generated/benchmark-v3') / args.name


def checked(path):
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().split()[0], path
    return json.loads(gzip.decompress(body) if path.suffix == '.gz' else body), digest


teachers = []
for path in sorted(Path(str(root) + '-teachers').glob('*/run.json.gz')):
    run, digest = checked(path)
    replay = bool(run['plan']['options'].get('replayControlPath'))
    teachers.append(dict(path=str(path), sha256=digest, budget=run['plan']['budget'],
                         options=run['plan']['options'], compiler=run['plan']['compiler'],
                         headline=run['summary']['headline'], valid=run['summary']['valid'],
                         runs=len(run['rows']), fixedStudentReplay=replay,
                         interpretation='The score belongs to the replayed student track, not an expert rollout.' if replay else 'Research rollout at a larger allowance; not a standard-budget candidate.',
                         maximumFrames=max(r['stats']['sim_frames'] for r in run['rows'])))
datasets = []
paths = sorted(root.rglob('data.json'))
for path in paths:
    data, digest = checked(path)
    feature_count={'line.arc-control-policy-features.v1':57,'line.arc-control-refinement-features.v1':71}[data['featureSchema']]
    assert all(len(r['features']) == feature_count and len(r['target']) == 10 for r in data['rows'])
    provenance = data.get('provenance', [])
    datasets.append(dict(path=str(path), sha256=digest, rows=len(data['rows']),
                         parents=len({r['parent'] for r in data['rows']}),
                         note=data.get('note'), featureSchema=data['featureSchema'],featureCount=feature_count,
                         verifiedSource=data.get('verifiedSource'),checkedControls=sum(p.get('checkedControls', 0) for p in provenance),
                         independentlyRevalidated=bool(provenance) and all(p.get('allCounterfactualControlsRevalidated', False) for p in provenance),
                         provenance=provenance, residualBaseSha256=data.get('residualBaseSha256'),
                         sourceDataSha256=data.get('sourceDataSha256'), datasets=data.get('datasets')))
models = []
for path in sorted(root.rglob('model.json')):
    model, digest = checked(path)
    validation_path = path.parent / 'validation.json'
    validation, validation_sha = checked(validation_path)
    models.append(dict(path=str(path), sha256=digest, bytes=path.stat().st_size,
                       provenance=model.get('provenance'),
                       validation=dict(path=str(validation_path), sha256=validation_sha,
                                       **{k: v for k, v in validation.items() if k not in ('ranking', 'provenance')})))
runtime = []
for path in sorted([*(root / 'models').glob('*.json'), *root.glob('residual-*/policy-*.json')]):
    model = json.loads(path.read_text())
    if not isinstance(model, dict) or not model.get('models'):
        continue
    model, digest = checked(path)
    runtime.append(dict(path=str(path), sha256=digest, bytes=path.stat().st_size,
                        proposalWeights=model.get('proposalWeights'), provenance=model.get('provenance'),
                        componentSchemas=[m['schema'] for m in model['models']],
                        supervisedRetrieval=any('proximityTrees' in m for m in model['models']),
                        refinement=model.get('refinementModel',{}).get('provenance'),
                        refinementStage=model.get('refinementModel',{}).get('stage')))
parity = []
for path in [root / 'model-parity.json', root / 'residual-parity.json',
             root / 'residual-reproduction-check.json',root / 'refinement-parity.json',
             root / 'response-bounds-parity.json',root / 'response-bound-audit.json',
             root / 'proximity-parity.json',root / 'proximity-reproduction.json',
             root / 'teacher-control-reconstruction.json']:
    if path.exists():
        value, digest = checked(path)
        parity.append(dict(path=str(path), sha256=digest, checks=value))
result = dict(schema='line.arc-v3-campaign-transfer.v1',
              note='Exposed development research. Runtime features are physical state and authored targets, without case/seed identity. Offline prediction checks are not live compiler scores. Large datasets, model variants and raw teacher tracks stay local.',
              teachers=teachers, datasets=datasets, models=models, runtimeModels=runtime, parity=parity)
out = Path(f'benchmark/v3/studies/{args.name}-transfer.json')
body = (json.dumps(result, indent=2, allow_nan=False) + '\n').encode()
out.write_bytes(body)
Path(str(out) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')
print(json.dumps(dict(teachers=len(teachers), datasets=len(datasets), models=len(models),
                      runtimeModels=len(runtime), out=str(out), bytes=len(body))))
