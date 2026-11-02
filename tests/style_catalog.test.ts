import {afterAll, beforeAll, expect, test} from 'vitest';
import {chromium, type Browser} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
let browser: Browser, dir: string;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'line-catalog-'));
  execFileSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=blue:s=90x160:r=60','-t','4','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p',join(dir,'loop.mp4')]);
  browser = await chromium.launch({args: ['--mute-audio']});
}, 20000);
afterAll(async () => {await browser?.close(); if (dir) rmSync(dir, {recursive:true,force:true});});
const item = (id: string) => ({id,label:id,description:'A treatment',quiet:'/quiet.svg',impact:'/impact.svg',loop:'/loop.mp4'});
const data = {groups:[{label:'Main',description:'Four styles',variants:['a','b']},{label:'Control',description:'First song only',variants:['c','d']}],passages:[
  {id:'first',label:'First',quietTime:1,impactTime:2,loopStart:0,items:['a','b','c','d'].map(item)},
  {id:'second',label:'Second',quietTime:5,impactTime:6,loopStart:4,items:['a','b'].map(item)},
]};
async function open(delay = false) {
  const p = await browser.newPage({viewport:{width:390,height:844}});
  const errors: string[] = []; p.on('pageerror', e=>errors.push(e.message));
  await p.route('http://catalog.test/**',async route=>{
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('catalog.json')) return route.fulfill({json:data});
    if (path.endsWith('.svg')) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="90" height="160"><rect width="90" height="160" fill="white"/></svg>'});
    if (path.endsWith('.mp4')) {
      if (delay) await new Promise(r=>setTimeout(r,250));
      const bytes=readFileSync(join(dir,'loop.mp4')), range=/^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? '');
      if (!range) return route.fulfill({contentType:'video/mp4',body:bytes});
      const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;
      return route.fulfill({status:206,body:bytes.subarray(start,end+1),contentType:'video/mp4',headers:{'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${bytes.length}`}});
    }
    if (/\/style-catalog\.(html|css|js)$/.test(path)) return route.fulfill({body:readFileSync(join('motion-gallery',path.slice(1))),contentType:path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html'});
    return route.fulfill({status:404});
  });
  await p.goto('http://catalog.test/style-catalog.html'); await p.waitForSelector('article'); return {p,errors};
}
test('catalogue loads only stills initially, synchronizes muted loops, pauses and releases them', async()=>{
  const {p,errors}=await open();
  try {
    expect(await p.locator('video').count()).toBe(0);
    await p.locator('[data-mode="impact"]').click(); expect(await p.locator('article img').first().getAttribute('src')).toBe('/impact.svg');
    await p.locator('[data-mode="loop"]').click(); await p.waitForSelector('video.ready'); await p.waitForTimeout(300);
    const states=await p.locator('video').evaluateAll(vs=>vs.map(el=>{const v=el as HTMLVideoElement;return {muted:v.muted,paused:v.paused,t:v.currentTime};}));
    expect(states).toHaveLength(2); expect(states.every(v=>v.muted&&!v.paused)).toBe(true); expect(Math.abs(states[0].t-states[1].t)).toBeLessThan(.1);
    await p.locator('[data-mode="loop"]').click(); expect(await p.locator('video').evaluateAll(vs=>vs.every(v=>(v as HTMLVideoElement).paused))).toBe(true);
    const paused = await p.locator('video').first().evaluate(v=>(v as HTMLVideoElement).currentTime);
    await p.locator('[data-mode="loop"]').click(); await p.waitForTimeout(100);
    expect(await p.locator('video').first().evaluate(v=>(v as HTMLVideoElement).currentTime)).toBeGreaterThanOrEqual(paused);
    await p.locator('[data-mode="quiet"]').click(); expect(await p.locator('video').count()).toBe(0); expect(await p.locator('article img').first().getAttribute('src')).toBe('/quiet.svg');
    expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false); expect(errors).toEqual([]);
  } finally {await p.close();}
});
test('changing song during loading cancels old loops and selects an available comparison',async()=>{
  const {p,errors}=await open(true);
  try {
    await p.locator('#groups button').nth(1).click(); await p.locator('[data-mode="loop"]').click();
    await p.locator('#songs button').nth(1).click(); await p.waitForTimeout(500);
    expect(await p.locator('video').count()).toBe(0); expect(await p.locator('article').count()).toBe(2);
    expect(await p.locator('#groups button').nth(1).isDisabled()).toBe(true);
    expect(await p.locator('#groups button').first().getAttribute('aria-pressed')).toBe('true');
    expect(new URL((await p.locator('#compare').getAttribute('href'))!).searchParams.get('passage')).toBe('second'); expect(errors).toEqual([]);
  } finally {await p.close();}
});
