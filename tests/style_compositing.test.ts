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
