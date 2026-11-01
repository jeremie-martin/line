import {beforeEach, afterEach, describe, it, expect, vi} from 'vitest';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {Writable, PassThrough} from 'node:stream';

const mocks = vi.hoisted(() => ({launch:vi.fn(), spawn:vi.fn(), build:vi.fn()}));
vi.mock('playwright', () => ({chromium:{launch:mocks.launch}}));
vi.mock('node:child_process', () => ({spawn:mocks.spawn, execFileSync:mocks.build}));
import {exportVideo, exportDimensions, exportFrameCount} from '../scripts/lib/export.ts';

let dir: string, badOrder: boolean, buffers: Buffer[], browser: any, encoder: any;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(),'line-export-')); badOrder = false; buffers = [];
  mocks.build.mockImplementation((_exe,args) => {
    if (_exe === 'ffprobe') return JSON.stringify({streams:[{nb_frames:String(buffers.length),width:buffers[0].readUInt32BE(16),height:buffers[0].readUInt32BE(20),avg_frame_rate:'60/1'}]});
    const out = args.find((a:string) => a.startsWith('--out=')).slice(6);
    mkdirSync(out,{recursive:true});writeFileSync(join(out,'video.js'),'export {};');
  });
  mocks.spawn.mockImplementation((_exe,args) => {
    encoder = new EventEmitter(); encoder.stderr = new PassThrough(); encoder.kill = vi.fn();
    encoder.stdin = new Writable({write(data,_encoding,done) {buffers.push(Buffer.from(data));done();}});
    encoder.stdin.on('finish', () => {writeFileSync(args.at(-1),'encoded video');encoder.emit('close',0);});
    return encoder;
  });
  let url: string;
  const page = {exposeFunction:vi.fn(),goto:async (value:string) => {url=value;},evaluate:async (_fn,{settings,count}:any) => {
    const png = Buffer.alloc(24);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(settings.width,16);png.writeUInt32BE(settings.height,20);
    for (let frame=0;frame<count;frame++) {
      const response = await fetch(url+'frame/'+(badOrder ? frame+1 : frame),{method:'POST',body:png});
      if (!response.ok) throw new Error(`Frame rejected: ${response.status}`);
      await response.text();
    }
  }};
  browser = {newPage:async () => page,close:vi.fn().mockResolvedValue(undefined)};
  mocks.launch.mockResolvedValue(browser);
});
afterEach(() => {rmSync(dir,{recursive:true,force:true});vi.clearAllMocks();});

const track = {duration:2,riders:[{}],lines:[]};
describe('direct video export', () => {
  it('preserves the legacy frame count, including the repeated start and terminal pose', () => {
    expect([0,1,2,160,161,2420].map(exportFrameCount)).toEqual([3,4,6,243,244,3633]);
    for (const value of [-1,1.5,NaN,Infinity]) expect(() => exportFrameCount(value)).toThrow();
  });
  it('resolves native dimensions and rejects invalid encoder sizes', () => {
    expect(exportDimensions('1080p')).toEqual({width:1920,height:1080});
    expect(exportDimensions({width:1080,height:1920})).toEqual({width:1080,height:1920});
    expect(() => exportDimensions({width:1079,height:1920})).toThrow();
    expect(() => exportDimensions({width:0,height:1920})).toThrow();
  });
  it('streams all frames in order and publishes only the completed encode', async () => {
    const output = join(dir,'ride.mp4');
    await exportVideo({trackJson:track,outPath:output,resolution:{width:4,height:6},log:()=>{}});
    expect(buffers).toHaveLength(exportFrameCount(track.duration));
    expect(readFileSync(output,'utf8')).toBe('encoded video');
    expect(readdirSync(dir)).toEqual(['ride.mp4']);
    expect(browser.close).toHaveBeenCalledOnce();
    expect(encoder.kill).toHaveBeenCalledOnce();
    expect(mocks.spawn.mock.calls[0][1]).toContain('image2pipe');
  });
  it('rejects out-of-order frames, closes resources, and preserves an existing output', async () => {
    badOrder=true; const output=join(dir,'ride.mp4');writeFileSync(output,'keep');
    await expect(exportVideo({trackJson:track,outPath:output,log:()=>{}})).rejects.toThrow('Frame rejected: 404');
    expect(readFileSync(output,'utf8')).toBe('keep');
    expect(readdirSync(dir)).toEqual(['ride.mp4']);
    expect(browser.close).toHaveBeenCalledOnce();expect(encoder.kill).toHaveBeenCalledOnce();
  });
  it('rejects unsupported tracks before starting any services', async () => {
    await expect(exportVideo({trackJson:{...track,riders:[]},outPath:join(dir,'ride.mp4')})).rejects.toThrow(/one rider/);
    expect(mocks.spawn).not.toHaveBeenCalled();expect(mocks.launch).not.toHaveBeenCalled();
  });
});
