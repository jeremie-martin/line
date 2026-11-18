import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it} from 'vitest';
import {cutAudio, cutDrums, cutEvents, cutLines, cutNotes, cutSong, cutSource, cutStems, cutSung, cutVocalEvidence, cutWav, savedCut, shift} from '../tools/music/cut.ts';

const c = {from: 10, length: 5}; // the new song is the parent's 10–15 s

it('shifts a time without adding float noise', () => {
  expect(shift(25.867, 25.791)).toBe(0.076); expect(shift(18.1347846, 2.616)).toBe(15.5187846); expect(shift(12, 10)).toBe(2);
});

it('keeps an event only when its time and every stem time are inside, shifted', () => {
  const ev = (t: number, d = 0) => ({t, sources: {drums: {t: t + d, peak: 0.5, rise: 0.4, classes: ['kick']}, vocals: {t, peak: 0.1, rise: 0.1}}, mix: {peak: 0.6, rise: 0.5}});
  const out = cutEvents({schema: 'line.music-events.v1', song: 'p', events: [ev(9.99), ev(10), ev(12.5), ev(14.98, 0.03), ev(14.99), ev(15)]}, c, 'n');
  expect(out.data.song).toBe('n');
  expect(out.data.events.map((e: any) => e.t)).toEqual([0, 2.5, 4.99]); // 14.98 has a drum time past the end
  expect(out.data.events[1]).toEqual({t: 2.5, sources: {drums: {t: 2.5, peak: 0.5, rise: 0.4, classes: ['kick']}, vocals: {t: 2.5, peak: 0.1, rise: 0.1}}, mix: {peak: 0.6, rise: 0.5}});
  expect([out.kept, out.dropped]).toEqual([3, 3]);
});

it('keeps sung notes with their events and clips a held note at the end', () => {
  const out = cutSung({song: 'p', notes: [{t: 10.2, dur: 0.3, interval: 2, salience: 0.5, event: {t: 10.21, stems: ['vocals']}}, {t: 14.8, dur: 0.5, event: null}, {t: 10.01, dur: 0.2, event: {t: 9.99, stems: []}}],
    unpitched: [{t: 9.5, event: null}, {t: 11, event: null}]}, c, 'n');
  expect(out.data.notes).toEqual([{t: 0.2, dur: 0.3, interval: 2, salience: 0.5, event: {t: 0.21, stems: ['vocals']}}, {t: 4.8, dur: 0.2, event: null}]);
  expect(out.data.unpitched).toEqual([{t: 1, event: null}]);
  expect([out.kept, out.dropped]).toEqual([3, 2]);
});

it('cuts the vocal evidence: candidates with their landmarks inside, frame arrays from the frame nearest the start', () => {
  const frames = 3000, data = {song: 'p', sampleRate: 22050, hopSamples: 256, duration: frames * 256 / 22050, rms: Array.from({length: frames}, (_, i) => i), spectralChange: Array.from({length: frames}, (_, i) => i ? i : null),
    bandFlux: [{name: 'low', values: Array.from({length: frames}, (_, i) => -i)}],
    candidates: [{t: 10.05, kind: 'spectral-onset', landmarks: {precedingMinimumT: 9.98, minimumAtClipStart: false, steepestRiseT: 10.03, risePerSecond: 1}},
      {t: 11, kind: 'spectral-onset', landmarks: {precedingMinimumT: 10.9, minimumAtClipStart: false, steepestRiseT: null, risePerSecond: null}}]};
  const out = cutVocalEvidence(data, c, 'n', 5);
  const first = Math.round(10 * 22050 / 256); // 861: 9.9954 s
  expect(out.data.rms[0]).toBe(first); expect(out.data.bandFlux[0].values[0]).toBe(-first);
  expect(out.data.rms.length).toBe(1 + Math.floor(5 * 22050 / 256)); expect(out.data.spectralChange.length).toBe(out.data.rms.length);
  expect(Math.abs(out.offset)).toBeLessThanOrEqual(256 / 22050 / 2); expect(out.data.duration).toBe(5);
  expect(out.data.candidates).toEqual([{t: 1, kind: 'spectral-onset', landmarks: {precedingMinimumT: 0.9, minimumAtClipStart: false, steepestRiseT: null, risePerSecond: null}}]);
});

