/** Identity of the compiler that produced an artifact: the git commit, a digest
 * of any uncommitted or untracked changes to compiler-relevant paths, and the
 * native engine bytes. Two identical fingerprints mean the same compiler. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const PATHS = ['scripts', 'engine-rs/src', 'productions', 'package.json', 'package-lock.json', 'tsconfig.json'];
/** The owner's notes on a song (the spec dashboard writes them while he reviews) and the author's notes on what changed
 * (tools/music/revision.ts) are no input of a compile: a note saved while a video is being made must not reject its ride. */
const NOT_INPUTS = [':(exclude,glob)productions/*/notes.json', ':(exclude,glob)productions/*/revisions.json'];
export const ENGINE_PATH = 'engine-rs/target/wasm32-unknown-unknown/release/lr_engine.wasm';
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

export function compilerIdentity(root = '.') {
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], {encoding: 'buffer', maxBuffer: 1 << 30});
  const head = git('rev-parse', 'HEAD').toString().trim();
  const untracked = git('ls-files', '--others', '--exclude-standard', '-z', '--', ...PATHS, ...NOT_INPUTS).toString().split('\0').filter(Boolean).sort();
  const changes = createHash('sha256').update(git('diff', '--binary', 'HEAD', '--', ...PATHS, ...NOT_INPUTS));
  for (const path of untracked) changes.update(path + '\0').update(readFileSync(join(root, path)));
  const dirtySha256 = changes.digest('hex'), engineSha256 = sha(readFileSync(join(root, ENGINE_PATH)));
  return {protocol: 'line.compiler-identity.v3', head, dirtySha256, untracked: untracked.length, engineSha256,
    candidateFingerprint: sha(JSON.stringify({head, dirtySha256, engineSha256}))};
}
