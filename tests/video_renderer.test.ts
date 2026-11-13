import {describe, expect, it} from 'vitest';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {OPTIONS, PLAIN, THEMES, V1, resolveLook} from '../scripts/video/look.js';
import {DROP_SCHEMES, SCHEMES} from '../scripts/video/palettes.js';
import {specOf, themeId} from '../generated/concept-lab/rate/freeze.mjs';
import {buildScene, rideAccount, screenTitle} from '../scripts/video/scene.ts';
import {alignment, rideTime, songTime, songTimeOfFrame} from '../scripts/video/timing.js';
import {CLIP_BEFORE, clipBeats, momentClip, specBeats} from '../tools/measure/clip_render.ts';
import {loadMusicSpec} from '../scripts/produce/music_artifacts.ts';
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
    expect(resolveLook('hokusai', {top: 'title'})).toMatchObject({scheme: THEMES.hokusai.id, band: 'bars', top: 'title'});
  });
  it('every production theme is exactly the theme judged under its name: same specification, same id', () => {
    const registry = new Map(readFileSync('generated/concept-lab/rate/themes.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).map(r => [r.id, r]));
    expect(Object.keys(THEMES).length).toBe(67);
    for (const theme of Object.values(THEMES)) {
      const spec = specOf(resolveLook(null, theme.look), SCHEMES, DROP_SCHEMES);
      expect(themeId(spec), theme.name).toBe(theme.id);
      expect(registry.get(theme.id)?.label, theme.id).toBe(theme.name);
      expect(spec).toEqual(registry.get(theme.id)?.spec);
    }
  });
  it('refuses unknown themes, options and values instead of drawing something else', () => {
    expect(() => resolveLook('today')).toThrow(/Unknown look: today/);
    expect(() => resolveLook(null, {music: 'bars'})).toThrow(/Unknown look option: music/);
    expect(() => resolveLook(null, {band: 'blocks'})).toThrow(/Unknown band: blocks/);
    expect(() => resolveLook(null, {scheme: 'nope'})).toThrow(/Unknown scheme: nope/);
    // values of earlier rounds were retired (11 November): their keys stay, so judged ids are unchanged
    for (const [key, value] of [['drop', 'night'], ['paper', 'whisper'], ['bandHeight', 'mid'], ['sunLift', '19.2'], ['scheme', 'dune']])
      expect(() => resolveLook(null, {[key]: value})).toThrow(new RegExp(`Unknown ${key}: ${value}`));
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
  it('a production\'s look is chosen for its ride, a bare track gets the plain one; options, span and width are kept', () => {
    expect(videoRequest(['--song=x', '--seed=0', '--set=top:title'])).toMatchObject({lookName: null, look: null, overrides: {top: 'title'}, seed: 0, width: 1080});
    expect(videoRequest(['--track=t.json', '--music=petrunko_selection'])).toMatchObject({lookName: 'plain', look: resolveLook('plain')});
    expect(videoRequest(['--study=s', '--look=hokusai', '--set=top:title', '--from=20', '--to=35', '--width=540']))
      .toMatchObject({look: {scheme: THEMES.hokusai.id, top: 'title'}, from: 20, to: 35, width: 540});
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
  // a recorded ride: three requested impacts, two answered (targets 0 and 2), with its authored beats when recorded
  const evaluation = {targets: [{frame: 40, impact: 0.6}, {frame: 80}, {frame: 120, impact: 0.9}],
    events: [{contactStart: 40, onset: 41, peakFrame: 42, strength: 0.62}, {contactStart: 119, onset: 121, peakFrame: 122, strength: 0.31}],
    account: {matches: [{target: 0, event: 0}, {target: 2, event: 1}]}};
  const track = {duration: 160, lines: [], riders: []};
  it('the account is the ride\'s own, in physics frames, with its beats one to one with its targets', () => {
    expect(rideAccount({track})).toBeNull();
    const account = rideAccount({track, impactEvaluation: evaluation, beats: [0.99, 2, 2.98]})!;
    expect(account.targets).toEqual([{frame: 40, impact: 0.6, beat: 0.99}, {frame: 80, beat: 2}, {frame: 120, impact: 0.9, beat: 2.98}]);
    expect(account.events).toEqual([{onset: 41, peak: 42, strength: 0.62}, {onset: 121, peak: 122, strength: 0.31}]);
    expect(account.matches).toEqual([{target: 0, event: 0}, {target: 2, event: 1}]);
    expect(() => rideAccount({track, impactEvaluation: evaluation, beats: [1, 2]})).toThrow(/2 beats for 3 targets/);
    expect(() => rideAccount({track, impactEvaluation: {...evaluation, account: {matches: [{target: 1, event: 5}]}}})).toThrow(/missing/);
    // hits happen at their strongest frames, in the order of the targets they answer (the picture scans them so)
    const crossed = {...evaluation, account: {matches: [{target: 0, event: 1}, {target: 2, event: 0}]}};
    expect(() => rideAccount({track, impactEvaluation: crossed})).toThrow(/target 2 peaks before the one answering target 0/);
  });
  it('a ride is aligned from its own hits, or shown as compiled and says why', () => {
    expect(alignment(null)).toEqual({offset: 0, aligned: false, reason: 'no impact account'});
    expect(alignment(rideAccount({track, impactEvaluation: evaluation}))).toEqual({offset: 0, aligned: false, reason: 'no recorded beats'});
    expect(alignment(rideAccount({track, impactEvaluation: {...evaluation, account: {matches: []}}, beats: [1, 2, 3]})))
      .toEqual({offset: 0, aligned: false, reason: 'no matched hit'});
    // the mean of (strongest frame − beat): (42/40 − 0.99 + 122/40 − 2.98) / 2 = 0.065 s
    const aligned = alignment(rideAccount({track, impactEvaluation: evaluation, beats: [0.99, 2, 2.98]}));
    expect(aligned.aligned).toBe(true); expect(aligned.offset).toBeCloseTo(0.065, 12);
    expect(alignment(rideAccount({track, impactEvaluation: evaluation, beats: [1.2, 2, 3.2]})).reason).toMatch(/outside \[0, 500\] ms/);
  });
  it('a saved ride is shown over its own song, and must cover it once aligned', () => {
    const c = {id: 'petrunko_selection', audioPath: 'productions/petrunko_selection/audio.mp3', durationFrames: 120, phases: []};
    expect(() => buildScene('lua_na_praca_selection', {track, case: c})).toThrow(/of petrunko_selection, not lua_na_praca_selection/);
    // aligned 65 ms early, a 3 s song needs the ride to 3.065 s (frame 122.6): a track of 120 frames ends before it
    const short = {track: {...track, duration: 120}, impactEvaluation: evaluation, beats: [0.99, 2, 2.98], case: c};
    expect(() => buildScene('petrunko_selection', short)).toThrow(/ends before the song/);
  });
  it('one relation between the clocks: r = s + offset, and back', () => {
    for (const offset of [-0.1, 0, 0.029]) for (const s of [0, 1.25, 30]) {
      expect(songTime(rideTime(s, offset), offset)).toBeCloseTo(s, 12);
      expect(rideTime(s, offset)).toBeCloseTo(s + offset, 12);
    }
    expect(songTimeOfFrame(80, 0.05)).toBeCloseTo(1.95, 12); // frame 80 is ride time 2 s, shown 50 ms early
  });
  it('a study clip is on the compile timeline, with its song\'s authored beats as its marks', async () => {
    const clip = momentClip('petrunko_selection', track, 120);
    expect(clip.from).toBe(3 - CLIP_BEFORE); expect(clip.to).toBeCloseTo(3 - CLIP_BEFORE + 1.8, 12);
    expect(clipBeats(clip, [{t: 1.9, impact: 0.5}, {t: 2, impact: null}, {t: 2.98, impact: 0.9}, {t: 3.81, impact: 1}]))
      .toEqual([{t: 0, impact: null}, {t: 0.98, impact: 0.9}]);
    expect(() => momentClip('petrunko_selection', track, 20)).toThrow(/too early/);
    // the marks are the spec's own beats, as the compiler records them
    const beats = await specBeats('productions/petrunko_selection/spec.ts'), {beats: recorded} = await loadMusicSpec({song: 'petrunko_selection', title: '', moments: []}, 0);
    expect(beats.map(b => b.t)).toEqual(recorded);
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
