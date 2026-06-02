# Goal - budget-curve handoff compiler

This file keeps its historical name because past work links here. The active
compiler is `compileHandoff` in `scripts/v0/optimizer/handoff.ts`.

For the current extended-budget plateau campaign, see
`GOAL_LDS_PLATEAU_BREAKOUT.md`. That document defines the 10-spec `150k`
diagnostic loop used to study whether the optimizer can convert substantially
more compute into better tracks without turning prefix branching into a messy
wrapper layer.

## Campaign Metric

Use this command as the run of record:

```bash
npm run golden -- --jobs=60 --compiler=handoff
```

`npm run golden` evaluates the default budget grid:

```text
35000,40000,45000,50000,55000,60000,65000,70000,75000
```

The headline metric is `CURVE_SCORE`: the shifted geometric mean of the suite
score at each budget checkpoint. A targeted probe should still use that standard
budget grid:

```bash
npm run golden -- --specs=tiny_dance,opening_burst,drums_breath --seed=0 --verify-checkpoints --jobs=20
```

Use `CURVE_SCORE` as the campaign headline, not as a blind scalar. The curve
metric is meant to reward improvements that arrive earlier, preserve later
checkpoints, and avoid one-budget overfitting. The budget grid is therefore part
of the benchmark definition: changing `35k..75k` changes what the optimizer is
being asked to do. When judging a change, inspect the per-budget table too:
budget regressions, max-budget validity, and worst rows remain guardrails even
when the aggregate score rises.

Every golden run archives `golden.json` plus checkpoint track/report artifacts
under `generated/golden-runs/<run>/`, which is gitignored through `generated/`.
The JSON records the git commit and dirty state for commit-to-commit comparison.

Current seed-0 evidence after the guarded preview-cost ranking change:

- base `CURVE_SCORE 343.15`, valid `180/180`;
- report-only variants `VARIANT_CURVE_SCORE 246.43`, valid `330/360`.

Use this as a local comparison point, not a permanent target. Re-run the command
of record after each broad policy change.

## What To Optimize

The compiler turns a `Spec` into Line Rider `Track` checkpoints whose simulated
rider lands on authored contacts and expresses per-axis target curves (`air`,
`speed`, `grain`, and `contact_style`).

Two outcomes matter together:

- **Contract progress:** no drifted contacts, no missing contacts, no off-beat
  landings, and survival to end-of-spec.
- **Quality progress:** among contract-passing outputs, higher axis/contact
  quality matters, graded per gap against the curve value there.

The scorer and golden specs are the ruler. Do not move or edit them to improve
the number.

## Handoff Architecture

The search state is a partial prefix at a gap boundary. Each expansion commits
one candidate catch or skips a non-contact gap, then the register scores the
best complete-or-partial output seen so far.

Budget is measured in simulated rider frames and acts only as a checkpoint/stop
condition. Candidate policy must not read budget. A single run walks a
deterministic node sequence and snapshots the strict best-so-far register at
each requested budget. More budget can hold or improve the returned register key,
but must not regress it.

Important diagnostics:

- `sim_frames`
- `leaves_considered`
- `search_nodes_expanded`
- `frontier_max_size`
- `handoff_frontier_size`
- `handoff_pass_frontier_size`
- `handoff_fallback_frontier_size`
- `handoff_frontier_min_gap`
- `handoff_frontier_max_gap`
- `handoff_deepest_seen_gap`
- `handoff_frontier_oldest_gap_lag`
- `handoff_frontier_mean_gap_lag`
- `handoff_frontier_far_back_count`
- `handoff_far_back_pulses`
- `handoff_partial_evaluations`
- `handoff_full_evaluations`
- `handoff_previews`
- `handoff_preview_contacts`
- `handoff_preview_survivors`
- `handoff_rescue_attempts`
- `handoff_rescue_successes`
- `handoff_skips`
- `handoff_tail_completion_attempts`
- `handoff_tail_completion_successes`
- `handoff_start_ranks_seen`
- `handoff_start_ranks_with_fits`

## Working Loop

1. Make one explainable compiler change.
2. Probe targeted rows first with `--specs`, `--seed`, and `--details`, leaving
   the standard budget grid in place.
