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
