# Benchmark V2 — Eval-Chain Live Validation (V1–V7)

Date: 2026-07-11/12. The eval chain (RFC Part C.2, shipped in commit
040187b) validated **by using it for real** under predeclared success
criteria. Honest-verdict rule: an inconclusive or reject verdict on a real
candidate is a *successful* validation of the instrument — the criterion is
that the workflow behaves as specified, not that the candidate wins.

## Summary

| # | Scenario | Predeclared bars | Result |
|---|---|---|---|
| V1 | 4 stage-0 loops on `LR_IMPACT_LOCAL_W` ∈ {0.35, 0.65, 0.8, 1.0} | ≤2 min/loop; deltas comparable; advice consistent with the grid | **PASS** — 75/74/75/74 s; deltas −0.07/−0.14/+0.47/+0.45; advice correct in both directions |
| V2 | Futility on a known regression (`LR_QUALITY_NCAND=1`), improve/d48 | stop at look ≤4; exit 4; correct ledger spend; ≤10 min | **PASS** (smoke, scratch state) — stopped at k=2, UB95 −120.7; exit 4; spend charged; 173 s |
| V3 | Real improvement attempt: `LR_IMPACT_LOCAL_W` default 0.5→0.8 as a source change | ≤40 min wall to interpretable report; honest verdict; era chain + budget correct | **PASS as instrument validation** — the chain exposed the +0.46 screen as probe noise (informational d48 readout: −0.05 [−0.55, +0.45]); two infrastructure defects found + fixed; default reverted with an institutional note |
| V4 | Real ablation: delete the `LR_RANK_QUALITY=off` escape hatch, simplify m=5/d48 | same bars; margin semantics correctly reported | **PASS — ACCEPT** at depth 48; qualification sidecar ran; rebaseline closed the era |
| V5 | Crash/resume drill: kill mid-wave, resume | zero lost completed compiles; futility durability; no re-declaration | **PASS with one v1 defect found and fixed** (see below) |
| V6 | Governance drills | every gate fires with an actionable message naming the fix | **PASS** — all five gates fired correctly |
| V7 | Agent-operability: `--json` + exit codes only | nextCommand chain executes verbatim; no human parsing | **PASS** — the driver screened, reacted to the exhaustion refusal with a ledgered override, took the verdict by exit code, and executed the accept's nextCommand verbatim through rebaseline |

## V1 — stage-0 iteration loops

Four screens of the current tree with `LR_IMPACT_LOCAL_W` overrides, each a
full 252-compile probe + integrity-checked comparison vs the stored
reference:

| Override | Wall | Delta | probe SE | identical pairs | Advice line |
|---|---:|---:|---:|---:|---|
| 0.35 | 75 s | −0.07 | 0.16 | 97.2% | "does not clear the threshold; confirmation would test a non-positive effect" |
| 0.65 | 74 s | −0.14 | 0.11 | 99.2% | same |
| 0.8  | 75 s | +0.47 | 0.51 | 97.6% | "would likely resolve at depth 48 (projected SE ~0.13 vs ~0.15 needed; heuristic)" |
| 1.0  | 74 s | +0.45 | 0.53 | 97.2% | same |

Notable: for tightly-paired candidates (≥97% identical compiles) the paired
SE collapses far below the certified worst-case envelope (1.28), so the
advice line correctly reports that even sub-point effects are resolvable at
depth 48. The certified +5 MDE is the envelope guarantee for
broadly-perturbing candidates, not a floor on what tight pairing can
resolve.

## V2 — futility on a known regression

Validated end-to-end in the retained smoke (`scripts/benchmark/smoke_eval.ts`,
scratch state): a candidate snapshotted with `LR_QUALITY_NCAND=1` declared
improve-t0-d48, ran two waves (504 compiles), and stopped at the first look
— k=2, delta −131.1, UB95 −120.7 < 0 — exit 4 in 173 s versus ~50 min for a
full run. The spend stayed charged; the durable stop re-reported in 4 s on
`--resume`. Roughly 96% of the attempt's compute was saved by the certified
early stop.

## V3 — real improvement attempt (the instrument caught a phantom)

The V1 sweep surfaced `LR_IMPACT_LOCAL_W` 0.8/1.0 both screening at ~+0.46.
The default was baked into `core/candidate.ts` (0.5 → 0.8, a real
`candidateFingerprint` change — accepted baselines never encode environment
overrides), stage-0 confirmed byte-identical to the env screen (+0.47), and
declared at improve-t0-d48.

**The fresh paired epoch immediately told a different story than the probe:**

