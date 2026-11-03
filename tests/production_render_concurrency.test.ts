import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {renderBundle} from '../scripts/produce/render.ts';
vi.mock('node:child_process', () => ({spawn: vi.fn()}));
let root: string, spectrum: string;
const children: {cmd: string; args: string[]; finish(code?: number): void}[] = [];
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'line-render-'));
  spectrum = root.split('/').at(-1)! + '.json';
  mkdirSync('remotion/public', {recursive: true});
  writeFileSync(join('remotion/public', spectrum), '{}');
  writeFileSync(join(root, 'work.json'), '{"work":true}');
  children.length = 0;
  vi.mocked(spawn).mockImplementation(((cmd: string, args: string[]) => {
    const child = new EventEmitter();
    children.push({cmd, args, finish(code = 0) {
      if (code === 0) {
        const output = args.find(s => s.startsWith('--out='))?.slice(6) ?? (cmd === 'ffmpeg' ? args.at(-1)! : args[4]);
        writeFileSync(output, args.includes('scripts/make_overlay_data.ts') ? '{"durationS":12}' : 'video');
      }
      child.emit('exit', code);
    }});
    return child;
  }) as any);
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, {recursive: true, force: true});
  rmSync(join('remotion/public', spectrum), {force: true});
});
function input(): Parameters<typeof renderBundle>[0] {
  return {song: 'test', seed: 1, workDir: root, outDir: join(root, 'out'), workPath: join(root, 'work.json'),
    spectrumBase: spectrum, render: {beatPunchPct: 0, zoomMult: 1, res: '720x1280'}, metrics: {score: 1, standTimePct: 100, rotations: 0},
    trackPath: 'track.json', specPath: 'spec.ts', reportPath: 'report.json', audioPath: 'song.mp3', jolt: 0,
    project: 'test', gitSha: 'test', host: 'test', budget: 1} as any;
}
const settle = async () => {for (let i = 0; i < 12; i++) await Promise.resolve();};

it('overlaps ride and overlay preparation, then waits for both before composition and publication', async () => {
  const result = renderBundle(input());
  expect(children).toHaveLength(2);
  expect(children[0].args).toContain('scripts/export.ts');
  expect(children[1].args).toContain('scripts/make_overlay_data.ts');
  children[0].finish(); await settle();
  expect(children[2].cmd).toBe('ffmpeg');
  children[2].finish(); await settle();
  expect(children).toHaveLength(3); // overlay is still pending
  expect(existsSync(join(root, 'out/test/test-s1'))).toBe(false);
  children[1].finish(); await settle();
  expect(children[3].cmd).toBe('npx');
  expect(JSON.parse(children[3].args.find(s => s.startsWith('--props='))!.slice(8)).durationS).toBe(12);
  children[3].finish();
  const final = await result;
  expect(readFileSync(join(final, 'video.mp4'), 'utf8')).toBe('video');
  expect(JSON.parse(readFileSync(join(final, 'work.json'), 'utf8'))).toEqual({work: true});
  expect(JSON.parse(readFileSync(join(final, 'upload.json'), 'utf8')).song).toBe('test');
  expect(existsSync(join(root, 'test-s1.remotion-public'))).toBe(false);
});

it.each(['ride', 'overlay'])('waits for active writers before cleanup when %s fails', async failed => {
  let settled = false;
  const result = renderBundle(input()).then(() => {settled = true; return null;}, error => {settled = true; return error;});
  expect(children).toHaveLength(2);
  children[failed === 'ride' ? 0 : 1].finish(1); await settle();
  expect(settled).toBe(false);
  expect(existsSync(join(root, 'test-s1.remotion-public'))).toBe(true);
  children[failed === 'ride' ? 1 : 0].finish(); await settle();
  if (failed === 'overlay') {expect(children[2].cmd).toBe('ffmpeg'); children[2].finish();}
  expect(await result).toBeInstanceOf(Error);
  expect(children.some(c => c.cmd === 'npx')).toBe(false);
  expect(existsSync(join(root, 'test-s1.remotion-public'))).toBe(false);
  expect(existsSync(join(root, 'out/test/test-s1'))).toBe(false);
});
