"""Compact all completed development outcomes, including invalid tracks.

Raw tracks, arrays, media and failed-launch logs remain in generated/. This is
research evidence; only the separately frozen V6 runner produces its headline.
"""
import argparse, gzip, hashlib, json, math
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--studies', required=True, help='Comma-separated generated/intentional-motion subdirectories')
parser.add_argument('--out', required=True)
args = parser.parse_args()
root = Path('generated/intentional-motion')
rows = []
compilers = {}
for study in args.studies.split(','):
    directory = root / study
    for path in sorted(directory.glob('*.json')):
        data = path.read_bytes()
        r = json.loads(data)
        if 'id' not in r:
            continue
        if 'error' in r:
            rows.append(dict(study=study, id=r['id'], error=r['error'], source=str(path), sha256=hashlib.sha256(data).hexdigest()))
            continue
        errors = {}
        for gap in r['report']['gaps']:
            for axis, value in gap['axes'].items():
                if value and value.get('error') is not None:
                    errors.setdefault(axis, []).append(value['error'])
        opening = [g['axes']['impact']['error'] for g in r['report']['gaps'] if g.get('t_end', math.inf) <= 3 and g['axes'].get('impact')]
        compiler_key = r['compiler']['candidateFingerprint']
        compilers[compiler_key] = r['compiler']
        score = {k: v for k, v in r['score'].items() if k != 'hardFailures'}
        score['hardFailureCount'] = len(r['score'].get('hardFailures', []))
        rows.append(dict(study=study, id=r['id'], song=r['song'], seed=r['seed'], budget=r['budget'],
            compiler=compiler_key, changes=r['changes'], valid=r['valid'], score=score,
            fulfilled=r['realization']['fulfilledSections'], requested=r['realization']['requested'],
            failedRequests=[{k: s[k] for k in ['section', 'construction', 'guidance', 'reasons']} for s in r['realization']['sections'] if not s['fulfilled']],
            motion=r['motion']['full'], opening=r['motion']['opening'],
            openingImpactRms=math.sqrt(sum(x*x for x in opening)/len(opening)) if opening else None,
            axisRms={a: math.sqrt(sum(x*x for x in xs)/len(xs)) for a, xs in errors.items()},
            physicalFrames=r['physicalFrames'], ms=r['ms'], failure=r.get('failure'),
            examples=r.get('examples'),constructionPolicies=r.get('constructionPolicies'),forkInput=r.get('forkInput'),
            initialProposalWork=r.get('initialProposalWork'),refinement=r.get('refinement'),constructionImprovement=r.get('constructionImprovement'),
            observedReceiverWork=r.get('observedReceiverWork'),coupledIntervalWork=r.get('coupledIntervalWork'),
            attempts=r.get('attempts'),attemptWork=r.get('attemptWork'),completionFirst=r.get('completionFirst'),
            source=str(path), sha256=hashlib.sha256(data).hexdigest(),
            planSha256=hashlib.sha256(json.dumps(r['plan'], sort_keys=True, separators=(',', ':')).encode()).hexdigest()))
    # Startup/import failures can precede the probe's structured error handler.
    for path in sorted(directory.glob('*.log')):
        text = path.read_text()
        if ('SyntaxError:' in text or 'Error:' in text) and not any(line.startswith('{"id":') for line in text.splitlines()):
            structured = next((r for r in rows if r.get('study') == study and r.get('id', '').rsplit('-', 1)[0] == path.stem and 'error' in r), None)
            if structured is not None:
                structured['log'] = dict(source=str(path), sha256=hashlib.sha256(path.read_bytes()).hexdigest())
                continue
            rows.append(dict(study=study, launchFailure=True, source=str(path), sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                error=next((line for line in text.splitlines() if 'Error:' in line), 'See retained log')))
result = dict(schema='line.intentional-motion-research.v1', studies=args.studies.split(','), compilers=compilers, rows=rows,
    interpretation='Completed development outcomes, unfiltered. Missing scheduled/in-progress outcomes must be reported in the campaign ledger. Probe scores are not canonical V6 headlines. Compilation frames exclude independent research judgment; wall times share a host.')
out = Path(args.out);out.parent.mkdir(parents=True, exist_ok=True)
body = (json.dumps(result, indent=2)+'\n').encode()
if out.suffix == '.gz': body = gzip.compress(body, compresslevel=9, mtime=0)
out.write_bytes(body)
Path(str(out)+'.sha256').write_text(hashlib.sha256(body).hexdigest()+'\n')
print(json.dumps(dict(rows=len(rows), bytes=len(body))))
