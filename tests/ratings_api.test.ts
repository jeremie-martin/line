import {describe, expect, it} from 'vitest';
import {checkEvent} from '../scripts/gallery/ratings_api.ts';
// @ts-expect-error: a plain browser module, shared by the judging page and its report
import {fold, fit, choosePair} from '../generated/concept-lab/rate/model.js';

const themes = new Set(['t-aaa', 't-bbb']), id = 'abcdefgh12';

describe('theme judgments: the events the server keeps', () => {
  it('keeps a verdict, a duel, a note and a retraction, each with only its own fields', () => {
    expect(checkEvent({id, kind: 'verdict', theme: 't-aaa', value: 'keep', extra: 1}, themes))
      .toEqual({event: {v: 1, id, at: null, device: null, kind: 'verdict', theme: 't-aaa', value: 'keep'}});
    expect(checkEvent({id, kind: 'duel', left: 't-aaa', right: 't-bbb', outcome: 'pass', ms: 812.4, why: 'coverage'}, themes))
      .toMatchObject({event: {outcome: 'pass', ms: 812, why: 'coverage'}});
    expect(checkEvent({id, kind: 'note', themes: ['t-aaa', 't-bbb'], text: '  both drops are flat '}, themes)).toMatchObject({event: {text: 'both drops are flat'}});
    expect(checkEvent({id, kind: 'retract', target: 'xyz'}, themes)).toMatchObject({event: {kind: 'retract', target: 'xyz'}});
  });
  it('refuses events without an id, about unknown themes, or malformed', () => {
    expect(checkEvent({kind: 'verdict', theme: 't-aaa', value: 'keep'}, themes)).toHaveProperty('error');
    expect(checkEvent({id, kind: 'verdict', theme: 't-zzz', value: 'keep'}, themes)).toHaveProperty('error');
    expect(checkEvent({id, kind: 'verdict', theme: 't-aaa', value: 7}, themes)).toHaveProperty('error');
    expect(checkEvent({id, kind: 'duel', left: 't-aaa', right: 't-aaa', outcome: 'left'}, themes)).toHaveProperty('error');
    expect(checkEvent({id, kind: 'note', themes: [], text: 'x'}, themes)).toHaveProperty('error');
    expect(checkEvent({id, kind: 'grade', theme: 't-aaa'}, themes)).toEqual({error: 'unknown kind'});
  });
});

describe('theme judgments: the model', () => {
  const T = ['a', 'b', 'c', 'd', 'e', 'f'].map(x => ({id: x}));
  const duel = (n: number, left: string, right: string, outcome: string) => ({id: `d${n}`, kind: 'duel', left, right, outcome});
  it('folds the record: the latest verdict counts, a retracted event does not', () => {
    const r = fold([{id: '1', kind: 'verdict', theme: 'a', value: 'cut'}, {id: '2', kind: 'verdict', theme: 'a', value: 'love'},
      {id: '3', kind: 'verdict', theme: 'b', value: 'keep'}, {id: '4', kind: 'retract', target: '3'}, duel(5, 'a', 'b', 'left')]);
    expect(r.verdicts).toEqual({a: 'love'});
    expect(r.duels).toHaveLength(1);
  });
  it('orders the themes as the duels say, with ties and passes', () => {
    const order = ['a', 'b', 'c', 'd', 'e', 'f'], events: object[] = [];
    let n = 0;
    for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) events.push(duel(n++, order[j], order[i], 'right'));
    events.push(duel(n++, 'a', 'b', 'equal'), duel(n++, 'f', 'a', 'pass'));
    const f = fit(T, fold(events), {top: 3});
    expect(f.order.map((r: {id: string}) => r.id)).toEqual(order);
    expect(f.rows.a.pTop).toBeGreaterThan(0.9);
    expect(f.rows.f.pTop).toBeLessThan(0.1);
  });
  it('a verdict anchors a theme never duelled', () => {
    const f = fit(T, fold([{id: '1', kind: 'verdict', theme: 'e', value: 'love'}, {id: '2', kind: 'verdict', theme: 'b', value: 'cut'}]), {top: 2});
    expect(f.order[0].id).toBe('e');
    expect(f.order.at(-1).id).toBe('b');
  });
  it('chooses duels that cover every theme first, and leaves the cut ones out', () => {
    let seed = 1;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const events: object[] = [{id: 'v', kind: 'verdict', theme: 'f', value: 'cut'}];
    for (let n = 0; n < 15; n++) {
      const [l, r, why] = choosePair(T, fold(events), {rand});
      expect([l, r]).not.toContain('f');
      expect(l).not.toBe(r);
      if (n < 6) expect(why).toBe('coverage');
      events.push(duel(n, l, r, 'left'));
    }
    const count = (x: string) => fold(events).duels.filter((d: {left: string; right: string}) => d.left === x || d.right === x).length;
    for (const x of ['a', 'b', 'c', 'd', 'e']) expect(count(x)).toBeGreaterThanOrEqual(3);
  });
  it('a retired theme still informs the fit but is never shown and never counts for the best', () => {
    const events: object[] = [];
    let n = 0;
    // a beats everyone; b beats c, d, e; a is then retired
    for (let k = 0; k < 4; k++) for (const x of ['b', 'c', 'd', 'e', 'f']) events.push(duel(n++, x, 'a', 'right'));
    for (let k = 0; k < 4; k++) for (const x of ['c', 'd', 'e']) events.push(duel(n++, 'b', x, 'left'));
    const among = new Set(['b', 'c', 'd', 'e', 'f']), f = fit(T, fold(events), {top: 1, among});
    expect(f.rows.a.retired).toBe(true);
    expect(f.rows.a.pTop).toBeNull();
    expect(f.order.at(-1).id).toBe('a');  // listed last, unranked
    expect(f.order[0].id).toBe('b');
    expect(f.rows.b.rank).toBe(1);
    expect(f.rows.a.strength).toBeGreaterThan(f.rows.b.strength);  // what was said about it still stands
    let seed = 3;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 20; k++) expect(choosePair(T, fold(events), {rand, retired: new Set(['a'])})!.slice(0, 2)).not.toContain('a');
  });
});

describe('theme judgments: a theme is its full specification', () => {
  it('the id is the hash of the specification: key order and hex case do not matter, one colour does', async () => {
    // @ts-expect-error: a plain node script
    const {canonical, themeId, specOf} = await import('../generated/concept-lab/rate/freeze.mjs');
    const a = {look: {band: 'bars', top: 'sun'}, colours: {paper: '#FFFFFF', ink: '#111111'}, drop: null};
    const b = {drop: null, colours: {ink: '#111111', paper: '#ffffff'}, look: {top: 'sun', band: 'bars'}};
    expect(canonical(a)).toBe(canonical(b));
    expect(themeId(JSON.parse(canonical(a)))).toBe(themeId(JSON.parse(canonical(b))));
    expect(themeId({...a, colours: {...a.colours, paper: '#fffffe'}})).not.toBe(themeId(a));
    // a named scheme resolves to its colours and its drop partner's, every look option spelled out
    const spec = specOf({scheme: 'hokusai'}, {hokusai: {paper: '#eeeeee'}, hokusaiDrop: {paper: '#111111'}}, {hokusai: 'hokusaiDrop'});
    expect(spec.colours.paper).toBe('#eeeeee');
    expect(spec.drop.paper).toBe('#111111');
    expect(spec.look).not.toHaveProperty('scheme');
    expect(Object.keys(spec.look).length).toBeGreaterThan(5);
  });
});