it('re-phases the beat of lines.json and shifts every stem note', () => {
  const data = {song: 'p', seconds: 20.95, bar: {seconds: 1.92, repeats: 0.5, first: 0.422}, stems: {drums: [{t: 9.98, attack: 1}, {t: 10.022, attack: 2}, {t: 14.999, attack: 1}, {t: 15.1, attack: 1}], vocals: []}};
  const out = cutLines(data, c, 'n');
  expect(out.data.stems.drums).toEqual([{t: 0.022, attack: 2}, {t: 4.999, attack: 1}]);
  // a beat of 0.48 s at 0.422 + k·0.48 falls at 10.022 in the parent: 0.022 in the cut, and every beat stays a beat
  expect(out.data.bar).toEqual({seconds: 1.92, repeats: 0.5, first: 0.022}); expect(out.data.seconds).toBe(5);
  const beats = (0.422 - 10 - out.data.bar.first) / 0.48; expect(Math.abs(beats - Math.round(beats))).toBeLessThan(1e-9);
});

it('cuts both forms of audio.json: frames, beats and onsets inside, segments clipped', () => {
  const times = Array.from({length: 900}, (_, i) => Number((i * 512 / 22050).toFixed(3)));
  const full = {audio: 'productions/p/audio.mp3', duration: 20.9, analysis: {hop: 512, n_frames: 900}, tempo: {librosa_bpm: 120}, frames: {times, rms: times.map(t => t * 2)},
    onsets: [{t: 9.9}, {t: 10.4, strength: 1}], beat_grid: {bpm: 120, beats: [{t: 10.25, meter_pos: 2}, {t: 15.25, meter_pos: 1}], downbeats: [9.75, 10.25, 14.9]},
    segments: [{t0: 0, t1: 11, mean_rms: 1}, {t0: 11, t1: 13, mean_rms: 2}, {t0: 13, t1: 20.9, mean_rms: 3}, {t0: 20.9, t1: 21, mean_rms: 4}]};
  const out = cutAudio(full, c, 'n');
  expect(out.data.audio).toBe('productions/n/audio.mp3'); expect(out.data.duration).toBe(5);
  expect(out.data.frames.times[0]).toBeGreaterThanOrEqual(0); expect(out.data.frames.times[0]).toBeLessThan(512 / 22050);
  expect(out.data.frames.times.at(-1)).toBeLessThan(5); expect(out.data.frames.rms[0]).toBeCloseTo((out.data.frames.times[0] + 10) * 2, 6);
  expect(out.data.analysis.n_frames).toBe(out.data.frames.times.length);
  expect(out.data.onsets).toEqual([{t: 0.4, strength: 1}]); expect(out.data.beat_grid.beats).toEqual([{t: 0.25, meter_pos: 2}]); expect(out.data.beat_grid.downbeats).toEqual([0.25, 4.9]);
  expect(out.data.segments).toEqual([{t0: 0, t1: 1, mean_rms: 1}, {t0: 1, t1: 3, mean_rms: 2}, {t0: 3, t1: 5, mean_rms: 3}]);
  const plain = cutAudio({duration: 20, tempo: {librosa_bpm: 107}, beat_times: [9.5, 10.5, 15.5], method: 'librosa'}, c, 'n');
  expect(plain.data).toEqual({duration: 5, tempo: {librosa_bpm: 107}, beat_times: [0.5], method: 'librosa'});
});

