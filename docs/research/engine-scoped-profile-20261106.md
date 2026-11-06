# Compiler-scoped CPU and allocation profiles, November 6

Reference `036c4517`, production identical to accepted `8bfb6f9e`. The rejected
Binaryen build was restored before profiling. This is diagnostic attribution,
not a performance qualification or a new ns/frame result.

Earlier profiles enclosed the whole compiler worker, including catalog loading,
hashing, output serialization and inspector calls. This refresh starts sampling
after input preparation and stops before output handling, around `compileHandoff`
at the established benchmark clock boundary. CPU samples are additionally clipped
to that exact monotonic interval, excluding profiler start/stop overhead. The
profiler/host clock relationship is asserted for every sample file.

Separate fresh processes collect three CPU profiles (250 µs sampling) and two
allocation profiles (16 KiB sampling), each after five ordinary warmups, on CPU 2.
Allocation sampling includes subsequently collected objects. All fifteen compiles
preserve the exact default track hash and 147,209 charged physics frames. No
formal timing experiment overlaps these profiles.

Across 3,376.9 ms of CPU samples, garbage collection accounts for 210.7 ms (6.24%).
Native stepping remains the largest sampled function. JavaScript raw-frame
materialization is the largest sampled allocation site: 281.2 MB over two
compiles. Candidate replay itself accounts for 38.0 MB, predominantly repeated
copies of an unchanged trajectory-prefix array. The allocation samples estimate
1.738 GB allocated across the two compiles; they do not measure retained memory
or peak RSS. Sampling/JIT attribution is approximate.

The first follow-up tests a fixed-length interval trajectory container: overwrite
only its suffix, retain the immutable prefix separately, and preserve owned
candidate measurements. A second audit examines the existing all-or-nothing
prefix-read boundary: a partly invalidated prefix may still contain reusable
frames, even though the current full-read path decodes them again.

[Plans, exact scopes, summaries, iteration checks and scripts](engine-scoped-profile-20261106.json)
include hashes and local paths for the raw profiles in `generated/`.
