"""Trainer collection checks: python -m unittest discover -s tests -p test_train_value_v3.py."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


TRAINER = Path(__file__).resolve().parents[1] / 'tools/research/train_value_v3.py'


class TrainingCollections(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.inputs = [self.root / 'first', self.root / 'second']
        for root, ids in zip(self.inputs, [('track0', 'track1', 'omitted'), ('track2', 'track3', 'track4')]):
            root.mkdir()
            plan = {'schema': 'line.value-collection.v2', 'search': {'depth': 2},
                    'work': [{'id': name, 'seed': 1, 'inputSha256': name} for name in ids]}
            (root / 'plan.json').write_text(json.dumps(plan))
            plan_sha = hashlib.sha256(json.dumps(plan, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
            for name in ids:
                if name == 'omitted':
                    continue
                record = {'id': name, 'seed': 1, 'group': name, 'budget': 1, 'complete': True,
                          'planSha256': plan_sha, 'inputSha256': name, 'trackHash': name,
                          'construction': [], 'collection': {'interrupted': False},
                          'probes': [{'index': 0, 'features': [0] * 57, 'geometry': [0] * 16,
                                      'pureFuture': future, 'depth': 2, 'contacts': 3,
                                      'localCost': 0, 'predictedFuture': future} for future in (1, 2)]}
                (root / f'{name}~1.json.gz').write_bytes(gzip.compress(json.dumps(record).encode()))

    def run_trainer(self, exclude='omitted~1', inputs=None):
        return subprocess.run(
            [sys.executable, str(TRAINER), '--inputs', ','.join(map(str, inputs or self.inputs)),
             '--out', str(self.root / 'model'), '--exclude', exclude],
            env={**os.environ, 'OMP_NUM_THREADS': '1'}, capture_output=True, text=True, timeout=30)

    def test_exclusion_in_one_collection_allows_pooled_training(self):
        # Put the collection without the excluded compile first to exercise union validation.
        result = self.run_trainer(inputs=list(reversed(self.inputs)))
        self.assertEqual(result.returncode, 0, result.stderr)
        artifact = json.loads((self.root / 'model/arc_value_model.json').read_text())
        provenance = artifact['provenance']
        self.assertEqual(provenance['excludedCompiles'], ['omitted~1'])
        self.assertEqual(len(provenance['collectionPlans']), 2)
        self.assertEqual(len(provenance['records']), 5)
        self.assertEqual(provenance['rows'], 10)

    def test_unknown_exclusion_is_rejected(self):
        result = self.run_trainer('omitted~1,unknown~1')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('excluded compiles must be declared by an input plan', result.stderr)

    def test_unexcluded_missing_record_is_rejected(self):
        (self.inputs[1] / 'track2~1.json.gz').unlink()
        result = self.run_trainer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('incomplete or undeclared collection records', result.stderr)

    def test_excluded_record_still_present_is_rejected(self):
        result = self.run_trainer('omitted~1,track2~1')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('incomplete or undeclared collection records', result.stderr)


if __name__ == '__main__':
    unittest.main()
