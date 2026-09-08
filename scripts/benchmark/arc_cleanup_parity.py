"""Replay retained public-compiler studies and compare all observable outputs.

Usage: python3 scripts/benchmark/arc_cleanup_parity.py --jobs=16
Large per-case tracks stay in generated/. The compact report includes hashes of
both evidence files and exits unsuccessfully on any difference or failed run.
"""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--reference', default='generated/benchmark-v2/arc-refinement')
parser.add_argument('--out', default='generated/benchmark-v2/compiler-foundations/parity')
parser.add_argument('--jobs', type=int, default=16)
args = parser.parse_args()
reference, output = Path(args.reference), Path(args.out)
output.mkdir(parents=True, exist_ok=True)
fields = ['budget', 'track', 'report', 'stats', 'budgetTelemetry', 'score']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(path):
    old = json.loads(path.read_text())
    budget, source, seed = old['budget'], old['sourceId'], old['seed']
    destination = output / str(budget) / path.name
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.with_suffix('.log').open('w') as log:
        result = subprocess.run([
            'node', '--import', 'tsx', 'scripts/benchmark/arc_motion_study.ts',
            f'--source={source}', f'--budget={budget}', f'--seed={seed}',
            '--options={"publicCompiler":true}', f'--out={destination}',
        ], env={**os.environ, 'LR_ENGINE': 'wasm'}, stdout=log, stderr=log)
    if result.returncode:
        return dict(source=source, budget=budget, seed=seed, error=result.returncode)
    new = json.loads(destination.read_text())
    return dict(source=source, budget=budget, seed=seed,
                differences=[key for key in fields if old[key] != new[key]],
                valid=new['score']['valid'], score=new['score']['score'],
                frames=new['stats']['sim_frames'],
                reference=str(path), referenceSha256=sha(path),
                candidate=str(destination), candidateSha256=sha(destination))


paths = sorted(p for p in reference.glob('full-r7-public-*/*.json')
               if p.name not in {'summary.json', 'plan.json'})
if len(paths) != 264:
    raise SystemExit(f'Expected 44 cases at six budgets; found {len(paths)}')
records = []
with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
    for result in pool.map(run, paths):
        records.append(result)
        print(f'{len(records)}/{len(paths)} {result["budget"]} {result["source"]} '
              f'{result.get("differences", result.get("error"))}', flush=True)
passed = all('error' not in row and not row['differences'] for row in records)
report = dict(schema='line.compiler-cleanup-parity.v1', passed=passed,
              referenceCommit='6215f0c2', comparedFields=fields, records=records)
(output / 'summary.json').write_text(json.dumps(report, indent=2) + '\n')
raise SystemExit(0 if passed else 1)
