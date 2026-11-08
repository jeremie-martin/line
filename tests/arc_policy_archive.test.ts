import {expect, it} from 'vitest';
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {gzipSync, brotliCompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {parseArcPolicyArtifact} from '../scripts/v0/optimizer/connected_arcs.ts';

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const model = Buffer.from(JSON.stringify({groups: {a: [1, 2, 3]}, examples: []}));

function archive(dir: string, compression: 'gzip-file' | 'brotli-file', file: string, bytes: Buffer, rawSha = sha(model)) {
  writeFileSync(join(dir, file), bytes);
  const pointer = join(dir, `${file}.pointer.json`);
  writeFileSync(pointer, JSON.stringify({schema: 'line.arc-compressed-policy.v1', compression, file,
    compressedSha256: sha(bytes), sha256: rawSha, uncompressedBytes: model.length}));
  return pointer;
}

it('reads the same model from a gzip or a brotli companion file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arc-policy-'));
  const gz = archive(dir, 'gzip-file', 'policy.json.gz', gzipSync(model));
  const br = archive(dir, 'brotli-file', 'policy.json.br', brotliCompressSync(model));
  const read = (p: string) => parseArcPolicyArtifact(Buffer.from(JSON.stringify(JSON.parse(readFileSync(p, 'utf8')))), pathToFileURL(p));
  expect(read(br)).toEqual(read(gz));
  expect(read(gz)).toEqual(JSON.parse(model.toString()));
});

it('refuses a companion file whose name does not match its compression, or whose checksum is wrong', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arc-policy-'));
  const misnamed = archive(dir, 'brotli-file', 'policy.json.gz', brotliCompressSync(model));
  expect(() => parseArcPolicyArtifact(Buffer.from(readFileSync(misnamed)), pathToFileURL(misnamed))).toThrow('invalid arc policy archive');
  const corrupt = archive(dir, 'brotli-file', 'other.json.br', brotliCompressSync(model), sha(Buffer.from('{"different":true}')));
  expect(() => parseArcPolicyArtifact(Buffer.from(readFileSync(corrupt)), pathToFileURL(corrupt))).toThrow('checksum mismatch');
});