it('cuts stems.json and drums.json alike', () => {
  const fs = 512 / 44100, times = Array.from({length: 1800}, (_, i) => Number((i * fs).toFixed(4))), env = {rms: times.map((_, i) => i), onsets: [{t: 10.1, peak: 1, rise: 1}, {t: 16, peak: 1, rise: 1}]};
  const out = cutStems({song: 'p', frame_s: fs, times, mix: env, stems: {drums: env}}, c, 'n');
  expect(out.data.times[0]).toBeLessThan(fs); expect(out.data.mix.rms.length).toBe(out.data.times.length); expect(out.data.stems.drums.rms[0]).toBe(times.findIndex(t => t >= 10));
  expect(out.data.stems.drums.onsets).toEqual([{t: 0.1, peak: 1, rise: 1}]);
  expect(cutDrums({model: 'm', hits: [{t: 9, class: 'kick'}, {t: 11.5, class: 'snare'}]}, c, 'n').data).toEqual({model: 'm', hits: [{t: 1.5, class: 'snare'}]});
});

it('keeps the owner’s notes inside, ranges clipped, ids and tags kept', () => {
  const note = (id: string, t: number, extra = {}) => ({id, t, scope: 'moment', index: null, t0: null, t1: null, axis: null, title: `moment 0:${t.toFixed(2).padStart(5, '0')}`, text: '', tags: ['mark'], ...extra});
  const out = cutNotes({specPath: 'productions/p/spec.ts', notes: [note('moment:9000', 9), note('moment:12500', 12.5), note('range:1', 9, {scope: 'range', t0: 9, t1: 11, title: 'range'}), note('range:2', 16, {scope: 'range', t0: 16, t1: 17})]}, c, 'n');
  expect(out.data.specPath).toBe('productions/n/spec.ts');
  expect(out.data.notes).toEqual([note('moment:12500', 2.5, {title: 'moment 0:02.50'}), note('range:1', 0, {scope: 'range', t0: 0, t1: 1, title: 'range'})]);
  expect([out.kept, out.dropped]).toEqual([2, 2]);
});

it('moves the excerpt in its recording and drops what would be false of the cut', () => {
  const parent = {file: 'r.webm', sha256: 'R', sourceStartSeconds: 7.3, sourceEndSeconds: 85.8, decodedExcerptSeconds: 78.5, audioSha256: 'A', match: {start: 1, end: 1}, separation: {model: 'h', stemSha256: {drums: 'x'}}, title: 'T'};
  expect(cutSource(parent, {...c, to: 15}, 'p', {audio: 'B', stems: {drums: 'y'}})).toEqual({file: 'r.webm', sha256: 'R', sourceStartSeconds: 17.3, sourceEndSeconds: 22.3, decodedExcerptSeconds: 5, audioSha256: 'B',
    separation: {model: 'h', stemSha256: {drums: 'y'}}, title: 'T', cutOf: {song: 'p', from: 10, to: 15}});
  expect(cutSource(null, {...c, to: 15}, 'p', {audio: 'B', stems: {}})).toEqual({file: 'p.mp3', sourceStartSeconds: 10, sourceEndSeconds: 15, cutOf: {song: 'p', from: 10, to: 15}});  // the parent is the recording
});

it('reads the owner’s latest cut for a song', () => {
  const rows = [{clip: 'a', at: '2026-11-18T11:00:00Z', answers: {start: 1, end: 9}}, {clip: 'b', at: '2026-11-18T11:00:01Z', answers: {start: 0, end: 5}}, {clip: 'a', at: '2026-11-18T11:00:02Z', answers: {start: 2.5, end: 9}}];
  expect(savedCut(rows.map(r => JSON.stringify(r)).join('\n'), 'a')).toEqual({from: 2.5, to: 9}); expect(() => savedCut('', 'a')).toThrow();
});

const wav = (rate: number, frames: number, channels = 2) => {
  const pcm = Buffer.alloc(frames * channels * 2); for (let i = 0; i < frames * channels; i++) pcm.writeInt16LE(i % 30000, i * 2);
  const head = Buffer.alloc(44); head.write('RIFF', 0); head.writeUInt32LE(36 + pcm.length, 4); head.write('WAVEfmt ', 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(channels, 22);
  head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * channels * 2, 28); head.writeUInt16LE(channels * 2, 32); head.writeUInt16LE(16, 34); head.write('data', 36); head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
};