3. Use `--verify-checkpoints` on small probes after changes to budget handling.
4. Run the default curve command before trusting a broad change.
5. Run `npx vitest run tests/optimizer_handoff.test.ts` after changes to search,
   candidate ordering, budget handling, or the register.
6. Check variants before declaring a broad win:

```bash
npm run golden -- --variants --compiler=handoff
```

For plateau work, keep the inner loop small enough to iterate quickly. A useful
starting set is:

```bash
npm run golden -- --specs=drums_swell,drums_crescendo,dense_sprint,opening_burst,rhythm_ladder --compiler=handoff --jobs=12 --details
```

This is not an acceptance gate and must not become a target to overfit. It is a
diagnostic slice for rows that expose early plateaus, contact-style extremes,
speed creep, and far-back repair behavior. Once a change moves that slice, rerun
the full suite and variants before trusting it.

The plateau loop should be family-based rather than spec-name-based. Use small
representative slices to iterate quickly, but keep them as diagnostics:

```bash
# low-air / groundedness pressure
npm run golden -- --specs=drums_pendulum,cold_start --compiler=handoff --jobs=6 --details

# speed creep and braking pressure
npm run golden -- --specs=drums_swell,verse_chorus,dense_sprint,drums_crosscut --compiler=handoff --jobs=12 --details

# contact-style extremes and discrete contact-duration choices
npm run golden -- --specs=drums_crescendo,rhythm_ladder,syncopated_switchback,drums_signature --compiler=handoff --jobs=12 --details

# contract/start/far-back repair behavior
npm run golden -- --specs=solo_run,opening_burst,drums_pulse,tiny_dance --compiler=handoff --jobs=12 --details
```

Do not optimize directly against these slices. They are a cheap way to reject
bad ideas and understand which plateau family moved before paying for the full
suite.

## Current Frontier

The useful question is no longer "what wins at one budget?" It is the curve
shape:

- rows invalid across the grid are search-bound;
- rows that improve late are budget-bound;
- rows that plateau early are not converting extra budget into better tracks;
- rows that regress violate the budget-search contract and must be fixed before
  optimizing further.

Budget adaptation should stay progressive and empirical. Prefer one small
spec/search-state signal at a time, such as median contact cadence or whether a
contract-passing output already exists, before making the compiler broadly
budget-aware. The goal is an adaptive compiler, but the checkpoint contract still
requires one deterministic policy sequence whose candidate choices do not read
the requested budgets.

The "branch from far back" idea should start as diagnosis, not as policy. A large
`handoff_frontier_oldest_gap_lag` at late checkpoints means the compiler has seen
deeper prefixes while older alternatives remain available; if those rows plateau,
frontier scheduling or explicit ancestor repair may be worth testing. Check
`handoff_frontier_mean_gap_lag` and `handoff_frontier_far_back_count` as well so
one deferred start root does not masquerade as a broad backlog. A small lag or
empty frontier points more toward local candidate generation, ranking, or suffix
quality than retro-branching.

The first accepted far-back policy is intentionally narrow: after a
contract-passing output exists but `axis_quality` is still below `0.24`, every
16 completed frontier selections may pull the oldest lagged pass-frontier
branch. This is not budget-aware candidate logic; it is deterministic repair
scheduling keyed by search state. Full golden evidence moved `CURVE_SCORE
315.05 -> 317.19` with the same `533/540` valid checkpoints. The common-row
budget deltas were flat through 55k, then positive from 60k onward, with the
largest win coming from moving `opening_burst seed=2`'s better branch into the
65k+ window. The narrower gate kept the only non-zero 75k regression to
`drums_pendulum seed=1 -1.25`. Report-only variants kept the same `1020/1080`
valid checkpoints and no timeouts, but `VARIANT_CURVE_SCORE` dipped slightly
from `247.21` to `246.84`; treat this as a guardrail to revisit, not as part of
the headline acceptance metric.

