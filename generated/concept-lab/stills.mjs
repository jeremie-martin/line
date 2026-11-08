// Stills of looks for rating pages: node generated/concept-lab/stills.mjs jobs=FILE.json out=DIR
// FILE: {schemes?: {name: scheme}, drops?: {scheme: partner}, width?: 540, jobs: [{name, song, look, times: [s…]}]}; a look
// is a set of options over V1 (look.js), e.g. {scheme: 'hokusai', band: 'bars', top: 'sun'}. Writes DIR/<name>-<i>.jpg (i from 1).
// Needs the review server (:8770); new schemes live only in the page's memory (stills.html).
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {chromium} from 'playwright';

const a = Object.fromEntries(process.argv.slice(2).map(s => {const i = s.indexOf('='); return [s.slice(0, i), s.slice(i + 1)];}));
if (!a.jobs || !a.out) throw new Error('usage: stills.mjs jobs=FILE.json out=DIR');
const spec = JSON.parse(readFileSync(a.jobs, 'utf8'));
mkdirSync(a.out, {recursive: true});
const browser = await chromium.launch();
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8770/generated/concept-lab/stills.html');
  await page.waitForFunction(() => window.ready === true, null, {timeout: 60000}).catch(e => {throw new Error([...errors, e.message].join('\n'));});
  const out = await page.evaluate(s => window.renderStills(s), spec);
  let n = 0;
  for (const [name, images] of Object.entries(out)) images.forEach((url, i) => {writeFileSync(join(a.out, `${name}-${i + 1}.jpg`), Buffer.from(url.split(',')[1], 'base64')); n++;});
  console.log(`${n} stills in ${a.out}`);
} finally {await browser.close();}
