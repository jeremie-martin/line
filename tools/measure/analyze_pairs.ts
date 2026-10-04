/** Scores strength measures against the owner's blind pair answers ("which is
 * the bigger impact?"). A measure is right on a decisive pair when it ranks the
 * chosen hit higher. "About the same" answers are reported as the measure's
 * relative gap (smaller is better). Measures come from motion_change.ts and
 * impact_candidates.ts outputs, joined on ride and onset.
 *
 *   node --import tsx tools/measure/analyze_pairs.ts --studies=a,b --rows=changes.jsonl,candidates.jsonl
 *       [--measures=strike,strength,c_arrive] */
import {readFileSync, existsSync} from 'node:fs';

const arg = (k: string, d?: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const studies = arg('studies')!.split(',');
const values = new Map<string, Record<string, number>>();
for (const path of arg('rows')!.split(',')) for (const line of readFileSync(path, 'utf8').trim().split('\n')) {
  const r = JSON.parse(line), id = `${r.set}~${r.song}~${r.seed}~${r.onset}`;
  values.set(id, {...values.get(id), ...Object.fromEntries(Object.entries(r).filter(([, v]) => typeof v === 'number'))});
}
const measures = (arg('measures') ?? 'strike,strength,travel,whole,mcOwn,c_arrive,c_arrive_spin,c_loss').split(',');

// One-sided sign test: probability of at least k successes in n fair coin flips.
const tail = (k: number, n: number) => {let p = 0, c = 1; for (let i = 0; i <= n; i++) {if (i >= k) p += c; c = c * (n - i) / (i + 1);} return p / 2 ** n;};

type Row = {study: string; pair: number; kind: string; block: string; choice: string; L: Record<string, number>; R: Record<string, number>; shownL: any; shownR: any};
const rows: Row[] = [];
for (const study of studies) {
  const key = JSON.parse(readFileSync(`labels/studies/${study}.key.json`, 'utf8'));
  const path = `labels/studies/${study}.jsonl`;
  if (!existsSync(path)) continue;
  const answers = new Map<string, any>();
  for (const line of readFileSync(path, 'utf8').trim().split('\n')) {const a = JSON.parse(line); answers.set(a.clip, a);}
  for (const k of key) {
    const a = answers.get(`pair${k.pair}`); if (!a || a.skipped) continue;
    const look = (h: any) => values.get(`${h.set}~${h.song}~${h.seed}~${h.frame}`) ?? {};
    rows.push({study, pair: k.pair, kind: k.kind, block: k.kind === 'check' ? 'check' : (k.measures ?? ['strike', 'strength']).join(' vs '),
      choice: Object.values(a.answers)[0] as string, L: {...look(k.left), shown: k.left.strength}, R: {...look(k.right), shown: k.right.strength}, shownL: k.left, shownR: k.right});
  }
}
const all = [...measures, 'shown'];
const report = (title: string, set: Row[]) => {
  const decisive = set.filter(r => r.choice === 'left' || r.choice === 'right'), same = set.filter(r => r.choice === 'same');
  console.log(`\n${title}: ${set.length} pairs, ${decisive.length} decisive, ${same.length} same, ${set.filter(r => r.choice === 'neither').length} neither`);
  for (const m of all) {
    const scored = decisive.filter(r => r.L[m] !== undefined && r.R[m] !== undefined && r.L[m] !== r.R[m]);
    const right = scored.filter(r => (r.L[m] > r.R[m] ? 'left' : 'right') === r.choice).length;
    const gaps = same.filter(r => r.L[m] !== undefined).map(r => Math.abs(r.L[m] - r.R[m]) / Math.max(r.L[m], r.R[m], 1e-9));
    const med = gaps.length ? gaps.sort((a, b) => a - b)[gaps.length >> 1] : NaN;
    console.log(`  ${m.padEnd(14)} right ${String(right).padStart(2)}/${String(scored.length).padEnd(2)}  p(chance) ${tail(right, scored.length).toFixed(3)}  median gap on "same" ${med.toFixed(2)}`);
  }
};
report('all studies', rows);
for (const study of studies) report(study, rows.filter(r => r.study === study));
for (const block of [...new Set(rows.map(r => r.block))]) report(`block ${block}`, rows.filter(r => r.block === block));
// Head to head: on decisive pairs where two measures disagree, which one matches the owner.
console.log('\nhead to head on decisive pairs where the two measures disagree:');
const decisive = rows.filter(r => r.choice === 'left' || r.choice === 'right');
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
  const a = all[i], b = all[j], split = decisive.filter(r => Math.sign(r.L[a] - r.R[a]) !== Math.sign(r.L[b] - r.R[b]));
  const winsA = split.filter(r => (r.L[a] > r.R[a] ? 'left' : 'right') === r.choice).length;
  if (split.length) console.log(`  ${a.padEnd(14)} ${String(winsA).padStart(2)} : ${String(split.length - winsA).padEnd(2)} ${b}`);
}