The next accepted budget-curve win is quality-phase preview deferral. Future
contact previews remain enabled while the compiler is still trying to find a
contract-passing output, but after a passing incumbent exists, normal expansion
and rescue ranking stop spending metered frames on one-contact preview rollouts.
Those frames instead expand and score actual branch alternatives. Full golden
evidence moved `CURVE_SCORE 317.19 -> 319.45` with the same `533/540` valid
checkpoints and positive common-row deltas at every budget. Variants also moved
`VARIANT_CURVE_SCORE 246.84 -> 248.29` with the same `1020/1080` valid
checkpoints and no timeouts. The largest 75k headline regressions were bounded
(`drums_signature seed=0 -3.74`, `verse_chorus seed=2 -3.29`,
`drums_zigzag seed=1 -2.90`) against larger generic wins such as
`cold_start seed=1 +48.29` and `opening_burst seed=2 +43.11`.

High-speed start ordering is the current confirmed budget-curve win. Reusing the
handoff speed/air overshoot penalty only for high-speed first-axis starts moved
the full golden curve from `306.72` to `315.05` (`533/540` valid checkpoints),
with the 35k checkpoint improving from `202.89` to `224.75`. The variants probe
remained monotone with `VARIANT_CURVE_SCORE 247.21` (`1020/1080` valid). This is
a useful example of progressive adaptation: the policy is keyed by spec/search
state, not by requested budget.

Recent plateau probes rejected more work as a cure-all. Increasing severe
overspeed brake samples in quality search, limiting that widening to near-tail
states, widening the quality candidate scoring pool, and forcing candidate axis
measurement to the current gap end all underperformed the current archive on the
plateau subset. Future work should either change the geometry primitive or use
stronger row diagnostics before spending more speculative local work.

Focused plateau probes also rejected a few tempting generic changes: widening
quality-phase catch reuse from two prior catches delayed existing wins under the
curve metric, counting far-back pulses from quality-phase selection instead of
the global frontier phase delayed the `opening_burst seed=2` repair past 65k,
and naive contact-style ride-out continuations damaged contract progress. These
failures are useful evidence: the plateau is not just "spend more"; extra work
must be targeted enough to preserve the anytime curve.

Start-state diversity needs the same treatment. Multi-start specs can show many
`handoff_start_ranks_seen` but only one `handoff_start_ranks_with_fits`, meaning
alternate starts were visited as root partials but not expanded into real catch
prefixes before budget ran out. Naive breadth scheduling and first-contact
start-layer deferral both hurt the curve in targeted probes, so future start
work should be more selective than "expand every start earlier."

## Portfolio / Restart Search Idea

The plateau evidence makes a portfolio search worth serious consideration. The
basic idea is to spend extra compute on multiple deterministic attempts and keep
the best result in the same strict register, instead of asking one local search
schedule to discover every qualitatively different track. This could range from
very simple independent runs with different seeded sample streams to more
targeted restarts from saved prefixes.

This is compatible with the benchmark only if the portfolio schedule itself is
deterministic and budget-prefix compatible. A 75k checkpoint must be the same
portfolio sequence continued past the 35k checkpoint, not a different policy
chosen because the requested budget is larger. Budget may stop the schedule; it
must not choose different candidate rules for a checkpoint.

Existing machinery already has partial versions of this idea:

- deterministic start alternatives (`handoff_start_options`);
- DFS frontier branches and a pass/fallback split;
- sparse far-back pulses when a poor passing incumbent leaves old alternatives;
- dead-end rescue widening;
- near-tail completion;
- catch reuse and brake candidates as extra local alternatives.

What does not exist yet is a true portfolio controller: no top-level racing of
independent runs, no fixed allocation across run variants, and no explicit
"perturb this promising prefix and re-search downstream" operation.

Possible implementation levels, from least invasive to most flexible:

- **Whole-run portfolio:** run `compileHandoff` several times with deterministic
  seed offsets or policy profiles, interleave fixed work quanta, and feed all
  outputs to one register. This is the easiest proof of concept, but repeats
  the early track and may be expensive on specs where the prefix is already
  good. Do not naively change the public compile seed for this: today that seed
  also samples per-gap target jitter. A portfolio needs a separate search-lane
  stream or deterministic lane offsets after targets are resolved.
- **Start/root portfolio:** expand more start roots only when diagnostics show
  poor start coverage, but schedule them as a deterministic work queue rather
  than broadening every spec.
