import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import {expect, test} from 'vitest';
import {StudyRide} from '../remotion/src/study/Layers.tsx';

const require = createRequire(new URL('../remotion/package.json', import.meta.url));
const {createElement} = require('react');
const {renderToStaticMarkup} = require('react-dom/server');

test('ink colours real edges without adding opacity to empty source pixels', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport: {width: 300, height: 200}});
    const images: Buffer[] = [], edges: Buffer[] = [];
    for (const ink of [0, 10]) {
      const markup = renderToStaticMarkup(createElement(StudyRide, {look: {ink, scale: 1, y: 0, dark: false}},
        createElement('div', {style: {position: 'absolute', left: 100, top: 90, width: 100, height: 8, background: '#000'}})));
      await page.setContent(`<body style="margin:0;background:rgb(230,230,230)">${markup}</body>`);
      images.push(await page.screenshot({clip: {x: 10, y: 10, width: 20, height: 20}}));
      edges.push(await page.screenshot({clip: {x: 80, y: 75, width: 140, height: 40}}));
    }
    expect(images[1].equals(images[0])).toBe(true);
    expect(edges[1].equals(edges[0])).toBe(false);
  } finally {await browser.close();}
}, 10000);

test('paper, halo and weight treatments preserve empty alpha and a crisp geometry core', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({viewport: {width: 300, height: 200}});
    const blank: Buffer[] = [];
    const bar = (background: string) => createElement('div', {style: {position: 'absolute', left: 100, top: 90, width: 100, height: 8, background}});
    const inside = {x: 130, y: 92, width: 40, height: 4}; // well inside the bar, clear of every offset, halo and dilation
    for (const surface of [undefined, {core: '#243e42', shadow: '#d9956e', offset: 6},
      {core: '#fff8df', halo: '#c68cff', haloRadius: 5}, {core: '#242638', weight: .65}, {core: '#344d46', shadow: '#b89c6b', highlight: '#fffcef', offset: 3}]) {
      const markup = renderToStaticMarkup(createElement(StudyRide, {look: {ink: 0, scale: 1, y: 0, dark: false, surface}}, bar('#000')));
      await page.setContent(`<body style="margin:0;background:rgb(230,230,230)">${markup}</body>`);
      blank.push(await page.screenshot({clip: {x: 10, y: 10, width: 20, height: 20}}));
      // the crisp core: inside the geometry, exactly the surface's core colour (the bar's own black without a surface), with
      // nothing from the shadow, halo, highlight or weight layers beneath showing through
      const core = await page.screenshot({clip: inside});
      await page.setContent(`<body style="margin:0;background:rgb(230,230,230)">${renderToStaticMarkup(bar(surface?.core ?? '#000'))}</body>`);
      expect(core.equals(await page.screenshot({clip: inside}))).toBe(true);
    }
    for (const image of blank.slice(1)) expect(image.equals(blank[0])).toBe(true);
  } finally {await browser.close();}
}, 10000);
