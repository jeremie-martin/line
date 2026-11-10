import {afterEach, expect, it} from 'vitest';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {preserveStills} from '../generated/concept-lab/rate/freeze.mjs';

const dirs: string[] = [];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'rating-stills-test-')); dirs.push(dir);
  const rendered = join(dir, 'rendered'), out = join(dir, 'frozen');
  mkdirSync(rendered); mkdirSync(out);
  const put = (where: string, name: string, bytes: string) => writeFileSync(join(where, name), bytes);
  return {rendered, out, put};
}
afterEach(() => {for (const dir of dirs.splice(0)) rmSync(dir, {recursive: true, force: true});});

it('adds missing stills while leaving identical frozen images untouched', () => {
  const {rendered, out, put} = fixture();
  put(out, 'old.jpg', 'judged'); put(rendered, 'old.jpg', 'judged'); put(rendered, 'new.jpg', 'new');
  const old = statSync(join(out, 'old.jpg'));
  preserveStills(rendered, out, ['new.jpg', 'old.jpg']);
  expect(readFileSync(join(out, 'new.jpg'), 'utf8')).toBe('new');
  expect(readFileSync(join(out, 'old.jpg'), 'utf8')).toBe('judged');
  expect(statSync(join(out, 'old.jpg')).mtimeMs).toBe(old.mtimeMs);
  expect(statSync(join(out, 'old.jpg')).ino).toBe(old.ino);
});

it('refuses a changed judged image before publishing any part of the batch', () => {
  const {rendered, out, put} = fixture();
  put(out, 'old.jpg', 'judged'); put(rendered, 'old.jpg', 'changed'); put(rendered, 'new.jpg', 'new');
  expect(() => preserveStills(rendered, out, ['new.jpg', 'old.jpg'])).toThrow('differs from the frozen still');
  expect(readFileSync(join(out, 'old.jpg'), 'utf8')).toBe('judged');
  expect(existsSync(join(out, 'new.jpg'))).toBe(false);
});

it('does not publish an incomplete render batch', () => {
  const {rendered, out, put} = fixture(); put(rendered, 'first.jpg', 'ready');
  expect(() => preserveStills(rendered, out, ['first.jpg', 'missing.jpg'])).toThrow();
  expect(existsSync(join(out, 'first.jpg'))).toBe(false);
});