- **Prefix restart portfolio:** snapshot promising prefixes, perturb candidate
  sample streams or geometry knobs from that point, and search the suffix. This
  is closer to the "branch from the middle" idea and should be cheaper than
  rerunning from frame zero, but it needs careful state/caching design.
- **Plateau-triggered diversification:** when a passing incumbent has not
  improved after a deterministic amount of work and frontier diagnostics show
  many viable alternatives, allocate a small fixed pulse to restarts or older
  ancestors. The trigger must depend on search state, not requested budget.

Before implementation, characterize it empirically. Useful first probes are
offline wrappers that run multiple existing seeds/policy variants on a few
plateau slices, compute the oracle best-per-row curve, and estimate how much
headroom a real interleaved portfolio could capture. If the oracle gain is small,
the plateau is more likely candidate geometry/scoring than exploration. If the
oracle gain is large, implement the smallest deterministic portfolio that can
capture part of it and then run the budget-contract tests.

The first diagnostic tool for this is:

```bash
npx tsx scripts/v0/portfolio_oracle.ts \
  --specs=drums_pendulum,drums_swell,drums_crescendo,opening_burst \
  --seed=0 --lanes=0,1,2,3 \
  --json-out=generated/golden-runs/portfolio-oracle.json
```

It uses `compileHandoff(..., { searchSeed })` so the public seed still fixes the
row's target jitter while each lane changes only search sampling/start
lookahead. Treat the full-lane oracle as an optimistic upper bound because it
spends one full checkpoint budget per lane. The equal-slice oracle is closer to
a same-total-budget portfolio, but still only a diagnostic proxy for a real
interleaved scheduler.

Early oracle evidence is mixed, which is useful. Two-lane probes on
`drums_pendulum seed=0` and `drums_swell seed=0` found no full-lane headroom, so
those plateaus are unlikely to be fixed by simply changing the root sample
stream. A four-lane probe on `drums_crescendo seed=0` did find a better lane at
75k (`265.47 -> 285.59`), while `opening_burst seed=0` was best on lane 0. In
the same run, equal-slice was much worse because each lane was too starved to
reach useful complete tracks. That argues against a naive same-total-budget
whole-run portfolio from frame zero; if portfolio work continues, prioritize
post-pass/prefix-level diversification or diagnosing what the winning lane does
differently on contact-style rows.

The next diagnostic tool is `scripts/v0/prefix_branch_oracle.ts`. It runs one
normal baseline, snapshots clean main-search prefixes near requested track
fractions, then resumes those prefixes with alternate downstream search-lane
seeds:

```bash
npx tsx scripts/v0/prefix_branch_oracle.ts \
  --specs=drums_crescendo --seed=0 --lanes=1,2,3 \
  --fractions=0.25,0.5,0.75 \
  --json-out=generated/golden-runs/prefix-branch-crescendo-seed0.json
```

This is still oracle/probe work. Prefix snapshots rebuild a clean engine and
clear candidate/child caches before resuming, so a downstream lane actually
resamples from that point instead of inheriting stale candidates. The JSON
records prefix simulated frames, suffix budget, suffix simulated frames, and
estimated total frames for every branch candidate. Treat any branch-oracle gain
as evidence about where restart headroom exists, not as a production budget
scheduler.

A small no-polish smoke probe on `drums_crescendo seed=0` with one downstream
lane found real mid-prefix headroom: branching from the 25% prefix improved the
35k/75k checkpoint score from `262.39` to `268.46`. The selected branch used
about `35.2k` estimated total frames at the 35k checkpoint and `69.4k` at 75k;
the whole diagnostic run spent `173k` frames because it also ran the baseline
and an extra 50% branch. This is not a fair scheduler result, but it is evidence
that at least one contact-style plateau has useful downstream restart headroom.

Larger seed-0 probes make the mechanism more credible without making the exact
row identities sacred. A no-polish full-suite lane-1 prefix-branch oracle moved
the 20-row curve from `256.75` to `266.21` (`+9.47`) with the same `19/20`
passing rows at every checkpoint. All 12 material wins were positive at every
budget. Re-running those 12 rows with polish preserved the wins and moved their
curve from `312.69` to `332.01` (`+19.32`), so polish does not appear to erase
the prefix-branch signal.

