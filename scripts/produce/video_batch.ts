/** The plan of `npm run videos`: which videos a batch is made of, and what to do with each given what its folder already holds. */

export type BatchVideo = {song: string; seed: number; name: string};

/** `--songs=all` or names separated by commas; `--seeds=101,202` or a count (seeds 1 to N). Every song at every seed. */
export function batchPlan(songs: string, seeds: string, known: readonly string[]): BatchVideo[] {
  const names = songs === 'all' ? [...known] : songs.split(',').filter(Boolean);
  const unknown = names.filter(n => !known.includes(n));
  if (!names.length || unknown.length) throw new Error(`--songs takes all, or songs of productions/ separated by commas${unknown.length ? ` (unknown: ${unknown.join(', ')})` : ''}`);
  const list = seeds.split(',');
  if (!list.every(s => /^\d+$/.test(s)) || (list.length === 1 && +list[0] < 1)) throw new Error('--seeds takes a count (8: seeds 1 to 8) or seeds separated by commas (101,202)');
  const each = list.length === 1 ? Array.from({length: +list[0]}, (_, i) => i + 1) : [...new Set(list.map(Number))];
  return names.flatMap(song => each.map(seed => ({song, seed, name: `${song}-${seed}`})));
}

/** What a rerun does with one video: nothing when it is written; nothing either when an earlier attempt left its compile
 * folder without a video (the batch never deletes: remove NAME.assets to try again); otherwise make it. */
export function batchStep(has: {video: boolean; sidecar: boolean; assets: boolean}): 'done' | 'failed-earlier' | 'make' {
  return has.video && has.sidecar ? 'done' : has.video || has.sidecar || has.assets ? 'failed-earlier' : 'make';
}
