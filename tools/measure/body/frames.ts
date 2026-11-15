// usage: node tools/measure/body/frames.ts DIR from to : replayed push per frame with the v5 events
import {accounts} from './recount.ts';
const a = accounts(process.argv[2])!, fr = a.frames, v5 = a.results[1], lo = Math.round(+process.argv[3] * 40), hi = Math.round(+process.argv[4] * 40);
const matched = new Map(v5.account.matches.map((m: any) => [m.event, v5.targets[m.target].impact]));
const at = new Map<number, string>(); v5.events.forEach((e: any, i: number) => at.set(e.onset, `${e.kind} ${e.strength.toFixed(2)} ${matched.has(i) ? 'ASKED ' + matched.get(i) : 'extra'} [${e.contactStart}-${e.end}]`));
const tg = new Map(v5.targets.map((t: any) => [t.frame, t.impact]));
for (let i = lo; i <= hi; i++) {const f = fr[i], n = fr[i + 1], M = n ? Math.hypot(f.impulse[0] + n.impulse[0], f.impulse[1] + n.impulse[1], f.impulse[2] + n.impulse[2]) / 7.55 : 0;
  console.log(i, (i / 40).toFixed(3), f.contact ? 'c' : ' ', 'J', f.J.toFixed(2), 'spin', f.impulse[2].toFixed(2).padStart(5), 'M', M.toFixed(2), '#'.repeat(Math.min(30, Math.round(M * 60))).padEnd(30), tg.has(i) ? 'beat ' + tg.get(i) : '', at.get(i) ?? '');}
