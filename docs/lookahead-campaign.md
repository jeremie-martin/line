# The forward-eval lookahead — campaign

## Goal

Improve the compiler by improving the **forward-eval lookahead** — the greedy:2
rollout that ranks candidate arcs, and the **leaf** that scores its terminus.
We are *not* matching any old behavior here (that was the short-leaf campaign,
now done). We want the headline number to go **up**. Readiness is the first
lever, but the scope is the whole lookahead/rollout/leaf.

## What readiness is

`optimizer/readiness.ts` — an empirical catchability surface `r(speed, comAngle)
∈ [0,1]`: from a predicted arrival state, what fraction of production catches pass
the hard gates? `objective.ts` wraps it into a **per-gap** score,
`scoreNextGapReadiness = catchability × speedFit × impactFeasibility`. Readiness
answers, *without simulating the next gap*: **given the state the rider arrives in,
is the next gap set up for success?** It is about the gap that comes *after* the
gap being placed — any implementation has to respect that.

## Where it's used today vs. not

- **Pool ranking / proposer (`aim.ts`)** — per gap: `scoreGapObjective(gap, axes,
  arrival, nextGap) = thisGapQuality × nextGapReadiness`. One gap, one readiness term.
- **Forward-eval leaf (`handoff.ts objectiveLeafValue`)** — scores the **whole
  greedy:2 branch** as one combined-RMS-axis × survival × missing. **No readiness.**

So there is an asymmetry: the leaf aggregates the *whole branch* into one score and
ignores readiness; everywhere else readiness is a *per-gap* signal. Closing or
exploiting that gap is the campaign.

## The harness

`scripts/v0/eval_readiness_leaf.sh` (frozen-snapshot mode, copy of
`eval_template.sh`): 11 specs × budgets {150k, 300k} × 8 seeds. The frozen baseline
is the current default leaf; each edit is one `./scripts/v0/eval_readiness_leaf.sh
run` against it, then `decide` + per-track/per-axis summary. The number it prints is
the campaign's measure of record (probe tier — a canonical run promotes).

## Open questions / levers

- **Per-gap vs whole-branch.** Replace the one whole-branch leaf score with a
  per-gap objective (thisGapQuality × nextReadiness) computed for each gap in the
  branch, then **combined** — mean? product? worst-gap? — and compare.
- **Does the *same* readiness make sense here?** It was fit/used for single-gap pool
  ranking; the leaf is a different context (deeper, post-rollout). Re-examine.
- **How readiness enters the score.** The blunt multiply is wrong (see log); it must
  inform ranking without being able to override survival/missing.
- **Telemetry.** Add what we need to answer the above as questions come up; little is
  needed yet.

## Companion

`docs/lookahead-log.md` — terse running log of every attempt (hypothesis · change ·
result · verdict).
