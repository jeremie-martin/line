/** Song-level summaries of eval runs, shared by the eval report and the night
 * report (tools/report): one cell's decision numbers, per-song means (optionally
 * paired differences against another run) and the song bootstrap. */
import {readFileSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {makeRng} from '../../scripts/lib/rng.ts';

export const SONGS = ['luna_bala_44s', 'amor_na_praia_46s', 'tiki_tiki_48s', 'amour_de_ma_vie_44s'];
export const median = (xs: number[]) => {const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN;};
export const mean = (xs: number[]) => {const s = xs.filter(Number.isFinite); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : NaN;};
/** Song-level summary of one cell: the numbers a decision would be based on. */
export function summarize(cell: any) {
  const b = cell.beats.filter((r: any) => r.requested != null), strong = b.filter((r: any) => r.requested >= .6), quiet = b.filter((r: any) => r.requested <= .15);
  const strengthErr = (rows: any[]) => Math.sqrt(mean(rows.map((r: any) => ((r.r1?.strength ?? 0) - r.requested) ** 2)));
  return {
    complete: cell.complete ? 1 : 0, fulfilled: cell.fulfilled ? 1 : 0,
    frozenScore: cell.frozen.valid ? cell.frozen.score : NaN,
    'strength rms (R1)': strengthErr(b), 'strong strength rms': strengthErr(strong), 'quiet strength rms': strengthErr(quiet),
    'peak lag ms (median)': median(b.map((r: any) => (r.r1?.peak ?? NaN) * 25)),
    'peaks >100 ms late': mean(b.map((r: any) => r.r1 ? (r.r1.peak * 25 > 100 ? 1 : 0) : NaN)),
    'contested strong beats': mean(strong.map((r: any) => r.impulse.competitor >= .5 * r.impulse.hit ? 1 : 0)),
    'strong extra hits / beat': mean(b.map((r: any) => r.extrasR1.filter((e: any) => e.strength >= .25).length)),
    'hidden contacted bend / beat': mean(b.map((r: any) => r.hiddenBend)),
    'contact-impact loss': cell.contact.loss,
    'strike loss': cell.strike?.loss ?? NaN,
    'strike strength rms': cell.strike ? Math.sqrt(cell.strike.strengthMse) : NaN,
    'strike extra (mse)': cell.strike?.extraMse ?? NaN,
    'strong extra strikes / beat': mean(b.map((r: any) => r.strike ? r.strike.extras.filter((e: any) => e.strength >= .25).length : NaN)),
    'impact loss (v2)': cell.impact?.loss ?? NaN,
    'impact strength rms (v2)': cell.impact ? Math.sqrt(cell.impact.strengthMse) : NaN,
    'impact extra (v2, mse)': cell.impact?.extraMse ?? NaN,
    'strong extra impacts / beat (v2)': cell.impact ? cell.impact.strongExtras / cell.impact.beats : NaN,
    'impact loss (v3)': cell.impact3?.loss ?? NaN,
    'strong extra impacts / beat (v3)': cell.impact3 ? cell.impact3.strongExtras / cell.impact3.beats : NaN,
    'double impacts / beat (v3 − v2)': cell.impact3 ? cell.impact3.splits / cell.impact3.beats : NaN,
    ...(() => {
      // Per-beat v3 strength by requested band (beats without a matched impact excluded).
      const rows = (cell.impact3?.perBeat ?? []).filter((r: any) => r[0] != null && r[1] != null);
      const band = (a: number, b: number) => rows.filter((r: any) => r[0] >= a && r[0] < b);
      const bias = (xs: any[]) => mean(xs.map((r: any) => r[1] - r[0])), rms = (xs: any[]) => Math.sqrt(mean(xs.map((r: any) => (r[1] - r[0]) ** 2)));
      return {'v3 strong bias (req>=0.6)': bias(band(.6, 2)), 'v3 strong rms (req>=0.6)': rms(band(.6, 2)),
        'v3 very strong bias (req>=0.8)': bias(band(.8, 2)), 'v3 quiet bias (req<0.15)': bias(band(0, .15))};
    })(),
    'strong arrivals inverted/backward': cell.guards?.strongInverted ?? NaN,
    'body drag s/min': cell.guards?.dragSecondsPerMinute ?? NaN,
    'off-beat kicks / ride': cell.guards?.offBeatKicks ?? NaN,
    'air rms': cell.frozen.axes?.air?.rmsError ?? NaN,
    'speed rms': cell.frozen.axes?.speed?.rmsError ?? NaN,
    'amplitude rms': cell.frozen.axes?.amplitude?.rmsError ?? NaN,
    'burst excess (100 ms)': cell.motion?.bursts?.[1]?.excessIntegral ?? NaN,
    'physics frames (M)': cell.physicalFrames / 1e6, 'compile s': cell.compileMs / 1000,
  };
}
export function bootstrap(perSong: Map<string, number>, draws = 4000) {
  const values = [...perSong.values()].filter(Number.isFinite), rng = makeRng(7), out: number[] = [];
  if (!values.length) return [NaN, NaN, NaN];
  for (let d = 0; d < draws; d++) {let s = 0; for (let i = 0; i < values.length; i++) s += values[Math.floor(rng() * values.length)]; out.push(s / values.length);}
  out.sort((a, b) => a - b);
  return [mean(values), out[Math.floor(.025 * draws)], out[Math.floor(.975 * draws)]];
}


export type Run = {run: any; cells: Map<string, any>};
export function loadRun(name: string): Run {
  const dir = resolve('generated/eval', name), cells = new Map<string, any>();
  for (const f of readdirSync(join(dir, 'cells')).filter(f => f.endsWith('.json'))) {const c = JSON.parse(readFileSync(join(dir, 'cells', f), 'utf8')); cells.set(c.case.id, c);}
  return {run: JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8')), cells};
}
/** Per-song mean of a metric over the cells passing `filter`; with `diff`, the
 * mean paired difference against the same cases of another run. */
export function songValues(run: Run, metric: string, filter: (c: any) => boolean, diff?: Run) {
  const m = new Map<string, number>();
  for (const song of SONGS) {
    const xs = [...run.cells.values()].filter(filter).filter((c: any) => c.case.song === song).map((c: any) => {
      const value = summarize(c)[metric as keyof ReturnType<typeof summarize>] as number;
      if (!diff) return value;
      const other = diff.cells.get(c.case.id); return other ? value - (summarize(other)[metric as keyof ReturnType<typeof summarize>] as number) : NaN;
    });
    m.set(song, mean(xs));
  }
  return m;
}
