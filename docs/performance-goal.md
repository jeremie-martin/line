# Compiler performance goal

**Score:** 5,460 ns per charged frame, from `taskset -c 4-7 npm run perf:score` on Node 26
on the i7-12800H laptop (November 7, 2026; it began at 6,150).
**Goal:** closed. The owner accepted this score on November 7, 2026, rather than the
5,000 ns first aimed for: what remained needed measurement in Rust, a redesign rather
than tuning. Keep this brief's rules for any later speed work.

Make the compiler faster without changing what it produces: same tracks, same scores,
same charged frames. Keep the codebase simple, lean, well designed and maintainable.
Prefer removing work to tuning it, and a clear design to a clever one. A change worth a
few percent must still read as good code and survive a later redesign; if it does not,
leave it out.

Understand before optimizing: `npm run perf:profile` shows where a compile goes (add
`--kind=allocation` for memory traffic). Check `REWORK.md` and `docs/research/` for
earlier trials. Compare with `taskset -c 4-7 npm run perf:engine -- --against=<ref>
--out=generated/engine-ab/<name>`; `perf:score` tracks
the absolute number, but only this paired comparison shows a small change helped. Run
timings alone on a quiet machine, one compile at a time. Run `npm run check` before every
commit, and after native edits `npm run build:native` first.

Commit each adopted change with a few lines of record in `REWORK.md`, including rejected
ideas. Never commit raw results. `WORKING.md` has the rules, and
`docs/engine-validation.md` the timing protocol.
