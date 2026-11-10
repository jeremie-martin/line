import {afterAll, beforeAll, expect, it} from 'vitest';
import {build} from 'esbuild';
import {chromium, type Browser, type Page} from 'playwright';

let browser: Browser, page: Page;
// production theme schemes, set in the page (beforeAll)
declare const DUNE: string, ROTHKO: string, HOKUSAI: string;
beforeAll(async () => {
  const bundle = await build({stdin: {contents: `export {createPicture, BODY_POINTS} from './scripts/video/picture.js';
    export {resolveLook} from './scripts/video/look.js';
    export {drawBand} from './scripts/video/music.js';
    export {createTheme} from './scripts/video/theme.js';
    export {COLLECTION} from './scripts/video/collection.js';`, resolveDir: process.cwd()}, bundle: true, write: false, format: 'iife', globalName: 'renderer'});
  browser = await chromium.launch(); page = await browser.newPage();
  await page.addScriptTag({content: bundle.outputFiles[0].text});
  await page.evaluate(() => {
    const {createPicture, BODY_POINTS, resolveLook} = (window as any).renderer;
    // production schemes by name, for the cases below (each runs in the page)
    const {COLLECTION} = (window as any).renderer;
    Object.assign(window, {DUNE: COLLECTION.dune.id, ROTHKO: COLLECTION.rothko.id, HOKUSAI: COLLECTION.hokusai.id});
    // Synthetic replay: no audio, native engine or saved lab artifacts needed. Two separate rails:
    // one touched, one safely ahead as pencil. A small coloured rider makes the clean overlay visible.
    const frames = Array.from({length: 201}, (_, f) => ({points: BODY_POINTS.map((name: string) => ({name, pos: {x: f * 2, y: 0}})),
      framesSinceUnmount: -1, framesSinceSledBreak: -1, framesSinceStringDetached: -1}));
    const contacts = frames.map(() => [1]);
    const scene = {track: {duration: 200, lines: [
      {id: 1, x1: -100, y1: 10, x2: 500, y2: 10}, {id: 2, x1: -100, y1: -30, x2: 500, y2: -30},
    ]}, title: 'A TWO LINE TITLE', timing: {offset: 0}, span: [0, 5], drop: [1, 3],
      spectrum: {fps: 1, frames: Array.from({length: 6}, () => [0.3, 0.6, 0.8, 0.4])},
      account: {targets: [{}], events: [{onset: 38, peak: 40, strength: 0.85}], matches: [{target: 0, event: 0}]}};
    const paint = (g: CanvasRenderingContext2D, camera: any, _sheet: unknown, frame: any) => {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, camera.w, camera.h);
      const p = frame.points[0].pos;
      g.fillStyle = '#6a5b48'; g.fillRect(camera.w / 2 + (p.x - camera.x) * camera.z - 3, camera.h / 2 + (p.y - camera.y) * camera.z - 3, 6, 6);
    };
    (window as any).fixture = (strength = 0.85, variedSpeed = false) => {
      const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 320;
      const copy = structuredClone(scene); copy.account.events[0].strength = strength;
      const shownFrames = variedSpeed ? frames.map((frame, f) => ({...frame,
        points: frame.points.map((p: any) => ({...p, pos: {x: f < 100 ? f : 100 + (f - 100) * 20, y: 0}}))})) : frames;
      const picture = createPicture(canvas, copy, {frames: shownFrames, contacts}, null, paint);
      return {canvas, picture, render(t: number, choices = {}, width = 180, exaggerate = 1) {
        if (canvas.width !== width) {canvas.width = width; canvas.height = width * 16 / 9;}
        const world = picture.draw(t, resolveLook(null, {ends: 'none', band: 'bars', paper: 'plain', ...choices}), exaggerate);
        return {png: canvas.toDataURL(), world};
      }};
    };
  });
});
afterAll(async () => {await browser?.close();});

it('seeking, changing the top and resizing give exactly the same pixels as a fresh picture', async () => {
  const failures = await page.evaluate(() => {
    const fixture = (window as any).fixture, used = fixture(), failures = [];
    const cases = [
      [1, {top: 'title'}, 180, 1], [1.05, {top: 'sun', scheme: DUNE}, 360, 3],
      [0.99, {top: 'none'}, 180, 1], [1.12, {top: 'title', scheme: HOKUSAI, drop: 'switch'}, 180, 1],
      [1, {top: 'title'}, 360, 1], [1, {top: 'none', hits: 'none'}, 180, 1],
      [1.25, {top: 'title'}, 180, 1], [1, {top: 'title'}, 180, 1],
    ];
    for (const args of cases) {
      if (used.render(...args).png !== fixture().render(...args).png) failures.push(args);
    }
    return failures;
  });
  expect(failures).toEqual([]);
});

