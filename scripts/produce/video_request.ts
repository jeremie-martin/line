/** Small public interface shared by fresh productions and saved rides. */
import {availableParallelism, totalmem} from 'node:os';

export function videoRequest(argv: string[]) {
  const args: Record<string, string> = {};
  const allowed = new Set(['song','study','id','track','audio','spec','seed','budget','format','style','workers','zoom-mult','out']);
  for (const token of argv) {
    const match = /^--([^=]+)=(.+)$/.exec(token);
    if (!match || !allowed.has(match[1]) || match[1] in args) throw new Error(`Unknown, repeated or incomplete option: ${token}. Use --help.`);
    args[match[1]] = match[2];
  }
  if (['song','study','track'].filter(key => args[key]).length !== 1) throw new Error('Choose one input: --song, --study or --track.');
  const style = args.style ?? (args.track ? 'plain' : 'finished');
  if (style !== 'plain' && style !== 'finished') throw new Error('--style must be plain or finished');
  const format = args.format ?? (style === 'plain' ? 'horizontal' : 'vertical');
  if (format !== 'horizontal' && format !== 'vertical') throw new Error('--format must be horizontal or vertical');
  if (args.track && style !== 'plain') throw new Error('--track supports plain video; use --study for measured presentation effects.');
  if (!args.track && (args.audio || args.spec)) throw new Error('--audio and --spec apply only to --track; saved productions carry their own inputs.');
  if (!args.song && (args.seed || args.budget)) throw new Error('--seed and --budget apply only to --song.');
  if (args.id && !args.study) throw new Error('--id applies only to --study.');
  const integer = (key: string, fallback?: number) => {
    if (args[key] === undefined) return fallback;
    const value = Number(args[key]);
    if (!/^\d+$/.test(args[key]) || !Number.isSafeInteger(value) || value < (key === 'seed' ? 0 : 1)) throw new Error(`--${key} must be ${key === 'seed' ? 'a nonnegative' : 'a positive'} integer`);
    return value;
  };
  const zoomMult = Number(args['zoom-mult'] ?? (format === 'vertical' ? 1.8 : style === 'plain' ? 3.5 : 1));
  if (!Number.isFinite(zoomMult) || zoomMult <= 0) throw new Error('--zoom-mult must be positive');
  // One requested video can use more workers than each lane of a collection.
  const defaultWorkers = Math.max(1, Math.min(16, availableParallelism(), Math.floor(totalmem() / 2 ** 31)));
  return {song: args.song, study: args.study, id: args.id, track: args.track, audio: args.audio, spec: args.spec, out: args.out, zoomOverride: args["zoom-mult"] !== undefined,
    style: style as "plain" | "finished", format: format as "horizontal" | "vertical", seed: integer('seed'), budget: integer('budget'), workers: integer('workers', defaultWorkers)!,
    render: {res: format === 'vertical' ? '1080x1920' : '1920x1080', zoomMult, beatPunchPct: style === 'finished' ? 70 : 0}};
}
