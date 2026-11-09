// Checks the judging site on a phone (upright and on its side) and a desktop: node generated/concept-lab/rate/check.mjs [SHOTS_DIR]
// Runs on a throwaway copy of the newest set (zz-check, removed after), so the owner's record is never touched. Needs the server.
import {chromium, devices} from 'playwright';
import {lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, rmdirSync, symlinkSync, unlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const SETS = join(import.meta.dirname, 'sets'), LOG = join(import.meta.dirname, '../docs/owner-answers/ratings/zz-check.jsonl');
const OUT = process.argv[2] ?? join(tmpdir(), 'rate-check'); mkdirSync(OUT, {recursive: true});
const newest = readdirSync(SETS).filter(s => s !== 'zz-check').sort().at(-1);
// the copy: the newest set's themes and stills (linked), without the earlier sets it builds on, whose judgments are the owner's
const COPY = join(SETS, 'zz-check');
const unlink = () => {try {if (lstatSync(join(COPY, 'stills')).isSymbolicLink()) unlinkSync(join(COPY, 'stills')); rmSync(join(COPY, 'set.json'), {force: true}); rmdirSync(COPY);} catch {}};
unlink(); rmSync(LOG, {force: true});
mkdirSync(COPY);
const {buildsOn, ...frozen} = JSON.parse(readFileSync(join(SETS, newest, 'set.json'), 'utf8'));
writeFileSync(join(COPY, 'set.json'), JSON.stringify({...frozen, set: 'zz-check'}));
symlinkSync(join('..', newest, 'stills'), join(COPY, 'stills'));
const HOST = 'http://127.0.0.1:8770', U = `${HOST}/rate/zz-check`, API = `${HOST}/api/rate/zz-check/events`, errs = [];
let fails = 0;
const ok = (c, m) => {if (!c) fails++; console.log(c ? 'ok  ' : 'FAIL', m);};
const log = async () => (await (await fetch(API)).json()).events;
const live = async () => {const ev = await log(), gone = new Set(ev.filter(e => e.kind === 'retract').map(e => e.target)); return ev.filter(e => e.kind !== 'retract' && !gone.has(e.id));};
// nothing reaches past the screen's edges (the page hides overflow, so measure every piece rather than the page's scroll size)
const fits = p => p.evaluate(() => [...document.querySelectorAll('.top, .theme, .bar button, .rail button, figure img')].every(e => {
  const r = e.getBoundingClientRect(); return r.width === 0 || (r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1);
}));
const still = p => p.$eval('.theme figure img', i => i.getBoundingClientRect().height);
const shown = p => p.$$eval('.theme .label span:not([style])', e => e.map(x => x.textContent));
const settle = p => p.waitForTimeout(450);
const b = await chromium.launch();
try {
  const open = async (opts, path) => {
    const c = await b.newContext(opts), p = await c.newPage(); p.setDefaultTimeout(8000); p.on('pageerror', e => errs.push(e.message));
    await p.goto(U + path); await p.waitForSelector('.theme figure img'); await p.waitForTimeout(700); return p;
  };
  // the phone, upright
  const p = await open({...devices['iPhone 13']}, '#sort');
  ok(await fits(p), `phone upright, sort: fits the screen (stills ${Math.round(await still(p))} px high)`);
  await p.screenshot({path: `${OUT}/phone-sort.png`});
  const first = (await shown(p))[0];
  for (const v of ['Keep', 'Love', 'Cut']) {await p.tap(`.bar .main button:has-text("${v}")`); await settle(p);}
  let ev = await live();
  ok(ev.filter(e => e.kind === 'verdict').map(e => e.value).join() === 'keep,love,cut' && new Set(ev.map(e => e.theme)).size === 3, 'phone: three verdicts in a row, three themes');
  ok((await shown(p))[0] !== first, 'phone: a verdict moves on');
  ok(!!(await p.$('.toast')), 'phone: the toast offers a note and an undo'); await p.screenshot({path: `${OUT}/phone-toast.png`});
  await p.tap('.toast button:has-text("Note")'); await p.fill('.sheet textarea', 'too dark at the drop'); await p.tap('.sheet button:has-text("Save")'); await settle(p);
  ev = await live(); const cutTheme = ev.find(e => e.value === 'cut').theme;
  ok(ev.some(e => e.kind === 'note' && e.themes.join() === cutTheme), 'phone: a note from the toast is about the theme just judged');
  await p.tap('.bar .aux button:has-text("Undo")'); await settle(p);
  ev = await live(); ok(!ev.some(e => e.kind === 'note'), 'phone: undo takes back the latest judgment (the note)');
  await p.tap('.bar .aux button:has-text("Undo")'); await settle(p);
  ev = await live(); ok(!ev.some(e => e.value === 'cut') && (await shown(p))[0] === (await p.evaluate(id => id, null), (await shown(p))[0]), 'phone: undo again takes back the cut');
  await p.tap('.theme figure >> nth=1'); await p.waitForSelector('.viewer'); await p.screenshot({path: `${OUT}/phone-viewer.png`});
  await p.tap('.viewer'); ok(!(await p.$('.viewer')), 'phone: a still opens the viewer, a tap closes it');
  // duel, upright
  await p.tap('.seg a:has-text("Compare")'); await p.waitForSelector('.theme'); await p.waitForTimeout(600);
  ok(await fits(p), `phone upright, compare: fits the screen (stills ${Math.round(await still(p))} px high)`);
  ok(await p.$$eval('.theme', t => t.length) === 2 && await p.$$eval('.theme figure', f => f.length) === 4, 'phone upright, compare: both moments of both themes');
  await p.screenshot({path: `${OUT}/phone-duel.png`});
  const pair1 = await shown(p);
  await p.tap('.bar .main button:has-text("Left")'); await settle(p);
  ok((await shown(p)).join() !== pair1.join(), `phone: a pick brings a new pair (${pair1.join(' / ')})`);
  // undo, several times over: right three times, then undo three times brings back each pair in turn and leaves nothing standing
  const before3 = (await live()).length, pairs = [];
  for (let i = 0; i < 3; i++) {pairs.push((await shown(p)).join()); await p.tap('.bar .main button:has-text("Right")'); await settle(p);}
  const back = [];
  for (let i = 0; i < 3; i++) {await p.tap('.bar .aux button:has-text("Undo")'); await settle(p); back.push((await shown(p)).join());}
  ok((await live()).length === before3 && back.join('|') === [...pairs].reverse().join('|'), 'phone: three picks, three undos: each pair comes back, nothing stands');
  const saved = (await log()).at(-1);
  ok(saved.at && saved.savedAt && saved.device?.kind === 'phone' && saved.device.w > 0 && saved.client?.ip && saved.client.ua, 'every event keeps when, the device and the client');
  await p.tap('.theme figure >> nth=0'); await p.waitForSelector('.viewer');
  const w1 = await p.$eval('.viewer .who', e => e.textContent); await p.tap('.viewer'); const w2 = await p.$eval('.viewer .who', e => e.textContent);
  ok(w1.startsWith('Left') && w2.startsWith('Right'), 'phone: in a duel the viewer flips between the two themes');
  await p.tap('.viewer .x');
  await p.tap('.bar .main button:has-text("Equal")'); await settle(p);
  await p.tap('.bar .aux button:has-text("Pass")'); await settle(p);
  await p.tap('.bar .aux button:has-text("Note")'); ok(await p.$$eval('.sheet .chips button', c => c.length) === 3, 'phone: a duel note can be about either theme or the pair');
  await p.fill('.sheet textarea', 'both drops are flat'); await p.tap('.sheet button:has-text("Save")'); await settle(p);
  ev = await live(); const d = ev.filter(e => e.kind === 'duel');
  ok(d.map(e => e.outcome).join() === 'left,equal,pass' && d.every(e => e.ms > 0 && e.why), 'phone: left, equal, pass kept, with time and reason');
  ok(ev.some(e => e.kind === 'note' && e.themes.length === 2), 'phone: the pair note saved');
  // the phone on its side
  const l = await open({...devices['iPhone 13 landscape']}, '#sort');
  ok(await fits(l), `phone on its side, sort: fits (stills ${Math.round(await still(l))} px high)`); await l.screenshot({path: `${OUT}/side-sort.png`});
  await l.goto(U + '#compare'); await l.waitForSelector('.theme'); await l.waitForTimeout(700);
  ok(await fits(l), `phone on its side, compare: fits (stills ${Math.round(await still(l))} px high)`); await l.screenshot({path: `${OUT}/side-duel.png`});
  const before = (await live()).filter(e => e.kind === 'duel').length;
  await l.tap('.rail button:has-text("Right")'); await settle(l);
  ok((await live()).filter(e => e.kind === 'duel').length === before + 1, 'phone on its side: the right rail picks');
  // the desktop, by keys
  const k = await open({viewport: {width: 1600, height: 950}}, '#sort');
  ok(await fits(k), `desktop, sort: fits (stills ${Math.round(await still(k))} px high)`); await k.screenshot({path: `${OUT}/desk-sort.png`});
  const nv = (await live()).filter(e => e.kind === 'verdict').length;
  for (const key of ['2', '4', '3']) {await k.keyboard.press(key); await settle(k);}
  ok((await live()).filter(e => e.kind === 'verdict').length === nv + 3, 'desktop: verdicts by keys 1–4');
  await k.keyboard.press('n'); await k.keyboard.type('the sun is lovely'); await k.keyboard.press('Escape'); await settle(k);
  ok((await live()).some(e => e.kind === 'note' && e.text === 'the sun is lovely'), 'desktop sort: n, type, Escape saves a note');
  await k.goto(U + '#compare'); await k.waitForSelector('.theme'); await k.waitForTimeout(700);
  ok(await fits(k), `desktop, compare: fits (stills ${Math.round(await still(k))} px high)`); await k.screenshot({path: `${OUT}/desk-duel.png`});
  const nd = (await live()).filter(e => e.kind === 'duel').length;
  for (const key of ['ArrowRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft']) {await k.keyboard.press(key); await settle(k);}
  const dd = (await live()).filter(e => e.kind === 'duel').slice(nd);
  ok(dd.map(e => e.outcome).join() === 'right,equal,pass,left', 'desktop: → ↑ ↓ ← give right, equal, pass, left');
  await k.keyboard.press('n'); ok(!!(await k.$('.sheet')), 'desktop compare: n opens the note'); await k.keyboard.press('Escape');
  await k.keyboard.press('z'); await settle(k);
  ok((await log()).at(-1).kind === 'retract', 'desktop: z undoes');
  // one record for every device; the API never duplicates and refuses a changed set
  await p.reload(); await p.waitForSelector('.theme'); await p.waitForTimeout(600);
  const st = await p.$eval('#status', e => e.textContent), all = await live();
  ok(st.startsWith(`${Object.keys(Object.fromEntries(all.filter(e => e.kind === 'verdict').map(e => [e.theme, 1]))).length}/`), `the phone sees the desktop's judgments (${st})`);
  const {setHash} = await (await fetch(API)).json(), probe = {id: 'probe-0001-zz', kind: 'verdict', theme: all.find(e => e.kind === 'verdict').theme, value: 'keep'};
  const post = body => fetch(API, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}).then(r => r.status === 200 ? r.json() : r.status);
  const r1 = await post({setHash, events: [probe]}), r2 = await post({setHash, events: [probe]});
  ok(r1.added === 1 && r2.added === 0, 'the API keeps a retried event once');
  ok(await post({setHash: 'changed', events: [probe]}) === 409, 'the API refuses events for a changed set');
  await k.goto(U + '/results'); await k.waitForSelector('tbody tr');
  ok(await k.$$eval('tbody tr', r => r.length) === (await (await fetch(`${HOST}/generated/concept-lab/rate/sets/zz-check/set.json`)).json()).themes.length, 'results list every theme');
  await k.screenshot({path: `${OUT}/desk-results.png`});
  await k.goto(`${HOST}/rate/`); await k.waitForSelector('.sets a'); ok(true, 'the home page lists the sets');
  ok(!errs.length, `no page errors ${errs.join(' | ')}`);
} catch (e) {fails++; console.log('FAIL', e.message.split('\n').slice(0, 30).join('\n'));}
finally {await b.close(); unlink(); rmSync(LOG, {force: true});}
console.log(fails ? `${fails} failed` : 'all passed'); process.exitCode = fails ? 1 : 0;
