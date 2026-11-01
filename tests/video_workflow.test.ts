import {describe, it, expect, vi, afterEach} from 'vitest';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {videoRequest} from '../scripts/produce/video_request.ts';
import {resolveVideoOptions} from '../scripts/lib/video_options.ts';
import {readVerifiedJson, verifiedVideoCell} from '../scripts/produce/video_input.ts';
import {createHash} from 'node:crypto';

const dirs: string[] = [];
afterEach(() => {for (const dir of dirs.splice(0)) rmSync(dir, {recursive:true, force:true}); vi.restoreAllMocks();});
describe('video command', () => {
  it('keeps presentation and orientation independent', () => {
    expect(videoRequest(['--song=petrunko_selection'])).toMatchObject({style:'finished',format:'vertical',render:{res:'1080x1920',zoomMult:1.8,beatPunchPct:70}});
    expect(videoRequest(['--track=ride.json'])).toMatchObject({style:'plain',audio:undefined});
    expect(videoRequest(['--study=ride','--style=plain'])).toMatchObject({format:'horizontal',render:{res:'1920x1080',beatPunchPct:0}});
    expect(videoRequest(['--study=ride','--style=finished','--format=horizontal'])).toMatchObject({style:'finished',render:{res:'1920x1080',zoomMult:1}});
    expect(videoRequest(['--track=ride.json','--audio=music.mp3','--format=vertical'])).toMatchObject({style:'plain',format:'vertical'});
  });
  it('rejects ambiguous or silently ignored requests before starting work', () => {
    for (const args of [[], ['--song=x','--study=y'], ['--study=x','--seed=12'], ['--song=x','--format=square'],
      ['--song=x','--resume'], ['--song=x','--workers=0'], ['--song=x','--workers=2.5'], ['--song=x','--zoom-mult=NaN'],
      ['--song=x','--song=y'], ['--track=x','--audio=y','--style=finished'], ['--song=x','--spec=z']])
      expect(() => videoRequest(args)).toThrow();
    expect(videoRequest(['--song=x','--seed=0','--workers=2'])).toMatchObject({seed:0,workers:2});
  });
});
describe('shared export settings', () => {
  it('preserves authored keyframes and scales the whole camera plan', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const dir = mkdtempSync(join(tmpdir(), 'line-camera-')); dirs.push(dir);
    const track = join(dir,'track.json'), spec = join(dir,'spec.mjs');
    writeFileSync(track, JSON.stringify({duration:80,lines:[]}));
    writeFileSync(spec, 'export default {duration:2,contacts:[],camera:{zoom:{smoothingFrames:6,keyframes:[{t:0,zoom:2},{t:2,zoom:4}]}}}');
    const options = await resolveVideoOptions([`--track=${track}`,`--spec=${spec}`,'--zoom=action','--zoom-mult=2','--res=1080x1920','--qp=14']);
    expect(options.zoomKeyframes).toEqual([[0,2],[80,3]]);
    expect(options.zoomSmoothing).toBe(6);
    expect(options.resolution).toEqual({width:1080,height:1920});
    expect(options.encoderSettings).toEqual({quantizationParameter:14});
    expect(options.autoZoom?.[0]).toBe(4);
    expect(options.autoZoom?.[80]).toBe(8);
  });
});

it('refuses changed artifacts and incomplete rides before rendering', () => {
  const dir = mkdtempSync(join(tmpdir(), 'line-video-input-')); dirs.push(dir);
  const path = join(dir, 'cell.json'), body = JSON.stringify({valid:false,planSha256:'plan'});
  const hash = createHash('sha256').update(body).digest('hex');
  writeFileSync(path, body); writeFileSync(path + '.sha256', hash);
  expect(readVerifiedJson(path).valid).toBe(false);
  expect(() => verifiedVideoCell(dir, {planSha256:'plan',plan:{cases:[{id:'song'}]},
    cells:[{id:'cell',caseId:'song',path:'cell.json',sha256:hash}]}, 'cell')).toThrow(/failed rides/);
  writeFileSync(path, JSON.stringify({valid:true}));
  expect(() => readVerifiedJson(path)).toThrow(/Changed artifact/);
});
