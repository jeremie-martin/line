import {describe, expect, it} from 'vitest';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {OPTIONS, PLAIN, THEMES, V1, resolveLook} from '../scripts/video/look.js';
import {measuredHits, screenTitle} from '../scripts/video/scene.ts';
import {bestLag, frameCount, frameSize} from '../scripts/video/write.ts';
import {BODY_POINTS} from '../scripts/video/picture.js';
import {videoRequest} from '../scripts/produce/video_request.ts';
import {readVerifiedJson, verifiedVideoCell} from '../scripts/produce/video_input.ts';

describe('looks', () => {
  it('V1 sets every option, and only known values', () => {
    expect(Object.keys(V1).sort()).toEqual(Object.keys(OPTIONS).sort());
    expect(resolveLook()).toEqual(V1);
  });
  it('every theme and the plain look resolve to complete, valid looks', () => {
    for (const name of [...Object.keys(THEMES), 'plain']) expect(Object.keys(resolveLook(name)).sort()).toEqual(Object.keys(OPTIONS).sort());
    expect(resolveLook('plain')).toMatchObject(PLAIN);
    expect(resolveLook('hokusai', {top: 'title'})).toMatchObject({scheme: 'hokusai', band: 'bars', top: 'title'});
  });
  it('refuses unknown themes, options and values instead of drawing something else', () => {
    expect(() => resolveLook('today')).toThrow(/Unknown look: today/);
    expect(() => resolveLook(null, {music: 'bars'})).toThrow(/Unknown look option: music/);
    expect(() => resolveLook(null, {band: 'blocks'})).toThrow(/Unknown band: blocks/);
    expect(() => resolveLook(null, {scheme: 'nope'})).toThrow(/Unknown scheme: nope/);
    // names every object inherits are not looks, options or values
    for (const [name, overrides] of [['constructor', {}], [null, {band: 'constructor'}], [null, {scheme: 'toString'}], [null, {toString: 'x'}]] as const)
      expect(() => resolveLook(name, overrides)).toThrow(/Unknown/);
  });
});

describe('the video command', () => {
  it('refuses ambiguous, unknown or silently ignored requests before starting work', () => {
    for (const args of [[], ['--song=x', '--study=y'], ['--study=x', '--seed=12'], ['--song=x', '--song=y'], ['--track=t.json'], ['--study=x', '--music=y'],
      ['--song=x', '--format=vertical'], ['--song=x', '--look=today'], ['--song=x', '--set=band'], ['--song=x', '--set=band:blocks'],
      ['--song=x', '--from=abc'], ['--song=x', '--seed=-1'], ['--song=x', '--width=0'], ['--id=a', '--song=x']])
      expect(() => videoRequest(args), args.join(' ')).toThrow();
  });
  it('a production gets the paper look, a bare track the plain one; options, span and width are kept', () => {
    expect(videoRequest(['--song=x', '--seed=0'])).toMatchObject({lookName: 'paper', look: resolveLook('paper'), seed: 0, width: 1080});
    expect(videoRequest(['--track=t.json', '--music=petrunko_selection'])).toMatchObject({lookName: 'plain', look: resolveLook('plain')});
    expect(videoRequest(['--study=s', '--look=hokusai', '--set=top:title', '--from=20', '--to=35', '--width=540']))
      .toMatchObject({look: {scheme: 'hokusai', top: 'title'}, from: 20, to: 35, width: 540});
  });
  it('refuses changed artifacts and failed rides before rendering', () => {
    const dir = mkdtempSync(join(tmpdir(), 'line-video-input-'));
    try {
      const path = join(dir, 'cell.json'), body = JSON.stringify({valid: false, planSha256: 'plan'}), hash = createHash('sha256').update(body).digest('hex');
      writeFileSync(path, body); writeFileSync(path + '.sha256', hash);
      expect(readVerifiedJson(path).valid).toBe(false);
      expect(() => verifiedVideoCell(dir, {planSha256: 'plan', plan: {cases: [{id: 'song'}]}, cells: [{id: 'cell', caseId: 'song', path: 'cell.json', sha256: hash}]}, 'cell'))
        .toThrow(/failed rides/);
      writeFileSync(path, JSON.stringify({valid: true}));
      expect(() => readVerifiedJson(path)).toThrow(/Changed artifact/);
    } finally {rmSync(dir, {recursive: true, force: true});}
  });
});

describe('scenes', () => {
  it('hits are the ride\'s own measured onsets and strengths, for answered requests only', () => {
    const evaluation = {targets: [{frame: 40}, {frame: 80}, {frame: 120}], events: [{onset: 41, strength: 0.62}, {onset: 121, strength: 0.31}],
      account: {matches: [{target: 0, event: 0}, {target: 2, event: 1}]}};
    expect(measuredHits(evaluation)).toEqual([{t: 41 / 40, s: 0.62}, {t: 121 / 40, s: 0.31}]);
    expect(() => measuredHits({...evaluation, account: {matches: [{target: 1, event: 5}]}})).toThrow(/missing event/);
  });
  it('the on-screen title drops the artist and any parenthetical', () => {
    expect(screenTitle('Chris Grey — LET THE WORLD BURN')).toBe('LET THE WORLD BURN');
    expect(screenTitle('MONTAGEM TOMADA (Super Slowed)')).toBe('MONTAGEM TOMADA');
    expect(screenTitle('Lua na Praça')).toBe('LUA NA PRAÇA');
  });
  it('the camera follows the body points in the order compiled rides are traced in', () => {
    const recorded = /const pointIds=\[([^\]]+)\]/.exec(readFileSync('scripts/gallery/artifacts.ts', 'utf8'))![1].split(',').map(s => s.replace(/'/g, '').trim());
    expect(BODY_POINTS).toEqual(recorded);
  });
});

describe('the writer\'s arithmetic', () => {
  it('frames are 9:16 and even, at 60 per second from the first song time', () => {
    expect(frameSize(1080)).toEqual({width: 1080, height: 1920});
    expect(frameSize(540)).toEqual({width: 540, height: 960});
    for (const w of [1000, 1081, 0, 9]) expect(() => frameSize(w)).toThrow();
    expect(frameCount(0, 52.5)).toBe(3150);
    expect(frameCount(36, 37.8)).toBe(108);
    for (const [a, b] of [[-1, 2], [3, 3], [0, NaN]]) expect(() => frameCount(a, b)).toThrow();
    expect(() => frameCount(3, 3.005)).toThrow(/shorter than one frame/);
  });
  it('the audio check finds a known lag, either way, to the sample', () => {
    let seed = 7; const noise = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
    const song = Float32Array.from({length: 48000 + 4800}, noise), range = 2400;
    for (const lag of [0, 48, -480, 1000]) {
      const clip = song.subarray(range - lag, range - lag + 48000);
      expect(bestLag(Float32Array.from(clip), song, range)).toBeCloseTo(lag / 48, 6);
    }
  });
});
