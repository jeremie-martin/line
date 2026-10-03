/** Owner judgments from blind labelling studies, appended to
 * labels/studies/<study>.jsonl (tracked: these are ground truth, not scratch).
 *   GET  /api/labels/<study>  → {labeled: clip ids with a non-skipped answer}
 *   POST /api/labels/<study>  ← {clip, skipped, answers, note, viewMs, at} */
import type {IncomingMessage, ServerResponse} from 'node:http';
import {appendFileSync, existsSync, mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const reply = (res: ServerResponse, data: unknown, status = 200) => {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data));
};
export function createLabelsApi(root = process.cwd()) {
  const store = join(root, 'labels/studies');
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    const match = /^\/api\/labels\/([a-z0-9-]+)$/.exec(url.pathname);
    if (!match) return false;
    const study = match[1], manifestPath = join(root, 'generated/label-studies', study, 'manifest.json'), file = join(store, study + '.jsonl');
    if (!existsSync(manifestPath)) {reply(res, {error: 'unknown study'}, 404); return true;}
    const rows = () => existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
    if (req.method === 'GET') {
      const latest = new Map<string, any>(); for (const r of rows()) latest.set(r.clip, r);
      reply(res, {labeled: [...latest.values()].filter(r => !r.skipped).map(r => r.clip)}); return true;
    }
    if (req.method !== 'POST') {reply(res, {error: 'method not allowed'}, 405); return true;}
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) {reply(res, {error: 'same-origin requests only'}, 403); return true;}
    let text = '';
    for await (const chunk of req) {text += chunk; if (text.length > 16384) {reply(res, {error: 'label too large'}, 413); return true;}}
    const label = JSON.parse(text), manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const clip = manifest.clips.find((c: any) => c.id === label.clip);
    if (!clip) {reply(res, {error: 'unknown clip'}, 400); return true;}
    if (!label.skipped) for (const q of manifest.questions)
      if (!q.options.includes(label.answers?.[q.id])) {reply(res, {error: `missing answer: ${q.id}`}, 400); return true;}
    mkdirSync(store, {recursive: true});
    appendFileSync(file, JSON.stringify({study, clip: clip.id, skipped: !!label.skipped, answers: label.skipped ? null : label.answers,
      note: typeof label.note === 'string' ? label.note.slice(0, 2000) : null, viewMs: Number(label.viewMs) || null,
      at: typeof label.at === 'string' ? label.at : new Date().toISOString()}) + '\n');
    reply(res, {ok: true}); return true;
  };
}
