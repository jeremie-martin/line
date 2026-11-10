/** The public interface of `npm run video`, shared by fresh productions, saved rides and bare tracks. */
import {DEFAULT_THEME, resolveLook} from '../video/look.js';

export function videoRequest(argv: string[]) {
  const args: Record<string, string> = {};
  const allowed = new Set(['song', 'study', 'id', 'track', 'music', 'seed', 'budget', 'look', 'set', 'from', 'to', 'width', 'out']);
  for (const token of argv) {
    const match = /^--([^=]+)=(.+)$/.exec(token);
    if (!match || !allowed.has(match[1]) || match[1] in args) throw new Error(`Unknown, repeated or incomplete option: ${token}. Use --help.`);
    args[match[1]] = match[2];
  }
  if (['song', 'study', 'track'].filter(key => args[key]).length !== 1) throw new Error('Choose one input: --song, --study or --track.');
  if (args.track && !args.music) throw new Error('--track needs --music=SONG (a folder of productions/): its recording and title.');
  if (!args.track && args.music) throw new Error('--music applies only to --track; saved productions carry their own song.');
  if (!args.song && (args.seed || args.budget)) throw new Error('--seed and --budget apply only to --song.');
  if (args.id && !args.study) throw new Error('--id applies only to --study.');
  const number = (key: string, test: (n: number) => boolean, what: string) => {
    if (args[key] === undefined) return undefined;
    const value = Number(args[key]);
    if (!test(value)) throw new Error(`--${key} must be ${what}`);
    return value;
  };
  const integer = (key: string, min: number) => number(key, n => /^\d+$/.test(args[key]) && Number.isSafeInteger(n) && n >= min, min ? 'a positive integer' : 'a nonnegative integer');
  const seconds = (key: string) => number(key, n => Number.isFinite(n) && n >= 0, 'a time in seconds');
  const lookName = args.look ?? (args.track ? 'plain' : DEFAULT_THEME);
  const overrides = Object.fromEntries((args.set ?? '').split(',').filter(Boolean).map(kv => {
    const [key, value, extra] = kv.split(':');
    if (!value || extra !== undefined) throw new Error(`--set takes key:value pairs separated by commas (got ${kv})`);
    return [key, value];
  }));
  return {song: args.song, study: args.study, id: args.id, track: args.track, music: args.music, out: args.out,
    seed: integer('seed', 0), budget: integer('budget', 1), from: seconds('from'), to: seconds('to'), width: integer('width', 1) ?? 1080,
    lookName, look: resolveLook(lookName, overrides)};
}
