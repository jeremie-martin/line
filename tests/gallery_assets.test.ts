import {existsSync, readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect, it} from 'vitest';

it('every gallery page references local files that exist', () => {
  const missing: string[] = [];
  for (const page of readdirSync('motion-gallery').filter(f => f.endsWith('.html')))
    for (const [, url] of readFileSync(join('motion-gallery', page), 'utf8').matchAll(/(?:href|src)="([^"#?]+)/g))
      if (/\.(css|js|mjs)$/.test(url) && !/^(https?:|\/)/.test(url) && !existsSync(join('motion-gallery', url))) missing.push(`${page}: ${url}`);
  expect(missing).toEqual([]);
});
