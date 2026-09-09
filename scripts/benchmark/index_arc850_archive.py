"""Verify and index the completed local archive without publishing its payloads."""
import hashlib
import json
from pathlib import Path

root = Path('archives/arc-850-852')


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def checked(name):
    path = root / name
    assert sha(path) == Path(str(path) + '.sha256').read_text().strip()
    return json.loads(path.read_text())


raw = checked('raw-panels-validation.json')
completion = checked('completion-validation.json')
for item in (raw, completion['completion'], completion['source']):
    path = Path(item['file'])
    assert path.stat().st_size == item['bytes'] and sha(path) == item['sha256']
assert sha(root / 'judge.wasm') == completion['judge']['sha256']
excluded = {'archive-index.json', 'archive-index.json.sha256', 'SHA256SUMS'}
paths = sorted(p for p in root.rglob('*') if p.is_file() and p.name not in excluded)
assert all(not p.is_symlink() for p in paths)
records = {str(p.relative_to(root)): {'bytes': p.stat().st_size, 'sha256': sha(p)} for p in paths}
result = {
    'schema': 'line.arc-850-local-archive.v1', 'localOnly': True,
    'root': str(root), 'sourceCommit': completion['source']['gitCommit'],
    'compilerCommit': json.loads(Path('benchmark/v2/studies/arc-850-validation.json').read_text())['compilerCommit'],
    'headline': 852.1248, 'budget': 750000,
    'preservationBranch': 'archive/arc-control-memory-852',
    'rawResearch': raw, 'completion': completion,
    'note': 'Full raw research and videos stay local; code, canonical compressed evidence and this index are pushed. Friendly video paths are hard links to original renders.',
    'files': records,
}
body = (json.dumps(result, indent=2) + '\n').encode()
for path in (root / 'archive-index.json', Path('benchmark/v2/studies/arc-850-local-archive.json')):
    path.write_bytes(body)
    Path(str(path) + '.sha256').write_text(hashlib.sha256(body).hexdigest() + '\n')
checks = dict(records)
for name in ('archive-index.json', 'archive-index.json.sha256'):
    checks[name] = {'sha256': sha(root / name)}
(root / 'SHA256SUMS').write_text(''.join(f'{v["sha256"]}  {name}\n' for name, v in sorted(checks.items())))
print(json.dumps({'indexedFiles': len(records), 'pathBytes': sum(v['bytes'] for v in records.values()),
                  'indexSha256': hashlib.sha256(body).hexdigest()}))
