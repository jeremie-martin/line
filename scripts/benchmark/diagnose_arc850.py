"""Compare measured local estimates with final observations on the 828 baseline."""
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

root = Path('generated/benchmark-v2/arc-825/full-policy12-adaptive')


def read(path):
    body = path.read_bytes()
    assert hashlib.sha256(body).hexdigest() == Path(str(path) + '.sha256').read_text().strip()
    return json.loads(body)


audit = read(Path('generated/benchmark-v2/arc-825/final-geometry-audit.json'))
plan = read(root / 'plan.json')
totals = defaultdict(Counter)
boundary = Counter()
cases = []
for source in plan['sourceIds']:
    path = root / (source + '.json')
    record = read(path)
    binding = next(r for r in audit['rows'] if r['source'] == source)
    assert binding['reportMatches'] and binding['scoreMatches'] and binding['framesMatch']
    assert record['score']['valid'] and record['stats']['sim_frames'] <= 750000
    losses = []
    for gap in record['report']['gaps']:
        index = gap['gap_index']
        row = record['rows'][index]
        for axis, value in gap['axes'].items():
            if axis not in ('air', 'speed', 'amplitude'):
                continue
            local, target, final = row['achieved'][axis], value['target'], value['achieved']
            t = totals[axis]
            t['observations'] += 1
            t['finalSquaredError'] += (final - target) ** 2
            t['localSquaredError'] += (local - target) ** 2
            t['differenceSquaredError'] += (final - local) ** 2
            t['summedBias'] += final - local
            n = row['next'] - (0 if index == 0 else row['frame'])
            estimated = local * n / (n + 1) if axis == 'air' else local
            t['groundedBoundaryEstimateSquaredError'] += (final - estimated) ** 2
        losses.append(sum(v['error'] ** 2 * (1 / 3 if a == 'amplitude' else 1)
                          for a, v in gap['axes'].items()))
        start = round((record['report']['gaps'][index - 1]['t_end'] if index else 0) * 40)
        end = round(gap['t_end'] * 40)
        boundary['startShift' + str((row['frame'] if index else 0) - start)] += 1
        boundary['endShift' + str(row['next'] - end)] += 1
    cases.append({'source': source, 'recordSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                  'score': record['score']['score'], 'components': record['score']['components'],
                  'meanLocalDiagnosticLoss': sum(losses) / len(losses),
                  'topFiveGapFraction': sum(sorted(losses, reverse=True)[:5]) / sum(losses),
                  'planning': record['lookaheadStats'], 'frames': record['stats']['sim_frames']})
for t in totals.values():
    for name in ('finalSquaredError', 'localSquaredError', 'differenceSquaredError', 'groundedBoundaryEstimateSquaredError'):
        t[name + 'Rms'] = math.sqrt(t[name] / t['observations'])
result = {'schema': 'line.arc-850-baseline-diagnosis.v1', 'referenceHeadline': 828.1228,
          'note': 'Observation-pooled diagnostics, not an alternative weighted headline. Local span estimates exclude the next contact boundary. The grounded-boundary estimate is a hypothesis; the subsequent live panels test its effect.',
          'geometryAuditSha256': hashlib.sha256(Path('generated/benchmark-v2/arc-825/final-geometry-audit.json').read_bytes()).hexdigest(),
          'axes': totals, 'scheduledVersusAuthoredBoundary': boundary, 'cases': cases}
out = Path('benchmark/v2/studies/arc-850-baseline-diagnosis.json')
body = (json.dumps(result, indent=2) + '\n').encode()
out.write_bytes(body)
Path(str(out) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')
print(json.dumps({'sources': len(cases), 'out': str(out)}))
