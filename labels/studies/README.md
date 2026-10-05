# Blind labelling studies

Owner judgments are ground truth for choosing an impact definition. Each study has:

- `<id>.manifest.json` — the clips exactly as shown (shuffled, no source or measure visible).
- `<id>.key.json` — for analysis only: each clip's source ride, selection reason,
  design/holdout split and the candidate measures at that beat.
- `<id>.jsonl` — the answers, appended by the review server as they are given.

Label at `http://127.0.0.1:8767/motion-gallery/label.html?study=<id>` (`npm run serve`).
Analyse with `npm run labels:analyze -- --study=<id> --split=design`; read the
`holdout` split only once, for the final decision. The playable clip records live in
`generated/label-studies/<id>/` and are rebuilt by `npm run measure && npm run labels:study`
from the same rides (their hashes are pinned in the manifest).

## Pair studies

`slam-2026-10` asks which of two strong-requested hits feels more like a slam
(10 pairs: a body-first or guide-rail hit against a clean sled landing, matched on
strike strength; sides in the key). Answer at
`http://127.0.0.1:8767/motion-gallery/pairs.html?study=slam-2026-10`. The clips are plain
landscape renders (no overlay), rebuilt by
`node --import tsx tools/measure/pair_study.ts --key=labels/studies/slam-2026-10.key.json --study=slam-2026-10`.

`impact-pairs-2026-10` asks which of two hits is the bigger impact (24 pairs: 20
where the strike strength and the candidate whole-body motion change of
`tools/measure/motion_change.ts` disagree most, 4 where both agree strongly as
checks; `tools/measure/select_pairs.ts`). Answer at
`http://127.0.0.1:8767/motion-gallery/pairs.html?study=impact-pairs-2026-10`.
`impact-pairs-2026-10b` is round 2 on fresh hits: 10 confirmation pairs (candidate vs
strike), 7 spin pairs (candidate with vs without spin), 7 window pairs (50 ms vs whole
event) and 3 checks. Answer at
`http://127.0.0.1:8767/motion-gallery/pairs.html?study=impact-pairs-2026-10b`.
`impact-pairs-2026-10c` is round 3: 9 pairs arrival-with-spin (`c_arrive_spin`) vs whole-body
change in 50 ms, 8 pairs whole event vs 50 ms, 6 pairs with vs without spin, 3 checks. Answer at
`http://127.0.0.1:8767/motion-gallery/pairs.html?study=impact-pairs-2026-10c`.

## Sources (reproducibility)

`sources/` holds everything needed to rebuild and re-score the studies without
`generated/`:
- the source track of every ride a study judged (`<set>~<song>~<seed>.track.json.gz`,
  index with original paths in `sources/index.json`);
- the per-event measure tables the pair studies were scored with
  (`motion-change-20261004.jsonl.gz` with the window fix,
  `impact-candidates-20261004.jsonl.gz`).

Re-score with `node --import tsx tools/measure/analyze_pairs.ts --studies=impact-pairs-2026-10,impact-pairs-2026-10b,impact-pairs-2026-10c --rows=<the two tables, gunzipped>`.

`night-pairs-2026-10-05` is the original overnight compiler study: 16 random strong
beats and 6 posture contrasts sampled at impact onset. Only 5 of those 6 also
contrast at first contact, which is the instant the scorecard measures. Its clips,
key and existing answers are preserved under that ID.

`night-pairs-2026-10-05-contact` corrects that sampling mismatch: 16 random strong
beats and 6 posture contrasts using the exact first-contact observation saved by
evaluation. Both groups compare the same song, seed and beat, with shuffled sides;
clips remain centered on impact onset. Built by `tools/report/morning_study.ts`.
Answer at
`http://127.0.0.1:8767/motion-gallery/pairs.html?study=night-pairs-2026-10-05-contact`.

The two complete source evaluations for the corrected study are preserved in
`sources/night-eval-20261005.tar.gz` (plans, measurements and compressed tracks).
To reconstruct them on a checkout without those runs, extract into
`generated/eval/`; never overwrite an existing run. Then render the saved key with
`tools/measure/pair_study.ts --key=labels/studies/night-pairs-2026-10-05-contact.key.json
--study=<fresh-id>`. Rendering verifies the authoring and audio against the saved
inputs. Existing study IDs are immutable; use a new ID for any new selection or
rendering revision. Large videos and the complete historical archive stay local.
