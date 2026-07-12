# Archived Benchmark V2 One-Shot Workflow

**Status: ARCHIVE. Retired 2026-07-12. Do not run these commands.**

This directory preserves the promotion procedure used by the first operational
Benchmark V2 implementation. It is retained for audit history and for reading
old campaign records. The live workflow is `docs/HOW_TO_WORK.md`.

The retired chain was:

```bash
npm run benchmark -- probe --out=generated/benchmark-v2/candidates/NAME-probe.json
npm run benchmark -- decide generated/benchmark-v2/candidates/NAME-probe.json
npm run benchmark -- canonical --decision-mode=improvement
npm run benchmark -- decide GENERATED_DEVELOPMENT_ARCHIVE
npm run benchmark -- baseline --label=NAME
```

It used a reusable probe, a one-shot canonical confirmation slot, a separate
decision invocation, and a full baseline freeze after promotion. The canonical
command and standalone canonical decision are now hard errors. The replacement
predeclares a certified operating point, runs fresh paired waves, performs
futility looks, and produces the verdict inside one eval attempt:

```bash
npm run benchmark -- eval
npm run benchmark -- eval --to-verdict
npm run benchmark -- rebaseline --label=NAME  # only after accept
```

`baseline` remains live only for initial bootstrap and intentional suite
rollover. It is not the normal post-accept command.