Lane sensitivity is also real, but should be treated as search-dynamics evidence
rather than spec astrology. Sweeping lanes 2-4 on the previous non-winners found
additional oracle headroom, including one contract rescue and three smaller
quality wins; the four new winners also survived a polish-on rerun. The broader
lesson is not that any fixed fraction, lane, or named spec is special. It is
that the deterministic handoff schedule can over-commit to a locally acceptable
prefix, while a later suffix resampling from the same prefix can enter a better
downstream basin.

The first scheduler approximation is `scripts/v0/prefix_branch_scheduler_probe.ts`.
It consumes a prefix-branch oracle JSON, reruns the selected prefix, and measures
two cheaper policies:

- `replace`: spend only the original remaining suffix budget and return that
  branch directly;
- `extra`: keep the normal baseline as fallback, spend a capped extra suffix
  budget, and accept the branch only through the existing score comparator.

This probe reinforces the safety rule. On the 11 selected full-suite lane-1 rows
with `branchMaxNodes=30`, `replace` collapsed the selected-row curve
`310.05 -> 40.06`. The fallback `extra` policy recovered useful signal:
`+8.50` selected-row curve at `20%` nominal overhead and `+10.58` at `60%`.
Projected back onto all 20 seed-0 rows by leaving unselected rows at baseline,
that is roughly `+3.85` to `+4.78` curve against the `+9.47` oracle. The measured
75k work ratio was about `1.28x` to `1.31x` because the shallow branch cap often
stopped before consuming the nominal overhead.

The same shallow scheduler did not recover most lane-sensitive non-winner
headroom: it kept the baseline on the largest rescue and only captured the
smallest robust quality win. That is an important negative result. The next
production-shaped probe should not blindly add more branches everywhere; it
should test how much of the oracle can be recovered with one deterministic
fallback branch, better branch-point selection, and a small node cap before
moving to broader policy.

The first production prefix-branch step is intentionally small. `HandoffNode`
now carries a downstream search-lane seed, and once a passing, non-low-quality
incumbent exists the normal frontier loop occasionally clones a clean
baseline-lane prefix into one alternate downstream lane. The clone is ordinary
frontier work: caches are rebuilt for the new lane, budgets still only snapshot
the single deterministic sequence, and the strict register remains the only
selector. The low-quality gate matters because branch work otherwise competes
with the existing far-back repair regime and can delay the repair that produces
a usable incumbent. With that gate, full golden moved
`CURVE_SCORE 319.45 -> 319.64` with the same `533/540` valid checkpoints.
Report-only variants stayed effectively flat (`248.29 -> 248.23`, same
`1020/1080` valid). Treat this as proof that production suffix diversification
can fit the compiler contract, not as the final scheduler. The next improvement
should recover more oracle headroom with better branch timing or selection,
while avoiding broad branch fanout and spec-specific rules.

The first branch-scheduler tuning pass supports a simple lesson: branch cadence
matters more than clever branch-point predicates, at least so far. A diagnostic
slice rejected making the branch second-priority after the best baseline child,
because useful suffix branches need early stack priority. It also rejected
forking only when a prefix's near-tail completion first improves the passing
incumbent; that spends the single branch too early on a merely viable prefix.
Cadence sweeps on the same branch-heavy slice were `16=305.61`, `8=305.97`,
`6=305.51`, `4=306.43`, and `2=305.60`, showing a useful middle zone between
"too sparse" and "branch almost every time." Moving the production cadence from
16 to 4 full-suite frontier selections recovered more oracle headroom without
changing the compiler contract: full golden moved `CURVE_SCORE 319.64 -> 320.14`
with the same `533/540` valid checkpoints. Report-only variants moved
`248.23 -> 248.29`, same `1020/1080` valid. This remains a blunt scheduler
knob, not the final branching policy; future work should look for a similarly
general branch-readiness signal that improves on cadence without spending the
branch on the first merely passing prefix.

