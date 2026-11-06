# Measuring real compiles, November 6

Branch `perf/compiler-after-foundations`, from `3b1e0ae0`. All changes are
structural: every compile below reproduced its committed track and charged work.

## The target was the wrong workload

Timing since November 3 used cell 61: 150 k frames, five warmups. A production
compile spends the standard allowance, about 2.7–2.9 M frames, in one fresh
process: nineteen times more. The two workloads have different profiles.

| Share of compile | Cell 61 (150 k) | Cell 55 (2.7 M) |
| --- | ---: | ---: |
| Local response search | barely visible | 47% |
| Opening an interval | 6.4% | 1.9% |
| Future-value model | below 1% | 4% |

Pinning to one CPU also moved V8's background GC and compilation onto
the measured thread: 18.8 s pinned, about 17.4 s on two performance cores. The
6,500 ns target is not comparable with the numbers here and is retired with its
workload. Earlier ns/frame records keep their original meaning.

`perf:engine --mode=compile` now defaults to cells 55 and 56, cold, one compile
per process, with `--against=<git ref>`. An eight-pair A/A control stays within
±2%. `perf:profile` replaces per-study scripts and names native functions.

## Result

Fresh twelve-pair comparison with `3b1e0ae0`, declared in advance: 95% requested
(96.14% exact coverage), zero margin, each cell's upper bound at most zero,
`taskset -c 4-7`, Node 22.22.2.

| Workload | Median change | Interval | Verdict |
| --- | ---: | ---: | --- |
| Cells 55, 56 together | −3.89% | [−4.10%, −3.39%] | FASTER, 12 of 12 |
| Cell 55 | −4.08% | [−4.38%, −3.59%] | FASTER |
| Cell 56 | −3.57% | [−4.03%, −2.99%] | FASTER |
| Guards: cells 61, 62 together, also cold | −3.41% | [−4.22%, −2.00%] | No regression |

Median arms: 17.20 → 16.55 s per compile, 6,158 → 5,925 ns per charged frame.
Peak RSS 764 → 769 and 929 → 879 MiB; WASM capacity 34.6 → 36.3 and 41.2 → 39.9
MiB. Allocation traffic falls from 13.5 to 11.8 GB. Individual screens, eight
pairs each: forest and frame array −1.80%; extent filter and copies −1.28%;
unread motion fields −0.73%, inconclusive alone, kept because it deletes code.
Profiles overstated savings: the value model's 4% yielded under half of that.

Parity falls from 228 s to about 155 s with eight workers. Real compiles peak
under 1 GiB, so the 4 GB per-worker default was stale.

## Where a real compile goes

At 16.3 s, profiled: stepping 40%, measurement 18%, line registration 13%,
geometry 7%, GC 6%. There are 145,811 evaluated candidates and 2.69 M simulated
frames, about 19 frames per candidate and 48 lines registered per candidate.
105,908 reach scoring. 31,309 are rejected for coming apart, after about five
frames. Response search owns 62% of simulated frames.

## Rejected, with evidence

- **Reusing sibling trajectories.** Even a perfect oracle finds only 11% of frames
  shared with an earlier candidate of the same search, 15% in response search.
  Certifying that needs new native machinery. Not worth building.
- **Skipping the engine of a losing memo hit** (233 ms). Tracks hold, charged
  frames move about 0.01%: that add truncates the shared cache. The source says so.
- **Blaming retained candidates for GC.** Mark-compact takes about 14 ms and the
  live heap is about 170 MB. The cost is scavenging short-lived allocations.
- **Skipping collision history in stepping.** It is already rebuilt lazily.
- **Reallocating the budget.** Existing studies stand: ½× loses 32 headline points
  and 2× gains nothing at the capped effort. Faster search buys time, not quality.

## Remaining ceiling

Stepping is a floor of about 40%; earlier solver trials cover its arithmetic. The
rest is spread across items of 1–2%. Columnar observations could save perhaps 5–8%
but must touch frozen rulers, which changes measurement identity. A registration
overlay could save perhaps 3%. Exact single-threaded work probably ends near
−25%. A larger step needs parallel response stencils or a behavioural search
change; both are design decisions for the owner.
