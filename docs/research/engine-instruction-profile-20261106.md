# Native instruction profile, November 6

After the accepted partial-prefix change, V8 statistical profiling and generated
machine code locate the remaining native work without rebuilding the binary or
changing host perf permissions. CPU 2, five warmups and ten further default
compiles; all fifteen preserve exact track and charged work.

The ordinary optimized solver accounts for 29,740 of 129,603 process samples.
Of its samples, about 53% fall in ordered constraints, 28% in collision-line
visits, and 15% in cell lookup/filter preparation. Square roots and divisions
are prominent, often in samples at the following instruction. This is sampled
attribution, not individual instruction latency or a performance qualification.
The optimized solver has 7,268 machine-code bytes. Its recorded address has no
move or deletion event. The printing flag emitted all functions despite its
index option; analysis explicitly selects the compiler solver's optimized range.

The [evidence](engine-instruction-profile-20261106.json) preserves the plan,
analysis, annotated assembly, exact iterations and hashed raw logs in generated/.
Whole-process samples include warmups; they do not replace the separately scoped
CPU profiles or paired timing protocol.
