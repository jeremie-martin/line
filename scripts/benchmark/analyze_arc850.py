"""Bind final Arc 850 validation to checked local artifacts; no scoring changes.

Run from the repository root after restoring the local campaign archive:
    python scripts/benchmark/analyze_arc850.py
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path('generated/benchmark-v2/arc-850')
artifacts = {}


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def checked(name):
    path = ROOT / name
    sha = digest(path)
    assert sha == Path(str(path) + '.sha256').read_text().strip().split()[0], path
    artifacts[name] = {'sha256': sha, 'bytes': path.stat().st_size}
    return json.loads(path.read_text())


def metered_runs(archive, count):
    runs = archive['runs']
    assert len(runs) == count
    assert all(r['status'] == 'ok' and r['score']['valid'] for r in runs)
    assert all(r['stats']['sim_frames'] <= r['task']['budget'] for r in runs)
    return {'valid': count, 'runs': count, 'sources': len(archive['sources']),
            'distinctTracks': len({r['trackHash'] for r in runs}),
            'maxFrames': max(r['stats']['sim_frames'] for r in runs),
            'totalFrames': sum(r['stats']['sim_frames'] for r in runs)}


prior = json.loads(Path('benchmark/v2/studies/arc-825-validation.json').read_text())
canonical = checked('final-canonical.N8.json')
comparison = checked('final-canonical.json.comparison.json')
qualification = checked('final-qualification.json')
geometry = checked('final-geometry-audit.json')
protected = checked('protected-file-check.json')
jitter = checked('final-jitter/summary.json')
folds = checked('final-held-families.json')
low = checked('final-public-150k/summary.json')
high = checked('integrated-public-1m/summary.json')
recovery_path = Path('archives/arc-850-852/render-recovery.json')
recovery = json.loads(recovery_path.read_text())
assert recovery['rendererSha256'] == digest(Path('scripts/produce/render.ts'))
assert recovery['concurrency'] == 4 and recovery['sequential']
assert comparison['outcome'] == 'accept' and comparison['promotable']
assert canonical['canonicalHeadline'] == 852.1248 > 850
assert comparison['candidate']['archiveSha256'] == artifacts['final-canonical.N8.json']['sha256']
assert qualification['linkedDevelopment']['sha256'] == comparison['candidate']['archiveSha256']
assert geometry['archiveSha256'] == comparison['candidate']['archiveSha256']
baseline = json.loads(Path('benchmark/v2/campaign-baseline.json').read_text())
assert baseline['label'] == 'arc-control-memory'
assert baseline['candidate_fingerprint'] == comparison['candidate']['snapshot']['candidateFingerprint']
for archive in (canonical, qualification):
    assert all(archive['identity'][k] == v for k, v in prior['fixedIdentity'].items())
    assert archive['git']['candidateFingerprint'] == comparison['candidate']['snapshot']['candidateFingerprint']
assert not protected['unexpectedChanges']
assert protected['judgeSha256'] == canonical['git']['engineArtifactFingerprint']
assert canonical['identity']['budgets'] == [750000]
assert canonical['identity']['seedSchedule']['byBudget'][0]['actualSeeds'] == list(range(16, 24))
canon_stats = metered_runs(canonical, 352)
qual_stats = metered_runs(qualification, 120)
assert canon_stats['sources'] == canon_stats['distinctTracks'] == 44
assert all(sum(r['task']['sourceId'] == s['id'] for r in canonical['runs']) == 8 for s in canonical['sources'])
assert jitter['cells'] == jitter['valid'] == jitter['distinctTracks'] == 176
assert jitter['maxFrames'] <= 750000 and not jitter['failures']
assert folds['summary']['validRuns'] == folds['summary']['totalRuns'] == 44
assert len(folds['models']) == 5
assert all(not set(m['heldParents']).intersection(m['trainingParents']) for m in folds['models'])
assert geometry['sources'] == 44 and geometry['canonicalRuns'] == 352 and geometry['allNormal']
assert geometry['shortestChain'] >= 10
assert all(r['reportMatches'] and r['scoreMatches'] and r['framesMatch'] for r in geometry['rows'])
assert low['score']['score'] == prior['lowBudget150k']['score']['score']
assert low['valid'] == prior['lowBudget150k']['valid'] == 41
assert low['maxFrames'] <= 150000 and high['maxFrames'] <= 1000000 and high['valid'] == 44

integration_parity = checked('public-integration-parity.json')
low_parity = checked('low-budget-parity.json')
allocation_parity = checked('final-allocation-equivalence.json')
assert integration_parity['allExact'] and integration_parity['cases'] == 44
assert low_parity['allExact'] and low_parity['cases'] == 44
assert allocation_parity['allExact'] and allocation_parity['cells'] == 88

test_log = ROOT / 'integrated-tests.log'
assert re.search(r'Test Files\s+14 passed \(14\)', test_log.read_text())
assert re.search(r'Tests\s+47 passed \(47\)', test_log.read_text())
allocation_test = ROOT / 'final-allocation-tests.log'
assert re.search(r'Test Files\s+3 passed \(3\)', allocation_test.read_text())
assert re.search(r'Tests\s+10 passed \(10\)', allocation_test.read_text())
ts_before = Path('generated/benchmark-v2/arc-825/final-typescript.log').read_text()
ts_after = (ROOT / 'completion-typescript.log').read_text()
def diagnostics(text):
    return [re.sub(r'\(\d+,\d+\)', '', line) for line in text.splitlines() if 'error TS' in line]
assert diagnostics(ts_before) == diagnostics(ts_after)
assert len(diagnostics(ts_after)) == 251
model_path = Path('scripts/v0/optimizer/arc_control_policy_model.json')
model = json.loads(model_path.read_text())
assert digest(model_path) == Path(str(model_path) + '.sha256').read_text().strip()
assert model['featureCount'] == 57 and len(model['models'][0]['trees']) == 48
assert model['provenance']['forestTrainingRows'] == 12168
assert model['provenance']['exemplarRows'] == len(model['models'][1]['exemplars']) == 4056
assert model['proposalWeights'] == [2, 1]
assert len(model['provenance']['trainingParents']) == 21
if '--preflight' in sys.argv:
    print('Non-video validation passed; the complete report still requires all three reviewed videos.')
    sys.exit(0)
videos = checked('final-videos.json')
assert len(videos['records']) == 3
for video in videos['records']:
    review = json.loads((Path(video['video']).parent / 'review.json').read_text())
    assert digest(Path(video['video'])) == video['videoSha256'] == review['videoSha256']
    assert review['gitSha'] == canonical['git']['head'] and review['validated']
    assert all(digest(Path(p)) == sha for p, sha in review['implementation'].items())
    assert video['allNormal'] and video['physicsFrames'] <= video['budget'] == 1000000
    assert video['metrics']['contractPassed'] and video['metrics']['reachedEnd']
    assert all(Path(p).exists() for p in video['inspectedFrames'])

result = {
    'schema': 'line.arc-850-validation.v1', 'date': '2026-09-09',
    'branch': 'codex/arc-850', 'referenceCommit': protected['referenceCommit'],
    'compilerCommit': canonical['git']['head'], 'decision': 'promoted arc-control-memory',
    'constraint': 'Coherent substantial normal type-0 curves; fixed benchmark, scorer, targets, detector, physics and actual-frame accounting.',
    'compilerIdentity': {k: canonical['git'][k] for k in ('candidateFingerprint', 'compilerSourceFingerprint', 'engineArtifactFingerprint')},
    'fixedIdentity': prior['fixedIdentity'], 'protectedFiles': protected,
    'canonical': {**canon_stats, 'headline': canonical['canonicalHeadline'], 'referenceHeadline': comparison['decision']['base']['headline'],
                  'delta': round(canonical['canonicalHeadline'] - comparison['decision']['base']['headline'], 4),
                  'budget': 750000, 'seeds': list(range(16, 24)), 'jitter': 0,
                  'sequential': comparison['sequential'],
                  'note': '44 distinct geometries repeated across eight zero-jitter seeds; not 352 independent geometries.',
                  'specifications': canonical['developmentSummaries'][0]['specifications']},
    'qualification': {**qual_stats, 'monitorScore': qualification['qualificationMonitorScore'],
                      'byBudget': qualification['qualificationSummaries'],
                      'note': 'Reused regression panel after budget diagnosis; not a fresh holdout or promotion veto.'},
    'jitter': {**jitter, 'jitter': 0.02, 'seeds': [101, 102, 103, 104],
               'note': 'Unweighted cell mean; separate robustness research, not the canonical headline.'},
    'heldFamilies': folds, 'geometry': geometry,
    'lowBudget150k': low, 'oneMillion': high,
    'model': {'path': str(model_path), 'sha256': digest(model_path), 'bytes': model_path.stat().st_size,
              'features': model['featureCount'], 'trees': len(model['models'][0]['trees']), 'provenance': model['provenance'],
              'inference': 'Float32 forest traversal plus nearest relative-state control examples; ordinary physical validation of every candidate.'},
    'parity': {'prototypeToPublic': integration_parity, 'lowBudgetToPrior': low_parity, 'finalHighBudgetAllocation': allocation_parity},
    'tests': {'passed': 47, 'files': 14, 'logSha256': digest(test_log),
              'finalAllocationRerun': {'passed': 10, 'files': 3, 'logSha256': digest(allocation_test)},
              'typecheck': {'command': 'npx tsc --noEmit --allowImportingTsExtensions --pretty false',
                            'existingDiagnostics': 251, 'newDiagnostics': 0,
                            'logSha256': digest(ROOT / 'completion-typescript.log')}},
    'videos': videos,
    'renderRecovery': {**recovery, 'sha256': digest(recovery_path)},
    'limitations': [
        'The deployed forest and examples are development-trained. Five family-excluded final control models inherit development-trained teachers upstream and use the unchanged development-trained future-value prior; this is conditional exclusion research, not a fresh independent end-to-end holdout.',
        'Three inherited 150k invalid cases remain; the aggregate and validity match the accepted baseline.',
        "1M reaches 851.7820 versus 852.1248 at 750k. Aggregate monotonic scaling is not established; the 1M result still improves on the previous compiler's 831.0704.",
        'All three rendered tracks have zero standing time and miss the original 2% creative-selection floor. These are full review renders, not creative-selection passes.',
        'Visual review covers sampled frames at 12s and 30s in each video, plus full decode validation; no whole-video perceptual review is claimed.',
        'Repository-wide TypeScript still has 251 pre-existing diagnostics. Legacy fallback budget overruns identified in the preceding audit are outside this arc-path change.'
    ],
    'localArtifacts': artifacts,
}
out = Path('benchmark/v2/studies/arc-850-validation.json')
body = (json.dumps(result, indent=2) + '\n').encode()
out.write_bytes(body)
Path(str(out) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')
print(json.dumps({'headline': result['canonical']['headline'], 'delta': result['canonical']['delta'],
                  'valid': canon_stats['valid'], 'qualificationValid': qual_stats['valid'], 'output': str(out)}))
