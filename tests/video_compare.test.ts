import {afterAll, beforeAll, describe, expect, test} from 'vitest';
import {chromium, type Browser, type Page} from 'playwright';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

let browser: Browser, dir: string;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'line-video-compare-'));
  for (const [name, color, seconds] of [['a', 'red', '4'], ['b', 'blue', '4'], ['short', 'green', '0.5']]) {
    execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=90x160:r=30`, '-t', seconds,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(dir, `${name}.mp4`)]);
  }
  browser = await chromium.launch({args: ['--mute-audio']});
}, 20000);
afterAll(async () => {await browser?.close(); if (dir) rmSync(dir, {recursive: true, force: true});});

const flatCollection = {videos: [
  {label: 'A', src: '/a.mp4'}, {label: 'B', src: '/b.mp4'}, {label: 'Short', src: '/short.mp4'}, {label: 'Missing', src: '/missing.mp4'},
]};
const groupedCollection = {
  groups: [
    {id: 'picks', label: 'Start here', description: 'Three coherent styles.', variants: ['a', 'b']},
    {id: 'focused', label: 'Focused', description: 'Compare the small details.', variants: ['a', 'short']},
  ],
  passages: ['first', 'second'].map(id => ({id, label: id, description: `${id} musical passage`, videos: [
    {id: 'a', label: 'Approved', src: `/${id}/a.mp4`},
    {id: 'b', label: 'Kinetic', src: `/${id}/b.mp4`, recommended: true, recipe: 'Impact kick; measured contacts.'},
    {id: 'short', label: 'Short', src: `/${id}/short.mp4`},
  ]})),
};
async function open(collection: object = flatCollection, requests: string[] = [], options: {passage?: string; hiddenFrames?: boolean; delayMediaMs?: number; blockedPreload?: boolean} = {}): Promise<Page> {
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  if (options.hiddenFrames) await page.addInitScript(() => {
    // A compositor may withhold callbacks for an occluded video. Decode/seek
    // still work; the comparison must not wait forever for presentation.
    HTMLVideoElement.prototype.requestVideoFrameCallback = () => 1;
    HTMLVideoElement.prototype.cancelVideoFrameCallback = () => {};
  });
  if (options.blockedPreload) await page.addInitScript(() => {
    const ready = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'readyState')!.get!;
    const play = HTMLMediaElement.prototype.play, unlocked = new WeakSet<HTMLMediaElement>();
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {get() {
      return unlocked.has(this) ? ready.call(this) : Math.min(1, ready.call(this));
    }});
    HTMLMediaElement.prototype.play = function () {
      unlocked.add(this);
      queueMicrotask(() => this.dispatchEvent(new Event('canplay')));
      return play.call(this);
    };
  });
  await page.route('http://comparison.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/collection.json') return route.fulfill({json: collection});
    const media = /^\/(?:first\/|second\/)?(a|b|short)\.mp4$/.exec(path);
    if (media) {
      requests.push(path);
      if (options.delayMediaMs) await new Promise(resolve => setTimeout(resolve, options.delayMediaMs));
      const bytes = readFileSync(join(dir, `${media[1]}.mp4`)), range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? '');
      if (!range) return route.fulfill({body: bytes, contentType: 'video/mp4'});
      const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
      return route.fulfill({status: 206, body: bytes.subarray(start, end + 1), contentType: 'video/mp4', headers: {'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${bytes.length}`}});
    }
    if (['/video-compare.html', '/video-compare.js', '/video-compare.css'].includes(path)) return route.fulfill({
      body: readFileSync(join('motion-gallery', path.slice(1))), contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
    });
    return route.fulfill({status: 404});
  });
  await page.goto('http://comparison.test/video-compare.html?collection=/collection.json' + (options.passage ? '&passage=' + encodeURIComponent(options.passage) : ''));
  await page.waitForSelector(options.blockedPreload ? '#versions button' : 'video.active');
  return page;
}
async function select(page: Page, index: number): Promise<void> {
  await page.locator('#versions button').nth(index).click();
  await page.waitForFunction(i => document.querySelectorAll('#versions button')[i].getAttribute('aria-pressed') === 'true', index);
}
async function seek(page: Page, time: number): Promise<void> {
  await page.locator('#seek').evaluate((element, value) => {const input = element as HTMLInputElement; input.value = String(value); input.dispatchEvent(new Event('input', {bubbles: true}));}, time);
  await page.waitForFunction(() => !(document.querySelector('video.active') as HTMLVideoElement).seeking);
}

