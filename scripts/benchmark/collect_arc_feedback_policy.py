"""Pair measured arc feedback with independently verified expert corrections.

The probes and expert visit the exact same fixed student states. This collector
checks their equality and artifact provenance; it does not claim a new physical
validation of the expert, or a new compiler score.
"""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--observations', required=True)
p.add_argument('--teacher', required=True)
p.add_argument('--teacher-proof', required=True)
p.add_argument('--out', required=True)
p.add_argument('--omit-feedback', action='store_true')
args = p.parse_args()
observations, teacher, out = Path(args.observations), Path(args.teacher), Path(args.out)
assert not (out / 'data.json').exists()


def checked(path):
    body = path.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    assert digest == Path(str(path) + '.sha256').read_text().split()[0], path
    return json.loads(gzip.decompress(body) if path.suffix == '.gz' else body), digest


def encode(control, incoming, span):
    assert not any(key in control for key in ['guideStart', 'guideEnd', 'guideBend', 'exitBias'])
    return [(control['entry'] - incoming) / 30, control['turn'] / 60,
            (control['exit'] - incoming) / 60, control['support'] / span,
            control['bias'], control['offset'], control.get('clearance', 12) / 12,
            control.get('turnFraction', min(5, control['support'] * .5) / control['support']),
            control.get('bend', 0) / 30, control.get('guideFlare', 0) / 8]


plan, plan_sha = checked(observations / 'plan.json')
run, run_sha = checked(observations / 'run.json.gz')
teacher_plan, teacher_plan_sha = checked(teacher / 'plan.json')
teacher_run, teacher_run_sha = checked(teacher / 'run.json.gz')
proof, proof_sha = checked(Path(args.teacher_proof))
assert proof['teacher']['planSha256'] == teacher_plan_sha
assert proof['teacher']['runSha256'] == teacher_run_sha
assert run['plan'] == plan and teacher_run['plan'] == teacher_plan
assert plan['suite'] == teacher_plan['suite'] == 'v4'
assert plan['judge'] == teacher_plan['judge']
assert plan['seed'] == teacher_plan['seed']
assert plan['sources'] == teacher_plan['sources'] and len(plan['sources']) == 176
assert plan['options']['collectProposals']
assert plan['replaySha256'] == teacher_plan['replaySha256'] == proof['teacher']['replaySha256']
assert run['summary']['headline'] == teacher_run['summary']['headline']
assert run['summary']['valid'] == teacher_run['summary']['valid'] == 176
catalog_bytes = Path('benchmark/v4/specifications.json.gz').read_bytes()
assert hashlib.sha256(gzip.decompress(catalog_bytes)).hexdigest() == plan['judge']['inputSha256']
cases = {c['id']: c for c in json.loads(gzip.decompress(catalog_bytes))}
verified = {r['source']: r for r in proof['validation']}
rows, provenance = [], []
invalid, duplicates, contexts = 0, 0, 0
for source in plan['sources']:
    record, record_sha = checked(observations / (source + '.json.gz'))
    expert, expert_sha = checked(teacher / (source + '.json.gz'))
    assert record['planSha256'] == plan_sha and expert['planSha256'] == teacher_plan_sha
    assert expert_sha == verified[source]['sha256']
    assert verified[source]['allPrefixesAndFeaturesMatched'] and verified[source]['allCounterfactualControlsRevalidated']
    assert record['trackHash'] == expert['trackHash'] == verified[source]['replayedTrackHash']
    assert record['score'] == expert['score'] and record['score']['valid']
    assert record['resources']['physicalFrames'] <= plan['budget']
    assert len(record['proposalContexts']) == len(expert['teacherRows'])
    before = len(rows)
    for context, action in zip(record['proposalContexts'], expert['teacherRows']):
        assert context['index'] == action['index']
        assert context['features'][:57] == action['features']
        assert context['incoming'] == action['incoming'] and context['span'] == action['span']
        if context['index'] == 0:
            continue
        assert len(context['features']) == 63
        wanted = encode(action['control'], context['incoming'], context['span'])
        seen, count = set(), 0
        for proposal in context['proposals']:
            if proposal['reason'] is not None:
                assert proposal['residuals'] is None
                invalid += 1
                continue
            current = encode(proposal['control'], context['incoming'], context['span'])
            if tuple(current) in seen:
                duplicates += 1
                continue
            seen.add(tuple(current))
            residuals = proposal['residuals']
            assert len(residuals) == 4
            features = context['features'] + current + ([] if args.omit_feedback else residuals)
            target = [a - b for a, b in zip(wanted, current)]
            assert all(math.isfinite(x) for x in features + target + residuals)
            rows.append(dict(source=source, parent=cases[source]['parentId'], group=cases[source]['group'],
                index=context['index'], features=features, target=target))
            count += 1
        assert count > 0
        contexts += 1
    provenance.append(dict(source=source, observationSha256=record_sha, teacherSha256=expert_sha,
        trackHash=record['trackHash'], exactInputAndSpanParity=True, rows=len(rows) - before,
        observationPhysicsFrames=record['resources']['physicalFrames']))

data = dict(schema='line.arc-control-policy-data.v1',
    featureSchema='line.arc-context-control-correction-features.v1' if args.omit_feedback else 'line.arc-measured-control-correction-features.v1',
    targetKind='normalized correction to independently validated expert control',
    sourceProvenance=dict(observations=str(observations), planSha256=plan_sha, runSha256=run_sha,
        teacher=str(teacher), teacherPlanSha256=teacher_plan_sha, teacherRunSha256=teacher_run_sha,
        teacherProof=args.teacher_proof, teacherProofSha256=proof_sha),
    provenance=provenance, contexts=contexts, invalidProbesExcluded=invalid, duplicateProbesExcluded=duplicates,
    scriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), rows=rows,
    note='Exposed development training. Inputs are relative physical state, authored targets, prior span '
         'measurements, a normalized proposed control and optionally its four physically measured residuals. '
         'Targets are normalized expert-control deltas at exactly matching student prefixes. Source, parent, '
         'seed and contact index are metadata only. The replayed headline is the unchanged student score.')
out.mkdir(parents=True, exist_ok=True)
body = (json.dumps(data, separators=(',', ':'), allow_nan=False) + '\n').encode()
path = out / 'data.json'
path.write_bytes(body)
Path(str(path) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')
print(json.dumps(dict(out=str(out), rows=len(rows), contexts=contexts, invalid=invalid,
                     duplicates=duplicates, features=len(rows[0]['features']))))
