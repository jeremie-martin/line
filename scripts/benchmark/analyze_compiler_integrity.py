"""Rebuild the September compiler audit's compact evidence from its local archive.

Run from the repository root after restoring archives/compiler-integrity-audit-2026-09-08.
This reads measurements; it neither runs nor changes the benchmark or compiler.
"""
import hashlib
import json
from pathlib import Path

STUDY = Path('generated/benchmark-v2/compiler-integrity-audit')
OUTPUT = Path('benchmark/v2/studies/compiler-integrity-audit-validation.json')


def read(path):
    return json.loads(Path(path).read_text())


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def key(row):
    task = row['task']
    return task['sourceId'], task['budget'], task['actualSeed']


def panel(name):
    data = read(STUDY / name / 'summary.json')
    return {'score': data['score']['score'], 'valid': data['valid'],
            'sources': data['sources'], 'maxFrames': data['maxFrames'],
            'totalFrames': data['totalFrames']}


def main():
    canonical = read(STUDY / 'final.md.N8.json')
    intermediate = read(STUDY / 'canonical.md.N8.json')
    comparison = read(STUDY / 'final.md.comparison.json')
    qualification = read(STUDY / 'qualification.json')
    previous = read('benchmark/v2/studies/arc-planning-continuity-validation.json')
    promoted = read(STUDY / 'promotion/campaign-baseline.json')
    fixed_keys = list(previous['fixedIdentity'])
    assert all(canonical['identity'][k] == previous['fixedIdentity'][k] for k in fixed_keys)
    assert canonical['git']['engineArtifactFingerprint'] == previous['compilerIdentity']['engineArtifactFingerprint']
    assert qualification['git']['candidateFingerprint'] == canonical['git']['candidateFingerprint']
    assert promoted['candidate_fingerprint'] == canonical['git']['candidateFingerprint']
    assert comparison['outcome'] == 'accept' and comparison['promotable']
    assert comparison['sequential']['stoppingDepth'] == 8
    assert len(canonical['runs']) == 352 and len(qualification['runs']) == 120
    assert all(r['score']['valid'] and r['stats']['sim_frames'] <= r['task']['budget']
               for r in canonical['runs'] + qualification['runs'])
    by = {key(r): r for r in intermediate['runs']}
    assert all(r['trackHash'] == by[key(r)]['trackHash'] and r['report'] == by[key(r)]['report']
               and r['stats']['sim_frames'] == by[key(r)]['stats']['sim_frames']
               and r['score'] == by[key(r)]['score'] for r in canonical['runs'])
    jitter = read(STUDY / 'final-jitter/summary.json')
    assert jitter['cells'] == jitter['valid'] == jitter['distinctTracks'] == 176
    for p in (STUDY / 'final-jitter').glob('*.json'):
        if p.name in ('plan.json', 'summary.json'):
            continue
        a, b = read(p), read(STUDY / 'jitter' / p.name)
        assert (a['trackSha256'], a['score'], a['stats']) == (b['trackSha256'], b['score'], b['stats'])
    protected = read(STUDY / 'protected-file-check.json')
    assert not protected['unexpectedChanges']
    tests = (STUDY / 'final-tests.log').read_text()
    assert '79 passed' in tests and '13 passed' in tests
    types = read(STUDY / 'typecheck-delta.json')
    assert types['referenceErrors'] == types['currentErrors'] == 251 and not types['delta']
    old_qualification = previous['qualification']
    budgets = [{**r, 'priorMonitorScore': next(x['current'] for x in old_qualification['perBudget']
                                               if x['budget'] == r['budget'])}
               for r in qualification['qualificationSummaries']]
    # Keep large checkpoints, raw tracks, CPU profiles and source tarballs local.
    artifacts = [p for p in STUDY.iterdir() if p.is_file() and
                 p.suffix in ('.json', '.ts', '.patch', '.log', '.mjs', '.gz', '.cpuprofile')]
    artifacts += list(STUDY.glob('*/plan.json')) + list(STUDY.glob('*/summary.json'))
    artifacts += [Path('scripts/benchmark/analyze_compiler_integrity.py'), STUDY / 'final.md.checkpoint.jsonl']
    result = {
        'schema': 'line.compiler-integrity-audit-validation.v1', 'date': '2026-09-08',
        'branch': 'codex/compiler-integrity-audit', 'referenceCommit': '990a6067',
        'compilerCommit': canonical['git']['head'], 'intermediateCompilerCommit': intermediate['git']['head'],
        'constraint': 'Fixed V2 benchmark, scorer, authored targets, detector, physics and actual-frame meter; coherent normal type-0 arcs.',
        'decision': 'Promote the accepted aggregate improvement and disclose qualification and lower-budget tradeoffs.',
        'compilerIdentity': {k: canonical['git'][k] for k in
                             ('candidateFingerprint', 'compilerSourceFingerprint', 'engineArtifactFingerprint')},
        'fixedIdentity': {k: canonical['identity'][k] for k in fixed_keys},
        'protectedFiles': protected,
        'canonical': {
            'baseHeadline': comparison['decision']['result']['baseHeadline'],
            'headline': canonical['canonicalHeadline'], 'delta': comparison['decision']['result']['delta'],
            'sources': len(canonical['sources']), 'runs': len(canonical['runs']), 'valid': 352,
            'actualSeeds': sorted({r['task']['actualSeed'] for r in canonical['runs']}),
            'distinctTracks': len({r['trackHash'] for r in canonical['runs']}),
            'maxFrames': max(r['stats']['sim_frames'] for r in canonical['runs']),
            'totalFrames': sum(r['stats']['sim_frames'] for r in canonical['runs']),
            'sequential': comparison['sequential'],
            'catalogSensitivity': comparison['decision']['result']['uncertainty']['catalogSensitivity'],
            'perSource': comparison['decision']['result']['perCase'],
            'all352TrackReportFrameScoreEqualBeforeRetryCorrection': True,
            'note': 'Zero-jitter repetitions are 44 distinct tracks, not 352 independent geometries.'},
        'qualification': {'role': 'Reused diagnostic regression panel, not a fresh holdout.',
                          'runs': 120, 'valid': 120, 'allWithinBudget': True,
                          'priorMonitor': old_qualification['monitor'],
                          'monitor': qualification['qualificationMonitorScore'], 'perBudget': budgets},
        'jitter': {**jitter, 'seeds': [101, 102, 103, 104], 'jitter': .02,
                   'allTrackScoreAndStatsEqualBeforeRetryCorrection': True},
        'lowBudget150k': {'referenceScore': 504.1253, 'referenceValid': 39,
                         'memoOnly': panel('final-150000'), 'final': panel('combined-150000'),
                         'retryCorrection': read(STUDY / 'retry-low-budget-comparison.json')},
        'oneMillion': {'role': 'Full 44-case single-seed public compiler study, not the canonical headline.',
                       **panel('combined-1000000')},
        'observedDuplicateWork': read(STUDY / 'observed-analysis.json'),
        'retainedSearch': read(STUDY / 'retained-search-analysis.json'),
        'planningReproduction': read(STUDY / 'planning-comparison.json'),
        'correctnessBeforeMemoParity': read(STUDY / 'correctness-parity.json'),
        'geometry': read(STUDY / 'geometry-audit.json'),
        'earlyContactIndependentReplay': read(STUDY / 'early-replay.json'),
        'cpuProfile': read(STUDY / 'cpu-profile-analysis.json'),
        'tests': {'passed': 79, 'files': 13, 'typecheck': types},
        'limitations': [
            'Three development cases remain incomplete at 150k.',
            'Legacy fallback expansions can overrun the declared budget; the actual meter reports this honestly.',
            'Empty-batch native handle aliasing remains possible outside the corrected arc compiler call sites.',
            'Full-prefix detector rescanning and incomplete response proposal batches remain measured opportunities.',
            'Deep inspection covers current arcs and shared/legacy boundaries, not every historical aiming/readiness branch.',
            'Repository TypeScript checking still has 251 existing diagnostics.',
            'No new videos were rendered for this audit.'],
        'localArtifacts': [{'path': str(p), 'bytes': p.stat().st_size, 'sha256': sha(p)}
                           for p in sorted(set(artifacts))],
    }
    OUTPUT.write_text(json.dumps(result, indent=2) + '\n')
    Path(str(OUTPUT) + '.sha256').write_text(sha(OUTPUT) + '  ' + str(OUTPUT) + '\n')
    print(json.dumps({'headline': result['canonical']['headline'], 'qualification': result['qualification']['monitor'],
                      '150k': result['lowBudget150k']['final'], '1M': result['oneMillion'],
                      'artifacts': len(artifacts)}))


if __name__ == '__main__':
    main()