describe('rendered video comparison', () => {
  test('switches decoded videos at the same time while paused or playing', async () => {
    const page = await open();
    try {
      await seek(page, 1);
      await select(page, 1);
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => ({time: v.currentTime, paused: v.paused}))).toEqual({time: 1, paused: true});
      await page.locator('video.active').evaluate((v: HTMLVideoElement) => {v.playbackRate = 1.5;});
      await page.locator('#play').click();
      await select(page, 0);
      const state = await page.evaluate(() => {
        const v = document.querySelector('video.active') as HTMLVideoElement;
        return {time: v.currentTime, paused: v.paused, running: [...document.querySelectorAll('video')].filter(v => !v.paused).length};
      });
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => v.playbackRate)).toBe(1.5);
      expect(state.paused).toBe(false); expect(state.time).toBeGreaterThanOrEqual(.95); expect(state.running).toBe(1);
      await page.locator('#sound').click();
      await page.evaluate(() => {const buttons = document.querySelectorAll<HTMLButtonElement>('#versions button'); buttons[1].click(); buttons[0].click(); buttons[1].click();});
      await page.waitForFunction(() => document.querySelectorAll('#versions button')[1].getAttribute('aria-pressed') === 'true');
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
      expect(await page.locator('video.active').count()).toBe(1);
    } finally {await page.close();}
  }, 20000);

  test('handles shorter and missing videos without clearing the outgoing picture', async () => {
    const page = await open();
    try {
      await seek(page, 2);
      await select(page, 2);
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
      expect(await page.locator('#status').textContent()).toContain('ends earlier');
      await page.locator('#versions button').nth(3).click();
      await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Could not load'));
      expect(await page.locator('#versions button').nth(2).getAttribute('aria-pressed')).toBe('true');
      expect(await page.locator('video.active').count()).toBe(1);
    } finally {await page.close();}
  }, 20000);

  test('groups show only their variants and preserve the moment; passages preserve style but reset time', async () => {
    const requests: string[] = [], page = await open(groupedCollection, requests);
    try {
      expect(await page.locator('#versions button').count()).toBe(2);
      expect(requests.every(path => path.startsWith('/first/'))).toBe(true);
      await seek(page, .3);
      await select(page, 1);
      expect(await page.locator('#recipe').getAttribute('open')).toBeNull();
      expect(await page.locator('#recipe-text').textContent()).toContain('measured contacts');
      await page.locator('#passages button').nth(1).click();
      await page.waitForFunction(() => (document.querySelector('video.active') as HTMLVideoElement)?.currentSrc.endsWith('/second/b.mp4'));
      const next = await page.locator('video.active').evaluate((v: HTMLVideoElement) => ({time: v.currentTime, paused: v.paused}));
      expect(next).toEqual({time: 0, paused: true});
      expect(await page.locator('#stage video').count()).toBe(3);
      expect(await page.locator('#stage video[src]').count()).toBe(1);
      expect(await page.locator('#stage video[src]').evaluateAll(videos => videos.every(v => (v as HTMLVideoElement).currentSrc.includes('/second/')))).toBe(true);
      await seek(page, .25);
      await page.locator('#groups button').nth(1).click();
      await page.waitForFunction(() => (document.querySelector('video.active') as HTMLVideoElement)?.currentSrc.endsWith('/second/a.mp4'));
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(.25, 2);
      expect(await page.locator('#versions button').allTextContents()).toEqual(['Approved', 'Short']);
      await page.locator('#groups button').nth(0).click();
      expect(await page.locator('#versions button').first().getAttribute('aria-pressed')).toBe('true');
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(.25, 2);
    } finally {await page.close();}
  }, 20000);

  test('rapid passage changes cancel old switches and keep playing and mute settings', async () => {
    const page = await open(groupedCollection);
    try {
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await select(page, 1); await page.locator('#sound').click();
      await page.locator('video.active').evaluate((v: HTMLVideoElement) => {v.playbackRate = 1.5;});
      await page.locator('#play').click();
      await page.evaluate(() => {
        const passages = document.querySelectorAll<HTMLButtonElement>('#passages button');
        passages[1].click(); passages[0].click(); passages[1].click();
      });
      await page.waitForFunction(() => (document.querySelector('video.active') as HTMLVideoElement)?.currentSrc.endsWith('/second/b.mp4'));
      const state = await page.locator('video.active').evaluate((v: HTMLVideoElement) => ({time: v.currentTime, paused: v.paused, muted: v.muted, rate: v.playbackRate}));
      expect(state.paused).toBe(false); expect(state.muted).toBe(true); expect(state.rate).toBe(1.5); expect(state.time).toBeLessThan(1);
      expect(await page.locator('video.active').count()).toBe(1); expect(await page.locator('#stage video').count()).toBe(3); expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    } finally {await page.close();}
  }, 20000);

  test('fullscreen uses the native video fallback when element fullscreen is unavailable', async () => {
    const page = await open();
    try {
      await page.evaluate(() => {
        Object.defineProperty(Element.prototype, 'requestFullscreen', {value: undefined, configurable: true});
        Object.defineProperty(HTMLVideoElement.prototype, 'webkitEnterFullscreen', {value: function (this: HTMLVideoElement) {
          this.dataset.nativeFullscreen = 'called';
        }, configurable: true});
      });
      await page.locator('#fullscreen').click();
      expect(await page.locator('video.active').getAttribute('data-native-fullscreen')).toBe('called');
    } finally {await page.close();}
  });

  test('a shared group can span more styles than any individual passage', async () => {
    const collection = {groups: [{id: 'full', label: 'Full films', variants: ['a', 'b', 'short', 'd', 'e', 'f']}],
      passages: groupedCollection.passages.map((passage, index) => ({...passage,
        videos: passage.videos.map((video, i) => ({...video, id: index ? ['d', 'e', 'f'][i] : video.id}))}))};
    const page = await open(collection);
    try {
      expect(await page.locator('#versions button').count()).toBe(3);
      expect(await page.locator('#comparison-groups').isVisible()).toBe(false);
      await page.locator('#passages button').nth(1).click();
      await page.waitForFunction(() => (document.querySelector('video.active') as HTMLVideoElement)?.currentSrc.endsWith('/second/a.mp4'));
      expect(await page.locator('#versions button').count()).toBe(3);
      expect(await page.locator('#status').textContent()).toBe('');
    } finally {await page.close();}
  });

  test('switches with withheld compositor callbacks and delayed media, loading only requested versions', async () => {
    const requests: string[] = [], page = await open(groupedCollection, requests, {hiddenFrames: true, delayMediaMs: 250});
    try {
      expect(requests).toEqual(['/first/a.mp4']);
      await seek(page, 1);
      await page.locator('#versions button').nth(1).click();
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => v.currentSrc)).toContain('/first/a.mp4');
      await page.waitForFunction(() => document.querySelectorAll('#versions button')[1].getAttribute('aria-pressed') === 'true');
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => v.currentTime)).toBeCloseTo(1, 2);
      expect(await page.locator('video[src]').count()).toBe(1);
      await page.locator('#play').click();
      await select(page, 0);
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);
      await page.locator('#passages button').nth(1).click();
      expect(await page.locator('#transition-frame').isVisible()).toBe(true);
      await page.waitForFunction(() => (document.querySelector('video.active') as HTMLVideoElement)?.currentSrc.endsWith('/second/a.mp4'));
      expect(await page.locator('#transition-frame').isVisible()).toBe(false);
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);
      expect(requests.some(path => path.endsWith('short.mp4'))).toBe(false);
      expect(await page.locator('video[src]').count()).toBe(1);
      expect(await page.locator('#status').textContent()).toBe('');
    } finally {await page.close();}
  }, 20000);

  test.each([false, true])('playback refusal (only after unmute: %s) leaves a picture and working Play control', async onlyAfterUnmute => {
    const page = await open();
    try {
      await page.locator('#play').click();
      await page.evaluate(onlyAfterUnmute => {
        const original = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
          if (this.currentSrc.endsWith('/b.mp4') && (!onlyAfterUnmute || !this.muted)) {
            this.pause();
            return Promise.reject(new DOMException('Playback needs a gesture', 'NotAllowedError'));
          }
          return original.call(this);
        };
        (window as unknown as {restorePlay: () => void}).restorePlay = () => {HTMLMediaElement.prototype.play = original;};
      }, onlyAfterUnmute);
      await select(page, 1);
      await page.waitForFunction(() => document.querySelector('#play')?.textContent === 'Play');
      expect(await page.locator('#status').textContent()).toContain('Tap Play');
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
      await page.evaluate(() => (window as unknown as {restorePlay: () => void}).restorePlay());
      await page.locator('#play').click();
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
    } finally {await page.close();}
  }, 20000);

  test.each([false, true])('Play loads the first frame when preload is restricted (after error: %s)', async afterError => {
    const page = await open(groupedCollection, [], {blockedPreload: true});
    try {
      await page.waitForFunction(() => (document.querySelector('video[src]') as HTMLVideoElement)?.readyState === 1);
      expect(await page.locator('video.active').count()).toBe(0);
      expect(await page.locator('#play').isEnabled()).toBe(true);
      if (afterError) {
        await page.locator('video[src]').evaluate(v => v.dispatchEvent(new Event('error')));
        await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Could not load'));
      }
      await page.locator('#play').click();
      await page.waitForSelector('video.active');
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
      await page.locator('#play').click();
      await page.locator('#passages button').nth(1).click();
      await page.waitForFunction(() => (document.querySelector('video[src]') as HTMLVideoElement)?.readyState === 1);
      expect(await page.locator('video.active').count()).toBe(0);
      expect(await page.locator('#transition-frame').isVisible()).toBe(true);
      expect(await page.locator('#play').isEnabled()).toBe(true);
      await page.locator('#play').click();
      await page.waitForFunction(() => (document.querySelector('video.active') as HTMLVideoElement)?.currentSrc.endsWith('/second/a.mp4'));
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => v.paused)).toBe(false);
      expect(await page.locator('#transition-frame').isVisible()).toBe(false);
      expect(await page.locator('#status').textContent()).toBe('');
    } finally {await page.close();}
  }, 20000);

});

test('comparison links select the requested song and safely fall back for an unknown song', async () => {
  for (const [requested, expected] of [['second', 'second'], ['missing', 'first']]) {
    const page = await open(groupedCollection, [], {passage: requested});
    try {
      expect(await page.locator('video.active').evaluate((v: HTMLVideoElement) => v.currentSrc)).toContain('/' + expected + '/');
      expect(await page.locator('#passages button[aria-pressed="true"]').textContent()).toBe(expected);
    } finally {await page.close();}
  }
});
