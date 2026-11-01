/** Native drawing → lossless frame transport → FFmpeg. No editor or animation clock. */
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {execFileSync, spawn} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {chromium} from 'playwright';
export type ExportOptions = {
  /** Generated normal-line track; duration is in 40 Hz physics frames. */
  trackJson: unknown;
  outPath: string;
  zoom?: number;
  /** Dense linear zoom, indexed by physics frame. */
  autoZoom?: number[];
  /** Native [physics frame, log2 zoom] keyframes, preferred over autoZoom. */
  zoomKeyframes?: [number, number][];
  zoomSmoothing?: number;
  resolution?: "720p" | "1080p" | "1440p" | "2160p" | {width:number; height:number};
  /** HQ selects QP22 instead of QP28 unless explicitly overridden. */
  hq?: boolean;
  encoderSettings?: Record<string, number>;
  headed?: boolean;
  log?: (message:string) => void;
};

const ROOT = resolve(import.meta.dirname, '../..');
const FPS = 60;

/** Keep the old exporter's repeated initial pose and its first frame past the end. */
export function exportFrameCount(physicsFrames: number): number {
  if (!Number.isSafeInteger(physicsFrames) || physicsFrames < 0) throw new Error('Track duration must be a nonnegative integer in physics frames');
  return Math.floor(physicsFrames * FPS / 40) + 3;
}

export function exportDimensions(resolution: ExportOptions['resolution']) {
  const presets = {'720p': [1280,720], '1080p': [1920,1080], '1440p': [2560,1440], '2160p': [3840,2160]};
  const [width,height] = typeof resolution === 'object' ? [resolution.width,resolution.height] : presets[resolution ?? '720p'];
  if (![width,height].every(n => Number.isSafeInteger(n) && n > 0 && n % 2 === 0)) throw new Error('Video dimensions must be positive even integers');
  return {width,height};
}