The accepted follow-up is a two-tier far-back repair cadence. The severe
low-quality path is unchanged: passing incumbents below `0.24` axis quality
still pulse the oldest lagged pass-frontier branch every 16 frontier selections.
Incumbents in the moderate band below `0.28` now get the same kind of repair
only every 64 selections. This deliberately avoids the rejected blunt `0.28`
policy: prefix branching keeps its old `0.24` quality floor, so the moderate
repair signal can coexist with suffix diversification instead of postponing it.
Full golden moved `CURVE_SCORE 320.14 -> 321.42` with the same `533/540` valid
checkpoints. Budget-score deltas were slightly negative through 55k
(`35k -0.07`, `40k -0.22`, `50k -0.08`, `55k -0.09`), then positive from 60k
onward (`60k +0.36`, `65k +2.48`, `70k +4.99`, `75k +5.20`). Far-back pulses
at the final checkpoint rose from `23` to `48`. The largest 75k wins were
`drums_swell seed=0 +161.73`, `drums_crescendo seed=0 +58.63`, and
`verse_chorus seed=2 +48.81`; the largest 75k regressions were bounded
(`dense_sprint seed=0 -6.19`, `drums_pendulum seed=0 -4.96`). Report-only
variants also improved, `VARIANT_CURVE_SCORE 248.29 -> 249.54`, with the same
`1020/1080` valid checkpoints. The broader lesson is modest but useful:
late-curve plateaus sometimes need a small amount of ancestor repair even after
the incumbent is no longer awful, but the evidence still favors a sparse,
state-keyed scheduler over broad branch fanout or spec-specific rules.

Branch conversion diagnostics then produced one small accepted pruning rule and
one useful rejection. A conservative high-quality ceiling stops spawning new
prefix branches once the passing incumbent reaches `0.50` axis quality. This
does not make branching budget-aware; it treats alternate-lane suffix search as
an escape/diversification tool rather than a polish mechanism for rows that are
already very strong. Full golden moved `CURVE_SCORE 321.42 -> 321.52` with the
same `533/540` valid checkpoints. Headline branch full evaluations at 75k
dropped `4641 -> 4036`, with branch forks `90 -> 81` and only two non-zero 75k
row score changes (`drums_tide seed=2 +1.45`, `drums_breath seed=0 -1.54`).
Report-only variants stayed effectively flat-positive,
`VARIANT_CURVE_SCORE 249.54 -> 249.55`, with the same `1020/1080` valid
checkpoints. The rejected counterpart was unlocking low-quality prefix branches
after eight severe far-back pulses. On the plateau/branch diagnostic slice it
moved `CURVE_SCORE 282.23 -> 282.12`, did not improve the intended
`drums_pendulum seed=1` plateau, and regressed `opening_burst seed=2` at 75k by
`-14.83`. Keep the `0.24` branch floor; repeated far-back repair pulses alone
are not a good readiness signal.

A second conversion gate was also rejected as ineffective. Stopping future
prefix forks after `64` alternate-lane full evaluations with zero branch
improvements looked like a direct way to save wasted branch work, but on the
branch-conversion diagnostic slice it was a no-op: `CURVE_SCORE 302.66 ->
302.66` with identical branch fork/full/improvement counters. The cost is mostly
inside already-spawned alternate-lane subtrees, not in later forks, so future
branch-efficiency work needs either subtree scheduling or better pre-fork
readiness, not a global "no conversion yet" fork stop.

The accepted subtree version is narrow and deterministic. Each spawned
alternate-lane prefix branch now carries its own branch key; if that subtree
produces `48` full-duration evaluations without any strict register improvement,
only that subtree is pruned. This is not a global branch kill switch and does
not prevent later baseline prefixes from forking their own downstream lane. Full
golden moved `CURVE_SCORE 321.61 -> 321.69` with the same `533/540` valid
checkpoints; every headline checkpoint delta was non-negative and 24 row-budget
cells improved. At 75k, branch full evaluations dropped `4020 -> 3323`, with
`72` prunes and branch improvements nearly unchanged (`72 -> 71`). Report-only
variants moved `VARIANT_CURVE_SCORE 249.65 -> 249.68` with the same `1020/1080`
valid checkpoints; there were five small variant checkpoint regressions, worst
`-0.60`, so keep treating this as a conservative work-reallocation rule rather
than a broad quality lever.

