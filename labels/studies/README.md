# Blind labelling studies

Owner judgments are ground truth for choosing an impact definition. Each study has:

- `<id>.manifest.json` — the clips exactly as shown (shuffled, no source or measure visible).
- `<id>.key.json` — for analysis only: each clip's source ride, selection reason,
  design/holdout split and the candidate measures at that beat.
- `<id>.jsonl` — the answers, appended by the review server as they are given.

The first study, `impact-2026-10`, graded single clips (soft/medium/hard). That
method was retired for blind pairs, and its page and generator were removed on
2026-10-31 (last in commit 133f1360); its answers stay here. Analyse them with
`npm run labels:analyze -- --study=impact-2026-10 --split=design`.

## Pair studies

`slam-2026-10` asks which of two strong-requested hits feels more like a slam
(10 pairs: a body-first or guide-rail hit against a clean sled landing, matched on
strike strength; sides in the key). Answer at
`http://127.0.0.1:8767/motion-gallery/pairs.html?study=slam-2026-10`. The clips are plain
landscape renders (no overlay), rebuilt by
`node tools/measure/pair_study.ts --key=labels/studies/slam-2026-10.key.json --study=slam-2026-10`.

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

`upper-hits-2026-11` asks which of two strong-requested hits is the bigger impact: 14 pairs set a clean upper hit
(caught on a line's underside, no rail touched; `tools/measure/contact_role.ts`) against a floor hit of the same strike
strength (within 0.03) on a similar ask, from today's V8 rides (`compiler`, arm 52aabfd62e79d97a), plus 4 checks (one
kind, strengths 0.35 or more apart). It tests whether the strike measure under-rates clean upper hits, which it measures
as the softest kind on strong beats. Selected by `tools/measure/select_upper_pairs.ts`; answer at
`http://127.0.0.1:8767/motion-gallery/pairs.html?study=upper-hits-2026-11`.

**`upper-hits-2026-11` was answered as "which clip has the bigger upper hit"** (the owner, November 14): its answers do
not compare impacts. `upper-hits-2026-11-redo` asks its pairs again, with the question that names the marked hit;
answer at `http://127.0.0.1:8767/motion-gallery/pairs.html?study=upper-hits-2026-11-redo`.

`upper-hits-2026-11b` is the held-out check of a gravity-neutral strike strength (`tools/research/gravity_neutral.ts`:
the push a surface would need for the same turn with gravity against it; floors unchanged, catches from above about
+0.05). Fresh hits from the foundation's V8 rides (arm 2fee4728896e469a): 8 pairs where today's strength calls the
floor hit bigger (0.03–0.10) and the gravity-neutral one the clean upper hit; 6 where both call the floor hit bigger by
0.10–0.25; 4 checks of two floor hits 0.45 or more apart. Selected by `tools/measure/select_upper_pairs.ts --neutral`;
answer at `http://127.0.0.1:8767/motion-gallery/pairs.html?study=upper-hits-2026-11b`.

## Sources (reproducibility)

`sources/` holds everything needed to rebuild and re-score the studies without
`generated/`:
- the source track of every ride a study judged (`<set>~<song>~<seed>.track.json.gz`,
  index with original paths in `sources/index.json`);
- the per-event measure tables the pair studies were scored with
  (`motion-change-20261004.jsonl.gz` with the window fix,
  `impact-candidates-20261004.jsonl.gz`).

Re-score with `node tools/measure/analyze_pairs.ts --studies=impact-pairs-2026-10,impact-pairs-2026-10b,impact-pairs-2026-10c --rows=<the two tables, gunzipped>`.

`night-pairs-2026-10-05` is the original overnight compiler study: 16 random strong
beats and 6 posture contrasts sampled at impact onset. Only 5 of those 6 also
contrast at first contact, which is the instant the scorecard measures. Its clips,
key and existing answers are preserved under that ID.

`night-pairs-2026-10-05-contact` corrects that sampling mismatch: 16 random strong
beats and 6 posture contrasts using the exact first-contact observation saved by
evaluation. Both groups compare the same song, seed and beat, with shuffled sides;
clips remain centered on impact onset. Its key is saved here; the selection script
retired with the night report (tag `archive/pre-lean-foundation-2026-11`).
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

`impact-visibility-2026-11` (built 2026-10-31, docs/research/impact-visibility-study-20261031.md)
asks the same "bigger impact" question on 55 pairs from 76 held-out rides (seeds 9101–9124)
that no earlier study or report used. Block A (34) sets a lit unrequested extra, a late push
after a quiet touchdown or an anchor against a lit blank of plain riding; block R (21) sets two
clean requested hits at a controlled v3 ratio. The key holds every pair's measured values and
the pre-registered rules are in the report. The source tracks are
`sources/heldout~<song>~<seed>.track.json.gz`. Rebuild with
`node tools/measure/visibility/build.ts --study=<fresh-id>` after copying the key
to that id. Answer at
`http://127.0.0.1:8767/motion-gallery/pairs.html?study=impact-visibility-2026-11`.
