// Reviewer: Copy without clipboard permission (fallback path), and the summary page at ?q=9.
import {chromium} from 'playwright';
const b = await chromium.launch({args: ['--mute-audio']});
try {
  const p = await (await b.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true})).newPage();
  await p.goto('http://127.0.0.1:8770/generated/concept-lab/?q=9');
  await p.waitForFunction(() => !document.getElementById('qsummary').hidden, null, {timeout: 60000});
  await p.evaluate(() => {Object.defineProperty(navigator, 'clipboard', {value: undefined});});
  await p.locator('#qcopy').click(); await p.waitForTimeout(300);
  console.log('button:', await p.locator('#qcopy').textContent());
  console.log('selected:', await p.evaluate(() => {const b = document.getElementById('qsummary'); return [b.selectionStart, b.selectionEnd, b.value.length];}));
} finally {await b.close();}