export async function exportVideo(options: ExportOptions): Promise<void> {
  const {width,height} = exportDimensions(options.resolution);
  const track = options.trackJson as {duration: number; riders: unknown[]; lines: {type:number; layer?:number}[]};
  const frameCount = exportFrameCount(track.duration);
  if (track.riders?.length !== 1 || !Array.isArray(track.lines) || track.lines.some(l => l.type !== 0 || (l.layer ?? 0) !== 0))
    throw new Error('Direct video supports generated tracks: one rider, normal lines on the base layer');
  const qp = options.encoderSettings?.quantizationParameter ?? (options.hq ? 22 : 28);
  if (!Number.isInteger(qp) || qp < 0 || qp > 51) throw new Error('Video QP must be an integer in [0,51]');
  if (Object.keys(options.encoderSettings ?? {}).some(key => key !== 'quantizationParameter')) throw new Error('Direct video accepts only the quantizationParameter encoder override');
  const log = options.log ?? console.log, began = performance.now();
  const output = resolve(options.outPath);
  mkdirSync(dirname(output), {recursive:true});
  const scratch = mkdtempSync(join(dirname(output), '.video-'));
  const movie = join(scratch, 'video.mp4'), bundle = join(scratch, 'renderer');
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let encoder: ReturnType<typeof spawn> | undefined;
  const token = '/' + randomUUID() + '/', assets = new Map<string, {type:string; bytes:Buffer}>();
  let received = 0, failure: Error | undefined;
  const server = createServer(async (req,res) => {
    try {
      if (req.method === 'GET' && assets.has(req.url!)) {
        const asset = assets.get(req.url!)!; res.setHeader('Content-Type',asset.type); res.end(asset.bytes); return;
      }
      if (req.method !== 'POST' || req.url !== `${token}frame/${received}` || received >= frameCount) {
        res.writeHead(404).end(); return;
      }
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > width * height * 5 + 65536) throw new Error('Oversized video frame');
        chunks.push(chunk);
      }
      if (failure) throw failure;
      const png = Buffer.concat(chunks);
      if (png.length < 24 || png.subarray(0,8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height)
        throw new Error('Invalid video frame');
      await new Promise<void>((done,fail) => encoder!.stdin!.write(png, error => error ? fail(error) : done()));
      received++; res.end('ok');
    } catch (error) {
      failure = error as Error; res.writeHead(500).end(String(error));
    }
  });
  try {
    execFileSync(process.execPath, ['scripts/gallery/build_renderer.mjs', `--out=${bundle}`], {cwd:ROOT, stdio:'pipe'});
    assets.set(token, {type:'text/html',bytes:Buffer.from('<!doctype html><canvas></canvas>')});
    assets.set(token+'renderer.js', {type:'text/javascript',bytes:readFileSync(join(bundle,'video.js'))});
    assets.set(token+'bosh.svg', {type:'image/svg+xml',bytes:readFileSync(join(ROOT,'mirror/_v2153.0/bosh-sprite.svg'))});
    encoder = spawn('ffmpeg', ['-v','error','-xerror','-y','-f','image2pipe','-c:v','png','-framerate',String(FPS),'-i','pipe:0',
      '-an','-c:v','libx264','-preset','fast','-g','1','-bf','0','-qp',String(qp),'-threads','4','-pix_fmt','yuv420p','-movflags','+faststart',movie], {stdio:['pipe','ignore','pipe']});
    let encoderErrors = '';
    encoder.stderr!.on('data', data => {encoderErrors = (encoderErrors + data).slice(-8192);});
    encoder.stdin!.on('error', error => {failure = error;});
    const complete = new Promise<void>((done,fail) => {
      encoder!.once('error', fail);
      encoder!.once('close', code => code === 0 ? done() : fail(new Error(`FFmpeg exited ${code}: ${encoderErrors}`)));
    });
    // Attach immediately: startup/pipe failures can occur before the browser is ready.
    void complete.catch(error => {failure = error;});
    server.listen(0,'127.0.0.1'); await once(server,'listening');
    const port = (server.address() as {port:number}).port;
    const env = {...process.env};
    if (env.LR_SCRUB_DISPLAY === '1' || (env.LR_KEEP_DISPLAY !== '1' && /^(localhost|127\.0\.0\.1|\[?::1\]?):/.test(env.DISPLAY ?? ''))) {delete env.DISPLAY; delete env.XAUTHORITY;}
    browser = await chromium.launch({headless:!options.headed, env, args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader',...(process.env.LR_CHROMIUM_ARGS?.trim().split(/\s+/).filter(Boolean) ?? [])]});
    const page = await browser.newPage();
    await page.exposeFunction('videoProgress', (frames:number) => log(`frames ${frames}/${frameCount} · ${((performance.now()-began)/1000).toFixed(1)}s`));
    await page.goto(`http://127.0.0.1:${port}${token}`);
    await page.evaluate(async ({settings,count}) => {
      const {createVideoView} = await import(new URL('renderer.js',location.href).href);
      const canvas = document.querySelector('canvas')!;
      const view = await createVideoView(canvas, {...settings,artwork:new URL('bosh.svg',location.href).href});
      try {
        for (let frame = 0; frame < count; frame++) {
          view.draw(frame);
          const blob = await new Promise<Blob>((done,fail) => canvas.toBlob(value => value ? done(value) : fail(new Error('Frame capture failed')),'image/png'));
          const response = await fetch(`frame/${frame}`, {method:'POST',body:blob});
          const message = await response.text();
          if (!response.ok) throw new Error(message);
          if ((frame+1)%60 === 0 || frame+1 === count) await (window as any).videoProgress(frame+1);
        }
      } finally {view.dispose();}
    }, {settings:{track, width,height,fps:FPS,zoom:options.zoom ?? 3,autoZoom:options.autoZoom,zoomKeyframes:options.zoomKeyframes,zoomSmoothing:options.zoomSmoothing},count:frameCount});
    if (failure) throw failure;
    if (received !== frameCount) throw new Error(`Incomplete video: ${received}/${frameCount} frames`);
    encoder.stdin!.end(); await complete;
    const info = JSON.parse(execFileSync('ffprobe', ['-v','error','-select_streams','v:0','-show_entries',
      'stream=nb_frames,width,height,avg_frame_rate','-of','json',movie], {encoding:'utf8'})).streams?.[0];
    if (!info || Number(info.nb_frames) !== frameCount || info.width !== width || info.height !== height || info.avg_frame_rate !== '60/1')
      throw new Error('Encoded video does not match the requested frame count, dimensions or frame rate');
    renameSync(movie,output);
    log(`saved ${output} · ${frameCount} frames · ${((performance.now()-began)/1000).toFixed(1)}s`);
  } finally {
    await browser?.close().catch(() => {});
    encoder?.kill(); server.closeAllConnections(); server.close();
    rmSync(scratch,{recursive:true,force:true});
  }
}
