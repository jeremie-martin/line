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
  browser = await chromium.launch();
}, 20000);
afterAll(async () => {await browser?.close(); if (dir) rmSync(dir, {recursive: true, force: true});});

async function open(): Promise<Page> {
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  await page.route('http://comparison.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/collection.json') return route.fulfill({json: {videos: [
      {label: 'A', src: '/a.mp4'}, {label: 'B', src: '/b.mp4'}, {label: 'Short', src: '/short.mp4'}, {label: 'Missing', src: '/missing.mp4'},
    ]}});
    if (['/a.mp4', '/b.mp4', '/short.mp4'].includes(path)) {
      const bytes = readFileSync(join(dir, path.slice(1))), range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? '');
      if (!range) return route.fulfill({body: bytes, contentType: 'video/mp4'});
      const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
      return route.fulfill({status: 206, body: bytes.subarray(start, end + 1), contentType: 'video/mp4', headers: {'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${bytes.length}`}});
    }
    if (['/video-compare.html', '/video-compare.js', '/video-compare.css'].includes(path)) return route.fulfill({
      body: readFileSync(join('motion-gallery', path.slice(1))), contentType: path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html',
    });
    return route.fulfill({status: 404});
  });
  await page.goto('http://comparison.test/video-compare.html?collection=/collection.json');
  await page.waitForSelector('video.active');
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
});
