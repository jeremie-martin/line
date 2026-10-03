When launching general purpose agents, only launch Opus 5 (xhigh reasoning effort) agents — never Fable 5 or Sonnet 5 (Jérémie, 2026-08-03; prefer the `opus-xhigh` agent type if defined in .claude/agents/). Use subagents sparingly and purposefully, and tell them not to spawn further subagents (Jérémie, 2026-10-03).

Read `REWORK.md` (plan and current phase), `ARCHITECTURE.md` (how it works) and `WORKING.md` (rules) before changing anything.

## Rules that matter most

- **Structural changes must be byte-identical.** `npm run parity` and `npm run parity:judge` must pass; `npm test`, `npm run typecheck` (the count must not rise) and `npm run reach` must pass too.
- **Behavioural changes** need, stated in advance:
  - a hypothesis;
  - paired song-level comparisons;
  - completion reported separately from quality;
  - results under every ruler, not only the one optimized.
- **Never optimize an unvalidated measure.** Impact and sync measures must first agree with the owner's blind labels on held-out passages.
- **Physics accounting.** Every native physics observation the compiler uses is charged to its frame allowance. A cost optimization must not move tracks, scores or frame counts; parity proves it.
- **V6 is a regression sentinel, not a target.**
