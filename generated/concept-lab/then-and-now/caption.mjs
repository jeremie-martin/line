// A caption as a transparent 1080 × 1920 picture, drawn by the renderer's own caption (scripts/video/caption.js) in the same
// browser, for a video the renderer did not draw (the old one in then-and-now):
//   node generated/concept-lab/then-and-now/caption.mjs THEN '#22201c' OUT.png
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from 'playwright';
const [text, colour, out] = process.argv.slice(2);
if (!text || !colour || !out) throw new Error('caption.mjs TEXT COLOUR OUT.png');
const source = readFileSync(join(import.meta.dirname, '../../../scripts/video/caption.js'), 'utf8').replace('export function', 'function');
const browser = await chromium.launch({args: ['--no-sandbox']});
try {
  const page = await browser.newPage();
  await page.addScriptTag({content: source + '; window.drawCaption = drawCaption;'});
  const data = await page.evaluate(([word, ink]) => {
    const canvas = Object.assign(document.createElement('canvas'), {width: 1080, height: 1920});
    window.drawCaption(canvas.getContext('2d'), word, ink);
    return canvas.toDataURL('image/png');
  }, [text, colour]);
  writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
} finally {await browser.close();}
