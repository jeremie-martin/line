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