The next branch diagnostic should look at conversion, not just branch volume.
The compiler now reports `handoff_prefix_branch_evaluations`,
`handoff_prefix_branch_full_evaluations`, and
`handoff_prefix_branch_improvements` alongside fork count, subtree prune count,
and selected search lane. Use these counters to separate rows where
alternate-lane work is actually entering the register from rows where forks are
created but never become useful full-duration candidates. A future readiness
signal should improve that conversion rate with generic search-state features,
not by naming specs, lanes, or fixed branch fractions.

Follow-up scheduler probes reinforced that constraint. Deterministic lane
diversity with the same fork volume was noisy: hash-based lane choice helped
some early mixed-slice checkpoints but regressed the 75k guardrail, while
cycling lanes after lane 1 was net negative. Broadening late branch eligibility
from four remaining contacts to two or three increased fork volume and sometimes
conversion, but it also spent work on branch-resistant rows and damaged late
quality. Gating the later branch on an observed branch improvement avoided the
worst regressions but was effectively neutral. Narrowing alternate-lane subtree
branching to one or two options saved branch work, but it lost too many of the
existing suffix-branch wins. The broader lesson is that useful prefix branches
need both enough suffix breadth and a stronger branch-readiness signal; simple
global lane, timing, or width knobs are not the next likely win.

Two simple branch-readiness gates were also rejected on the branch-heavy
diagnostic slice. Requiring the last four committed contact choices to have a
low mean local candidate rank looked principled, but it starved useful suffix
branches: mean-rank gates of `<=1.0` and `<=2.0` moved the slice curve
`306.43 -> 304.88/305.00` with negative deltas at every budget. A short
plateau gate, branching only after four frontier selections without a register
improvement, was similarly negative (`306.43 -> 305.04`). This does not reject
readiness gating in general; it rejects local-rank and tiny no-improvement
windows as sufficiently broad signals. A better gate should be justified by
branch conversion diagnostics or oracle/scheduler replay, not by a plausible
story alone.

Two more structural branch/suffix probes were rejected. Allowing up to two
different rank-path signatures per `(startRank, gapIndex)` fork key tested
whether the current scheduler spends its single branch on the first prefix to
reach a depth. On the branch-heavy slice it was effectively neutral
(`CURVE_SCORE 306.43 -> 306.43`) and slightly worse at 75k, while adding more
forks; this is not enough evidence to broaden branch keying. Tail-completion
window changes were more informative. Narrowing the near-tail window from `6`
contacts to `5` looked superficially good on one mixed slice
(`265.16 -> 267.20`), but full golden rejected it (`320.14 -> 317.44`) with a
35k validity loss and negative common-row deltas at every budget. Widening to
`7` was worse on the exact mixed-slice curve (`265.16 -> 262.63`). Keep the
near-tail window at `6` until a scheduler can decide from stronger suffix-state
evidence; changing the global window is too blunt.

Tail completion is a real work sink, but simple high-quality gating is also too
blunt. A probe that stopped near-tail completion after a passing incumbent
reached `0.50` axis quality reduced tail attempts on a high-quality slice
(`1985 -> 1279`) and full evaluations (`3921 -> 3480`), but moved the slice
curve `406.27 -> 406.17` by losing early 35k quality. That reinforces the
anytime lesson: even when a row is already strong at 75k, suffix completion can
be part of how it becomes strong early. Do not gate tail work only on incumbent
quality.

Axis-level details should be read with signed errors, not only absolute worst
rows. `scripts/v0/analyze_golden_curve.ts` now prints achieved-minus-target
summaries by axis and target band when run on `--details` JSON. A low-air /
contact-style plus speed-family diagnostic pass showed broad mechanical biases:
low and mid `air` overshoot, `speed` often overshoots, high `grain` undershoots,
and `contact_style` is often an extreme 0-or-1 outcome rather than a smooth
middle value. A direct high-grain quality-search widening (`16 -> 18/20`
samples only on high-grain gaps) was rejected: it improved some early slice
checkpoints but regressed the late guardrail where high grain coexists with
contact-style pressure. Low-air ride-out probes were also rejected: allowing the
existing long ride-out path on low-air rows was a no-op on the diagnostic slice,
while forcing low-air scoring out to the next contact collapsed full outputs.
Future geometry work should treat low-air, grain, and contact-style coupling as
primitive/measurement problems, not just "sample more candidates" or "score a
longer continuation."