```
attempt 1 (f99e71f1): look k=2: delta -0.10 SE 0.02 UB95 +0.01  -> continue (barely)
                      look k=3: delta -0.07 SE 0.04 UB95 +0.03  -> continue
                      look k=4: delta -0.05 SE 0.03 UB95 +0.02  -> continue
attempt 2 (f77fe7f3): look k=2: delta -0.05 SE 0.07 UB95 +0.36  -> continue
                      look k=3: delta +0.01 SE 0.07 UB95 +0.22  -> continue
                      look k=4: delta -0.00 SE 0.05 UB95 +0.12  -> continue
```

The +0.46 was probe-draw noise on the 3 fixed screening seeds — exactly the
failure mode the fresh-epoch design exists to catch, observed live on the
chain's first real candidate. (Verdict recorded below.)

**Attempt 1 (f99e71f1)** was aborted by the V5 lock-refusal defect (below).
**Attempt 2 (f77fe7f3, --acknowledge-retry, compound α printed 0.0199)** ran
all 12,096 compiles and then crashed in final assembly: **`RangeError:
Invalid string length`** — a depth-48 archive is ~640 MB pretty-printed,
past V8's ~536 MB string cap. The failure machinery held: the wave counted
as failed, the attempt honestly aborted (failures never became verdicts),
both spends stayed charged, and every compile survived in the checkpoints.

**Fix (same session)**: archive assembly now streams chunked JSON — skeleton
pretty-printed, each run row one compact line (~380 MB at depth 48, measured
378 MB on the next real attempt) — with incremental SHA-256 and streamed
gzip, removing the write-side cap at any depth. Runner-compat approval
fp₀→c703ab4f (252/252 bit-identical, the replay archive itself written by
the new path); protocol migration #5. The read side stays a single-string
parse with ~30% headroom at depth 48; a streaming reader is recorded v2
debt for depth 64+.

**Honest close for the candidate**: an informational depth-48 readout from
the completed checkpoints (labeled non-binding — computed outside the
retained-archive path) gave **delta −0.05, one-sided bounds [−0.55, +0.45],
outcome inconclusive**. The 0.8 default was reverted with a source note so
the phantom is not rediscovered. Budget state recorded after V3: spent 0.0314
of 0.05, both attempts on the permanent ledger. This is historical pre-fix
accounting: those attempts used the menu-only 0.0157 charge. The current guard
charges the cross-artifact worst-case 0.0196 per improvement attempt; the
historical declaration events remain immutable, and an append-only
`accounting-correction` event records the corrected charges.

The two aborted attempts each cost ~45 min of compute and 0.0157 of budget
to infrastructure defects rather than statistics. That is what a first live
validation is for; both defects are now fixed, ledgered, and covered.

## V4 — real ablation

Candidate: delete the `LR_RANK_QUALITY=off` study-only escape hatch
(`POOL_MODE` hard-coded to `true` in `core/candidate.ts`; the quality-
objective pool sort has been the sole production path since its promotion).
Stage 0 screened the removal **bit-identical** (delta +0.00, 100% identical
pairs — a true dead-code ablation). Declared simplify m=5 at depth 48 via
the V7 driver (attempt d7b3f327):

- The declare first hit **real era-budget exhaustion** (0.0314 + 0.0196 >
  0.05) and proceeded only after a ledgered `--override-era-budget=0.08`.
- No interim looks (the simplify row is verdict-only in v1); one full
  depth-48 paired run; both 378 MB archives assembled by the new streaming
  writer and retained with checksums.
- **Verdict: ACCEPT, exit 0** (delta 0, non-inferiority bound −5 cleared
  with certainty); margin semantics rendered correctly in the report.
- Qualification sidecar ran on accept (monitor 383.05, indicative).
- `rebaseline` (executed verbatim from nextCommand) made the accepted
  attempt the era record: baseline of record
  `accept-2026-07-11T22-38-42Z-d7b3f327`, canonical headline 449.83 at
  depth 48, fresh 252-compile probe reference 446.09, **era budget reset**
  (cap 0.05, spent 0). The cumulative expected-false-accept total was 0.051
  at validation time and is now 0.0588 after the append-only accounting
  correction.

Footprint note: retaining the depth-48 era record costs ~200 MB of
compressed archives per accepted baseline (vs ~35 MB at the legacy depth
8). Accepted as designed for v1; archive retention policy is a v2 review
item.

## V5 — crash/resume drill

Attempt f99e71f1 was killed mid-k=8-wave (baseline arm at 657/1008
checkpoint rows). Findings:

1. **Checkpoint integrity: PASS.** Every completed compile survived the
   kill; the resumed invocation restored all rows and compiled only the
   missing ones. No re-declaration; the declaration and certification
   fingerprints revalidated on resume.
2. **Collision guard: PASS (and load-bearing).** The kill orphaned the
   wave's runner child, which kept draining. The resume's first wave was
   refused by the exclusive run lock — preventing two runners from
   interleaving one checkpoint. Exactly the failure the lock exists for.
