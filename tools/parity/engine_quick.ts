/** Fast saved-reference check. Writing requires an explicit new path and always
 * runs the independent oracle, never the candidate. Committed evidence is not
 * overwritten by a verification command. */
import {readFileSync, writeFileSync} from 'node:fs';
import {fixturePath, referenceFingerprints, verifyFingerprints} from './engine_fingerprints.ts';

const output = process.argv.find(a => a.startsWith('--write-reference='))?.slice('--write-reference='.length);
if (process.argv.includes('--help')) {
  console.log('check:physics: compare all saved and deterministic stress cases to committed reference fingerprints.\n' +
    '  --write-reference=<new path>  generate with the independent oracle; refuses overwrite. Review before replacing the fixture.');
} else if (output) {
  writeFileSync(output, JSON.stringify(referenceFingerprints(), null, 2) + '\n', {flag: 'wx'});
  console.log(`Independent reference written to ${output}; review provenance and changes before committing.`);
} else {
  const result = verifyFingerprints(JSON.parse(readFileSync(fixturePath, 'utf8')));
  console.log(`PASS  ${result.cases} cases, ${result.frames} exact frame states, ${result.collisions} ordered collisions (saved reference)`);
}
