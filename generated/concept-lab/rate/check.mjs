// Checks the ratings site on a phone (portrait and landscape) and a desktop: node generated/concept-lab/rate/check.mjs [SHOTS_DIR]
// Runs on a throwaway copy of the newest set (zz-check, removed after), so the owner's record is never touched. Needs the server.
import {chromium, devices} from 'playwright';
import {lstatSync, mkdirSync, readdirSync, rmSync, symlinkSync, unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const SETS = join(import.meta.dirname, 'sets'), LOG = join(import.meta.dirname, '../docs/owner-answers/ratings/zz-check.jsonl');
const OUT = process.argv[2] ?? join(tmpdir(), 'rate-check'); mkdirSync(OUT, {recursive: true});
const newest = readdirSync(SETS).filter(s => s !== 'zz-check').sort().at(-1);
const unlink = () => {try {if (lstatSync(join(SETS, 'zz-check')).isSymbolicLink()) unlinkSync(join(SETS, 'zz-check'));} catch {}};
unlink(); rmSync(LOG, {force: true}); symlinkSync(newest, join(SETS, 'zz-check'));
const U = 'http://127.0.0.1:8770/rate/zz-check', errs = [];
let fails = 0;
const ok = (c, m) => {if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', m);};
const log = async () => (await (await fetch('http://127.0.0.1:8770/api/rate/zz-check')).json()).events;
const fits = p => p.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1);
const name = p => p.$eval('.name', e => e.firstChild.textContent);
const b = await chromium.launch();
try {
  const open = async (opts, hash) => {
    const c = await b.newContext(opts), p = await c.newPage(); p.setDefaultTimeout(8000); p.on('pageerror', e => errs.push(e.message));
    await p.goto(U + hash); await p.waitForSelector('figure img'); await p.waitForTimeout(700); return p;
  };
  // the phone, upright: grade three in a row, without scrolling
  const p = await open({...devices['iPhone 13']}, '#grade');
  ok(await fits(p), 'phone portrait, grade: fits the screen');
  await p.screenshot({path: `${OUT}/phone-grade.png`});
  const first = await name(p);
  for (const g of [7, 9, 4]) {await p.tap(`.grades button:nth-child(${g})`); await p.waitForTimeout(450);}
  await p.waitForTimeout(600);
  let ev = await log();
  ok(ev.filter(e => e.kind === 'grade').length === 3 && new Set(ev.map(e => e.id)).size === 3, 'phone: three grades in a row, three themes');
  ok(await name(p) !== first, 'phone: grading moves on');
  await p.tap('text=Note'); await p.fill('.sheet textarea', 'too dark'); await p.tap('.sheet button'); await p.waitForTimeout(700);
  ev = await log(); ok(ev.some(e => e.kind === 'note' && e.text === 'too dark'), 'phone: note saved');
  await p.tap('figure >> nth=1'); await p.waitForSelector('.lb'); await p.screenshot({path: `${OUT}/phone-enlarged.png`});
  await p.tap('.lb'); ok(!(await p.$('.lb')), 'phone: an enlarged still closes on a tap');
  // compare: pick, equal, pass, undo
  await p.tap('button[data-tab=compare]'); await p.waitForSelector('.side'); await p.waitForTimeout(600);
  ok(await fits(p), 'phone portrait, compare: fits the screen');
  ok(!(await p.$eval('.moments', e => e.hidden)), 'phone portrait, compare: one moment each, with a switch');
  await p.screenshot({path: `${OUT}/phone-compare.png`});
  const pair1 = await p.$$eval('.side b', e => e.map(x => x.textContent));
  await p.tap('.side >> nth=0'); await p.waitForTimeout(500);
  const pair2 = await p.$$eval('.side b', e => e.map(x => x.textContent));
  ok(pair1.join() !== pair2.join(), `phone: a pick brings a new pair (${pair1.join(' / ')} → ${pair2.join(' / ')})`);
  await p.tap('.moments button >> nth=1'); await p.waitForTimeout(300); await p.screenshot({path: `${OUT}/phone-compare-drop.png`});
  await p.tap('text=Equal'); await p.waitForTimeout(500);
  const before = (await log()).length; await p.tap('text=Pass'); await p.waitForTimeout(500);
  ok((await log()).length === before, 'phone: pass records nothing');
  await p.tap('text=Undo'); await p.waitForTimeout(500);
  ev = await log(); const pk = ev.filter(e => e.kind === 'pick');
  ok(pk.length === 2 && pk[0].winner === pk[0].a && pk[1].winner === null && ev.at(-1).kind === 'undo', 'phone: left, equal, then undo recorded');
  // the phone on its side
  const l = await open({...devices['iPhone 13 landscape']}, '#grade');
  ok(await fits(l), 'phone landscape, grade: fits the screen'); await l.screenshot({path: `${OUT}/landscape-grade.png`});
  await l.goto(U + '#compare'); await l.waitForSelector('.side'); await l.waitForTimeout(600);
  ok(await fits(l), 'phone landscape, compare: fits the screen');
  ok(await l.$eval('.moments', e => e.hidden), 'phone landscape, compare: every moment of both themes');
  await l.screenshot({path: `${OUT}/landscape-compare.png`});
  // the desktop, by keys
  const d = await open({viewport: {width: 1600, height: 950}}, '#grade');
  ok(await fits(d), 'desktop, grade: fits the screen'); await d.screenshot({path: `${OUT}/desk-grade.png`});
  for (const k of ['8', '0', '5']) {await d.keyboard.press(k); await d.waitForTimeout(450);}
  await d.waitForTimeout(600);
  ev = await log(); ok(ev.filter(e => e.kind === 'grade').length === 6, 'desktop: three grades by keys');
  await d.keyboard.press('n'); await d.keyboard.type('lovely sun'); await d.keyboard.press('Escape'); await d.waitForTimeout(700);
  ev = await log(); ok(ev.some(e => e.kind === 'note' && e.text === 'lovely sun'), 'desktop: note by keys');
  await d.goto(U + '#compare'); await d.waitForSelector('.side'); await d.waitForTimeout(700);
  ok(await fits(d), 'desktop, compare: fits the screen'); await d.screenshot({path: `${OUT}/desk-compare.png`});
  for (const k of ['ArrowRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft']) {await d.keyboard.press(k); await d.waitForTimeout(400);}
  await d.waitForTimeout(500);
  const dp = (await log()).filter(e => e.kind === 'pick').slice(-3);
  ok(dp.length === 3 && dp[0].winner === dp[0].b && dp[1].winner === null && dp[2].winner === dp[2].a, 'desktop: → ↑ ↓ ← give right, equal, (pass), left');
  // one record: the phone sees the desktop's answers when it comes back
  await p.goto(U + '#standings'); await p.waitForSelector('table');
  const st = await p.$eval('#status', e => e.textContent);
  ok(/^6\/\d+ graded · 4 picks/.test(st), `phone sees the desktop's answers (${st})`);
  await d.goto(U + '#standings'); await d.waitForSelector('table'); await d.screenshot({path: `${OUT}/desk-standings.png`});
  await d.goto('http://127.0.0.1:8770/rate/'); await d.waitForSelector('.sets a'); ok(true, 'the home page lists the sets');
  ok(!errs.length, `no page errors ${errs.join(' | ')}`);
} catch (e) {fails++; console.log('FAIL', e.message.split('\n').slice(0, 8).join('\n'));}
finally {await b.close(); unlink(); rmSync(LOG, {force: true});}
console.log(fails ? `${fails} failed` : 'all passed'); process.exitCode = fails ? 1 : 0;