A contact-style segment-count primitive was rejected in its naive form.
Contact-style is measured as traversed contact distance divided by median line
length, so it was plausible to allocate some segment samples to
contact-style-directed line lengths. The contact-style-only version was a no-op
on the diagnostic slice because current golden contact-style rows also target
grain, whose segment count correctly took priority. The blended version kept
the normal `70%` grain-directed samples and used part of the remaining uniform
segment samples for contact-style-directed line length, but it collapsed the
same slice (`CURVE_SCORE 302.90 -> 251.19`) with early validity loss. The
mechanical lesson is clear: contact-style and grain are coupled, but segment
count is too central to grain/contract stability to retarget naively. Future
work should add contact-style diversity as extra candidates or a measured
post-candidate selector, not by stealing the base grain-directed segment path.

The first accepted contact-style follow-up is deliberately additive. During
quality search only, explicit `contact_style` gaps now get two extra
deterministic sample-stream candidates; contract search and the base sampler
remain unchanged. This is a small win, not a new main lever by itself. Full
golden moved `CURVE_SCORE 321.52 -> 321.61` with the same `533/540` valid
checkpoints. Budget deltas were mixed (`35k -0.11`, `40k -0.44`, `45k +0.64`,
`50k +0.82`, `55k +0.88`, `60k +0.17`, `65k -1.01`, `70k -0.12`, `75k +0.09`).
Report-only variants moved `VARIANT_CURVE_SCORE 249.55 -> 249.65` with the same
`1020/1080` valid checkpoints; their 75k delta was stronger (`+0.77`) but 65k
was still negative (`-0.54`). The diagnostic lesson is broader than the score:
contact-style rows do need more downstream candidate diversity, but even tiny
additive diversity can reshuffle basins in both directions, so future work
should keep using full-suite and variant guardrails.

Direct impact-anchor remapping was rejected. A strong contact-style remap
collapsed the low-air/contact-style diagnostic slice (`CURVE_SCORE 292.12 ->
247.41`) and a milder remap was worse (`292.12 -> 225.22`), both with early
validity loss. Do not move the base impact mapping without a stronger primitive
story; extra candidates are currently safer than retargeting the shared landing
geometry.

Simple scalar overshoot reweighting is also too fragile to be the next
production lever. Doubling the global air-overshoot ranking penalty (`16 -> 32`)
collapsed the low-air/contact-style diagnostic slice (`CURVE_SCORE 294.74 ->
222.38`) and lost early validity. A milder low-air-only boost (`24` for
targets `<=0.5`) kept validity but still moved the same slice `294.74 ->
290.25`, negative at every budget. A mild speed-overshoot boost (`16 -> 24`)
also failed on the speed-family slice (`326.20 -> 276.37`), with one hard row
dominating the loss despite isolated wins elsewhere. The broader lesson is that
the existing speed/air biases are useful, but further improvements probably need
better candidate primitives, candidate-set diversity, or state diagnostics,
not a stronger global scalar.

Polish is not currently the obvious budget sink. A default-vs-`--no-polish`
smoke on `tiny_dance,drums_crescendo` produced identical curves, row scores,
75k sim-frame counts, and zero changed polish variants. That does not prove
polish is useless suite-wide, but it argues against prioritizing polish gating
over search/candidate improvements without stronger evidence.

Promising levers:

- better handoff-state diagnostics and catchability scoring; speed/air work
  should be primitive- or state-aware, not just a larger overshoot scalar
- more selective future-contact previews if diagnostics show contract search
  needs them without reintroducing quality-phase preview waste
- reusable candidate patterns for periodic contact runs
- start-state search that improves the first few gaps without hidden prepasses
- polish variants that are cheap enough to be worth their metered frames
- cadence-aware speed-bleed / braking that holds a descending or flat speed curve
- frontier scheduling / ancestor repair when frontier-depth diagnostics show
  promising older alternatives left unexplored
- deterministic portfolio/restart search if offline oracle probes show real
  cross-run or cross-prefix headroom

Hard rules:

- no spec-name or seed-specific branches
- no wall-clock inputs
- no unseeded randomness
- no scorer or golden-spec edits for score
- no budget-dependent candidate policy
