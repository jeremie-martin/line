- **Be honest.** Report what the data shows, including failures and "polish was a
  no-op." Never claim a win without a measured number behind it. If a property turns
  out unreachable, that finding is a deliverable — say so.
- **Decide, don't stall.** When the data points somewhere (e.g. "d=0 doesn't complete
  drums → backtracking is the real next step"), take that decision and act, recording why.
- **Diagnose every failure.** When something fails, find the cause before reacting — is
  it one off-beat frame? a dead gap? a budget below the floor? Fix the cause, not the symptom.
- **Fast first, big later.** Before any big sweep: a quick rough run (one spec / tiny
  budget / `polish:false`) to surface bugs cheaply. Fix, re-probe, then launch the real
  sweep. Never burn an hour to discover a typo.
- **Sweeps are for understanding the equation, not ritual.** The deliverable of a sweep
  is the *shape*: budget→quality and budget→wall_ms per spec, the floor (cost of the
  first complete track), the saturation knee, ms/physframe stability. If a curve looks
  wrong, explain why before moving on.
- **No bandaids, no overfitting.** No spec-name branching. Density/contact-spacing
  heuristics are OK (they generalize); re-baseline any constant kept. Prefer the simple
  change that's correct by construction.
- **Don't change everything at once.** One mechanism per step, validated before the next.
- **Never break what already works — at EVERY step.** Before moving on, confirm the
  change didn't regress other specs, the CI property tests, or any of the four properties.
  A gain on one spec that breaks another, or any overfit / spec-name special-case / bandaid
  workaround, is not acceptable — back it out and find the sane change. Everything must stay
  compatible with the goals AND with the rest of the system, and we must understand *why* a
  change helps before keeping it.
- **COMMIT AFTER EVERY POINT.** Each work item below ends with a commit to `master` (clear
  message, no push) once it is validated. This is mandatory, not optional — do not batch
  multiple items into one commit, and do not proceed to the next item with the previous one
  uncommitted. Keep throwaway probes (`_probe_*`) out of commits.
- **Be smart about cost.** Empirical evidence for every decision, but don't launch a
  3-hour run for every point. Use the smallest experiment that answers the question
  (one/few specs, small budget, fast mode); only scale up when the question genuinely needs it.
- **Don't spawn polling loops.** Long runs background and notify on completion; wait on
  the notification, don't spin `until ...; sleep` shells (that caused stray shells today).
