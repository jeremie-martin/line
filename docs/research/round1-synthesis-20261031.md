# Round 1: what the proofs of concept and the look back taught us (2026-10-31)

This synthesis draws on four documents:
- poc-b-families-as-candidates-20261031.md and poc-c-section-fallback-20261031.md;
- how-we-worked-record-20261031.md, from the docs, commits and memory;
- how-we-worked-sessions-20261031.md, from the owner's own words in the session logs.

It is for discussion: nothing here is adopted.

## 1. The two proofs of concept

Both turn the 9-frame rule off. All runs use the same allowance and the same specs. The headline is the production grade, with failures counted as 0.

| arm | bench completion | bench headline | pairs8 headline | shaped share of ride time |
|---|---|---|---|---|
| before the rule | 38/41 | 661 | 619 | ~40% |
| **with the rule (HEAD)** | 41/41 | 716 | 739 | ~40% |
| **C: a dead end retries its own section with plain arcs** | 41/41 | **717** | **743** | ~40% |
| **B, λ 0.02: every section also builds plain arcs, with a weak prior for the plan** | 41/41 | **734** | **776** | **18%** |
| B, λ 0.08 | 41/41 | 699 | 731 | 34% |
| B, λ 0.32 | 41/41 | 677 | 705 | 39% |

**C** matches the rule with no rule at all.
- **Variety:** unchanged.
- **Quality:** flat to slightly worse on rulers other than v3; none of it is significant.
- **Guides:** in 7 sections it dropped a guide that the current compiler keeps by backtracking. A dead end does not say whether the request or the arrival is at fault.
- **Waste:** rejected candidates are 17.6% of all ride physics. Most of that is fulfilment-check rejections in *long* shaped sections (about 10% of the allowance), not short ones.

**B** also needs no rule, but it exposes something larger. With a weak preference for the plan, the search drops about half of all shapes, even in sections with ample room. Folds fall from 7.7% to 2.3% of ride time. The headline then *rises* (734 against 716), and body contact rises too (more body drag and contacted bends). With a strong preference, the plan is kept, but every ruler is slightly worse: the effort split across alternatives goes unused.

**Accounting:** B spends about 97% of the allowance and HEAD and C about 92%, so part of B's gain may come from spending more.

## 2. What that means

1. **Short sections are solved three ways** (the rule, B, C). The general mechanisms (B, C) need no threshold, so the rule can go once one of them is ready.
2. **The current score prefers plain arcs.** Given the choice, the compiler drops shapes and its headline rises. This repeats September: the score climbed while the tracks became, in the owner's words, "super boring". Variety lives only in the plan's lottery; nothing in the cost values it. The headline stays our shared thermometer, but on its own it would steer away from what the owner wants. So the open question is no longer "how to handle short sections". It is **how the compiler should value shape and variety**, and how we would know: by the owner's eye first.
3. **The largest waste is elsewhere:** shaped sections with room spend about 10% of the allowance on candidates the all-or-nothing checks reject. Graded fulfilment (approach A), or "search the planned family first and spend on alternatives only when it struggles" (B's suggested next step), both aim there.

## 3. How we work: principles distilled from both studies

Both studies agree, and this conversation confirms them.

1. **Agree the direction in conversation, then run the whole agreed plan** without stopping after one small step. After a break, discuss first.
2. **Prefer general, smooth mechanisms; question the concepts themselves.** Say whether a change is a gate or a law. Build an idea at the level the owner stated it: don't narrow it into a special case.
3. **Keep and extend what months were built on,** like the headline. It is the first line of every report, never the sole verdict, and is always split into finished rides versus quality, with every ruler shown.
4. **The owner's eye outranks the number.** Pair changes with plain clips or a small blind study. A rising score with worse-looking rides has happened before.
5. **Treat a first try as one execution of an idea.** Use rough proofs of concept on branches, adopt only through the full protocol, and describe a stopgap as a stopgap.
6. **Gain by adding viable candidates and by deleting, not by moving caps.** Before re-sweeping a knob, check whether its old sweeps have gone stale.
7. **Variety and taste are reported, never maximized.** A finding never becomes a flattening rule.
8. **Honest data:** flag implausible numbers yourself, keep held-out songs for decision points, and leave behind campaign targets, sole-judge rules and promoting inconclusive results.
9. **Delegate narrowly, keep the thinking with the lead agent,** and get a first answer within the hour.
10. **Write it down as you go,** in few current documents that are honest about scope.

## 4. Possible next steps (open)

- **Watch the rides before deciding:** a few B λ 0.02 rides next to HEAD and C, to see whether the higher score with fewer shapes looks better or worse to the owner.
- **The value of shape:** how the compiler could value shape and variety in its own cost, or whether the plan stays the vehicle. Several ideas are possible: a taste prior learned from owner pairs, shape as a soft target like air and speed, or the plan as intent with graded fulfilment.
- **The search's waste:** planned family first and alternatives only on struggle (B's next step), or graded checks (A), aimed at the ~10% spent on rejected long-section shapes.
- **Retire the 9-frame rule** in favour of C or a refined B, once the above is clearer.