3. **v1 DEFECT FOUND: lock refusal treated as wave failure.** `runWave`'s
   one-retry-then-abort counted the (transient) lock refusal as a
   persistent worker failure and honestly aborted the attempt — the abort
   machinery worked (failures never became verdicts; spend stayed charged;
   ledger consistent), but the attempt was burned unnecessarily. **Fixed**
   the same hour: `runWave` now waits for a live lock holder to drain
   (bounded, 15 min) before invoking; ledgered as protocol migration
   2026-07-11T21-35-32Z-e605c625. The fix is why attempt 2 exists.
4. Residual (documented, accepted for v1): a hard crash leaks the
   snapshot-workspace directories in `$TMPDIR` until the OS cleans them;
   `git worktree prune` on resume clears the git-side registrations.

## V6 — governance drills

| Drill | Result |
|---|---|
| Retry without acknowledgment | refused, exit 1: the retry compounds nominal alpha to 0.0199; certified spend is accounted separately |
| Uncertified operating point (`--depth=32`) | refused, exit 1: "not on the certified menu; certified rows: improve-t0-d48 (improvement, depth 48), simplify-m5-d48 (simplification m=5, depth 48)" |
| Budget exhaustion (historical scratch policy, 3×0.0157 on cap 0.05) | fourth declare refused with the numbers and the `--override-era-budget` command named; the corrected 0.0196 charge now permits two attempts under the default cap |
| Override below current cap | refused (must exceed) — and after a valid override to 0.08 the declare passes while cumulative expected-false-accepts keeps the pre-override history |
| Decision-surface edit without migration | every verdict path refused with "run `benchmark migrate --scope=protocol`" until the migration landed (observed twice for real: after the P5 edits and after the V5 fix) |

Bootstrap correctness: the first real `--to-verdict` initialized the
attempts ledger from the legacy confirmation state, importing its seed
ledger so no epoch can be double-allocated across the two systems; every
eval epoch is also appended back into the legacy ledger.

## V7 — agent operability

`scripts/benchmark/v7_agent_drive.ts` drove the entire V4 confirmation with
no human parsing: stage 0 via `--json` (read delta and pairing from the
payload), declare via exit codes, reacted to the exhaustion refusal (exit 1)
by issuing the ledgered override and retrying once, classified the verdict
purely by the per-mode exit-code contract (0 accept), extracted
`nextCommand` from the JSON artifact and executed it **verbatim**
(`npm run benchmark -- rebaseline --label=accept-<attemptId>` — the accept
nextCommand was made concretely runnable during validation, migration #5),
which completed the rebaseline and closed the chain. Total: one driver
invocation, zero prose parsed. The post-validation hardening pass made this
contract literal: stdout is now one JSON value, diagnostics use stderr, and
the driver calls `JSON.parse(stdout)` without substring extraction.

## Friction log

1. **Compat-record ordering** (found by the smoke): a runner-implementation
   edit blocks even stage-0 comparisons until its bit-identity approval is
   recorded — the fp₀ probe replay must run before any comparison. Cost: one
   confused smoke run. Not a defect (the gate is correct); documented in
   HOW_TO_WORK.
2. **Migration-before-verdict ordering**: protocol edits refuse verdicts
   until `migrate` re-stamps — correct but initially surprising mid-development.
   The scratch-state smoke now stamps its own copy to decouple validation
   from migration timing.
3. **Lock refusal vs wave failure** (V5 defect, fixed): see above.
4. **Stage-0 probe optimism**: a +0.46 screen on 3 fixed seeds did not
   survive two independent fresh epochs. Working conclusion for operators:
   treat sub-point stage-0 deltas on tightly-paired candidates as
   *resolvable but unconfirmed*; the projection line already says which
   depth resolves them, and the confirmation is what settles it.
5. **Aborted attempts consume budget** (design, not defect): attempt 1's
   charge stayed after the infrastructure abort and was later corrected from
   0.0157 to 0.0196 by an append-only event. Conservative and simple; if
   aborts-without-evidence turn out to be common, a future refinement could
   refund infrastructure-only aborts under a ledgered rule.

## Wall-clocks measured (48 workers)

| Operation | Wall |
|---|---:|
| stage 0 (252 compiles + integrity screen) | 74–75 s |
| wave (126 compiles/arm) + look | ~90 s |
| futility stop at k=2 (two-arm, incl. 2 workspace setups) | 173 s |
| durable-futility resume | 4 s |
| full depth-48 two-arm confirmation (incl. workspaces, verdict, qualification) | ~55 min |
| light rebaseline (fresh probe + freeze + era start) | ~4 min |
| runner-compat replay (252 compiles, workspace) | ~4 min |
| protocol/inference migration (conformance suite + fixtures) | ~45 s |