it('a hit starts at its peak, settles, and disabling effects does not disable band heat', async () => {
  const result = await page.evaluate(() => {
    const f = (window as any).fixture(), equal = (t: number) => f.render(t).png === f.render(t, {hits: 'none'}).png;
    return [equal(0.95), equal(0.99999), equal(1), equal(1.25), equal(1.5)];
  });
  expect(result).toEqual([true, true, false, true, true]);
});

it('colour boost changes content but keeps the paper and pencilled rail intact on light and dark grounds', async () => {
  const result = await page.evaluate(() => {
    // Strength 0.5: colour boost, no shake, split below the half-pixel visibility threshold at this resolution.
    const f = (window as any).fixture(0.5), results = [];
    for (const scheme of ['graphite', ROTHKO]) {
      const options = {scheme, top: 'sun', accent: 'loud'};
      const {png: off, world} = f.render(1, {...options, hits: 'none'});
      const g = f.canvas.getContext('2d');
      const pixel = (x: number, y: number) => Array.from(g.getImageData(x, y, 1, 1).data);
      const p = world.transformPoint(new DOMPoint(80, -30));
      const paper = pixel(1, 1), pencil = pixel(Math.round(p.x), Math.floor(p.y));
      const {png: on} = f.render(1, options);
      results.push({changed: off !== on, paperSame: String(pixel(1, 1)) === String(paper),
        pencilSame: String(pixel(Math.round(p.x), Math.floor(p.y))) === String(pencil), pencilVisible: String(pencil) !== String(paper)});
    }
    return results;
  });
  expect(result).toEqual(Array.from({length: 2}, () => ({changed: true, paperSame: true, pencilSame: true, pencilVisible: true})));
});

it('colour queries use their requested time even before drawing or after an unrelated seek', async () => {
  const result = await page.evaluate(() => {
    const {resolveLook, createTheme} = (window as any).renderer, f = (window as any).fixture(0.85, true);
    const look = resolveLook(null, {scheme: DUNE, paper: 'vibranceSoftHalfPaper', drop: 'off'}), theme = createTheme(null);
    const times = [0, 1, 2.5, 4.9], expected = times.map(t => theme(t, f.picture.levelAt(t), look).scheme);
    const before = times.map(t => f.picture.schemeAt(t, look));
    f.render(4.9, look); f.render(0, {scheme: ROTHKO});
    const after = times.map(t => f.picture.schemeAt(t, look));
    return {before, after, expected};
  });
  expect(new Set(result.expected.map(x => JSON.stringify(x))).size).toBeGreaterThan(1);
  expect(result.before).toEqual(result.expected); expect(result.after).toEqual(result.expected);
});

it('fork accents follow the supplied recent heat, never a radius or a fixed song time', async () => {
  const result = await page.evaluate(() => {
    const {drawBand, resolveLook} = (window as any).renderer;
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
    const ctx = canvas.getContext('2d')!, spectrum = {fps: 1, frames: [[0.3, 0.6, 0.8, 0.4]]};
    const colours = {paper: '#ffffff', band: '#222222', accent: '#ff0000', irisLight: false};
    const render = (time: number, heat: number) => {
      ctx.clearRect(0, 0, 1080, 1920);
      drawBand(ctx, spectrum, time, heat, 1, colours, resolveLook(null, {band: 'fork', accent: 'heat'}));
      const pixels = ctx.getImageData(0, 0, 1080, 1920).data; let red = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === 255 && pixels[i + 1] === 0 && pixels[i + 2] === 0 && pixels[i + 3] === 255) red++;
      return {png: canvas.toDataURL(), red};
    };
    const cold = render(1, 0), hot = render(1, 0.5), later = render(100, 0.5);
    return {cold: cold.red, hot: hot.red, sameHeat: hot.png === later.png};
  });
  expect(result.cold).toBe(0); expect(result.hot).toBeGreaterThan(0); expect(result.sameHeat).toBe(true);
});