it('cuts a WAV file to the sample, bytes unchanged', () => {
  const file = wav(1000, 3000), {wav: out, frames, rate} = cutWav(file, 1.5, 1);
  expect([frames, rate]).toEqual([1000, 1000]); expect(out.readUInt32LE(40)).toBe(4000); expect(out.readUInt32LE(4)).toBe(out.length - 8);
  expect(out.subarray(44).equals(file.subarray(44 + 1500 * 4, 44 + 2500 * 4))).toBe(true);
});

it('makes a song of a cut end to end, refuses an existing folder, and with --force rewrites only its own files', () => {
  const root = mkdtempSync(join(tmpdir(), 'cut-')), p = join(root, 'productions/p'), stems = join(root, 'generated/stems/p');
  try {
    mkdirSync(p, {recursive: true}); mkdirSync(stems, {recursive: true});
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=4', '-ac', '2', '-c:a', 'libmp3lame', '-q:a', '2', join(p, 'audio.mp3')]);
    for (const s of ['drums', 'bass', 'other', 'vocals']) writeFileSync(join(stems, `${s}.wav`), wav(44100, 4 * 44100));
    writeFileSync(join(p, 'events.json'), JSON.stringify({song: 'p', events: [{t: 0.5, sources: {drums: {t: 0.5, peak: 1, rise: 1}}, mix: {peak: 1, rise: 1}}, {t: 1.75, sources: {drums: {t: 1.75, peak: 1, rise: 1}}, mix: {peak: 1, rise: 1}}]}));
    writeFileSync(join(p, 'lines.json'), JSON.stringify({song: 'p', seconds: 3.95, bar: {seconds: 2, repeats: 0.5, first: 0.25}, stems: {drums: [{t: 0.5}, {t: 1.75}, {t: 3.5}]}}));
    writeFileSync(join(p, 'source.json'), JSON.stringify({file: 'r.mp3', sha256: 'R', sourceStartSeconds: 20, sourceEndSeconds: 24, match: {start: 1, end: 1}}, null, 2) + '\n');
    const report = cutSong({root, parent: 'p', name: 'n', from: 1.25, to: 3.125});
    const n = join(root, 'productions/n');
    expect(report.length).toBe(1.875);
    const frames = execFileSync('ffmpeg', ['-v', 'error', '-i', join(n, 'audio.mp3'), '-f', 'f32le', '-'], {maxBuffer: 1 << 28}).length / 8;
    expect(frames).toBe(1.875 * 48000);
    expect(JSON.parse(readFileSync(join(n, 'events.json'), 'utf8')).events.map((e: any) => e.t)).toEqual([0.5]);
    expect(JSON.parse(readFileSync(join(n, 'lines.json'), 'utf8')).bar.first).toBe(0); // 0.25 − 1.25 modulo a beat of 0.5
    expect(JSON.parse(readFileSync(join(n, 'source.json'), 'utf8'))).toEqual({file: 'r.mp3', sha256: 'R', sourceStartSeconds: 21.25, sourceEndSeconds: 23.125, cutOf: {song: 'p', from: 1.25, to: 3.125}});
    expect(readFileSync(join(root, 'generated/stems/n/drums.wav')).length).toBe(44 + Math.round(1.875 * 44100) * 4);
    expect(report.lineCheck).toMatch(/^1 notes, largest/);
    writeFileSync(join(n, 'spec.ts'), '// an author’s\n');
    expect(() => cutSong({root, parent: 'p', name: 'n', from: 1, to: 3})).toThrow(/exists/);
    rmSync(join(p, 'lines.json'));
    cutSong({root, parent: 'p', name: 'n', from: 1, to: 3, force: true});
    expect(readFileSync(join(n, 'spec.ts'), 'utf8')).toBe('// an author’s\n');
    expect(existsSync(join(n, 'lines.json'))).toBe(false); // the parent has none any more
    expect(JSON.parse(readFileSync(join(n, 'events.json'), 'utf8')).events.map((e: any) => e.t)).toEqual([0.75]);
  } finally {rmSync(root, {recursive: true, force: true});}
});
