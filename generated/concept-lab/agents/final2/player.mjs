// Reviewer: player at phone size.
import {chromium} from 'playwright';
const b = await chromium.launch({args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required']});
const errs = [];
try {
  const p = await (await b.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true})).newPage();
  p.on('pageerror', e => errs.push(e.message)); p.on('response', r => {if (r.status() >= 400) errs.push(r.status() + ' ' + r.url());});
  await p.goto('http://127.0.0.1:8770/motion-gallery/video-compare.html?collection=/generated/concept-lab/films2.json');
  await p.waitForTimeout(4000);
  await p.screenshot({path: 'generated/concept-lab/agents/final2/shots/player.png', fullPage: true});
  console.log(await p.evaluate(() => document.body.innerText.slice(0, 1500)));
} finally {await b.close();}
console.log('errors', errs);
