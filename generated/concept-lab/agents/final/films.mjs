import {chromium} from 'playwright';
const OUT = 'generated/concept-lab/agents/final/shots/';
const b = await chromium.launch({args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required']});
const p = await (await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 3, isMobile: true, hasTouch: true})).newPage();
const log = []; p.on('pageerror', e => log.push('err ' + e.message));
await p.goto('http://127.0.0.1:8770/motion-gallery/video-compare.html?collection=/generated/concept-lab/films.json');
await p.waitForTimeout(2000);
const vis = async () => p.evaluate(() => [...document.querySelectorAll('video')].filter(v => v.offsetParent && getComputedStyle(v).visibility !== 'hidden' && getComputedStyle(v).opacity !== '0').map(v => [v.currentSrc.split('/').pop(), v.currentTime.toFixed(2), v.paused, v.readyState]));
await p.getByRole('button', {name: 'Play', exact: true}).click();
await p.waitForTimeout(4000);
log.push('playing ' + JSON.stringify(await vis()));
for (const name of ['Ride first', 'Catch', 'Together', 'Today (shipped)']) {
  await p.getByRole('button', {name, exact: true}).click(); await p.waitForTimeout(700);
  log.push(name + ' ' + JSON.stringify(await vis()));
}
const r = await p.evaluate(() => {const v = [...document.querySelectorAll('video')].find(v => v.offsetParent); const a = v.getBoundingClientRect(); const btn = [...document.querySelectorAll('button')].find(b => b.textContent === 'Ride first').getBoundingClientRect(); return {video: [a.top, a.bottom], rideBtn: [btn.top, btn.bottom], scrollY}});
log.push('layout ' + JSON.stringify(r));
await p.getByRole('button', {name: 'Lua na Praça'}).click(); await p.waitForTimeout(1500);
log.push('lua ' + JSON.stringify(await vis()));
await p.screenshot({path: OUT + 'films-playing.png'});
console.log(log.join('\n')); await b.close();
