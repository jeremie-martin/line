import {it, expect, vi, afterEach} from 'vitest';
import {mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const mocks = vi.hoisted(() => ({launch: vi.fn()}));
vi.mock('playwright', () => ({chromium: {launch: mocks.launch}}));
import {exportVideo} from '../scripts/lib/export.ts';
afterEach(() => {vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();});

it('waits for readiness and releases every timeout after a successful download', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok:true}));
  const dir = mkdtempSync(join(tmpdir(), 'line-export-'));
  const page = {on:vi.fn(),goto:vi.fn(),waitForFunction:vi.fn(),evaluate:vi.fn().mockResolvedValue('blob:ride'),
    waitForEvent:vi.fn().mockResolvedValue({saveAs:async (path:string) => writeFileSync(path,'video')})};
  const browser = {newContext:vi.fn().mockResolvedValue({newPage:async () => page}),close:vi.fn().mockResolvedValue(undefined)};
  mocks.launch.mockResolvedValue(browser);
  try {
    await exportVideo({trackJson:{},outPath:join(dir,'ride.mp4'),log:()=>{}});
    expect(page.waitForFunction).toHaveBeenCalledOnce();
    expect(page.waitForEvent).toHaveBeenCalledWith('download',{timeout:15_000});
    expect(vi.getTimerCount()).toBe(0);
    expect(browser.close).toHaveBeenCalledOnce();
    expect(readFileSync(join(dir,'ride.mp4'),'utf8')).toBe('video');
  } finally {rmSync(dir,{recursive:true,force:true});}
});
